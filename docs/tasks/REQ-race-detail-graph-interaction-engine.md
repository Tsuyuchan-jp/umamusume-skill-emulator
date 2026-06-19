# REQ-race-detail-graph-interaction-engine: Google Map 型グラフ — Interaction Canvas Engine（Dual-Viewport）

> **Google Maps 級の操作レスポンスを目指す構造変更正本。**
> 親: [`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md)
> 文脈: [`REQ-race-detail-graph-performance.md`](REQ-race-detail-graph-performance.md)、[`REQ-race-detail-graph-map-view-perf-fallback.md`](REQ-race-detail-graph-map-view-perf-fallback.md)（30fps cap は移行期フォールバック）
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)

- **ステータス**: done（Phase 1〜4 **実機検証クローズ** 2026-06-19）
- **作成日**: 2026-06-19 01:19
- **関連コミット**: `5693968`（Phase 1）、`8767b1a`（Phase 2）、`8ab7c60`（Phase 3）、`9a3b8ca`（パン選択防止）、`c6db25c`〜`d22db24`（非操作時小丸）、`6ac05a9`（ホイール窓中心）

---

## 目的

30fps domain cap 後も残る **Recharts 全系列再描画** を根本解消し、ホイール/2D ドラッグ中の体感を **Google Maps 級（60fps 近傍）** に引き上げる。

**方針（ユーザー合意・変更不可）**: 時間と工数をかけてよい。単純チューニング（fps 低下・ReferenceArea defer のみ）では妥協しない。

---

## アーキテクチャ概要: Dual-Viewport Engine

```
┌─────────────────────────────────────────────────────────┐
│  Idle（停止後）                                          │
│  Recharts LineChart（domain = committed viewState）      │
│  + ReferenceArea / phaseLines / Tooltip / Legend         │
│  + ChartMetricsBridge → measured plotMetrics             │
│  + overlay SVG（probe 合格後）                           │
└─────────────────────────────────────────────────────────┘
                          │
              wheel / drag start
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Interacting（操作中）                                   │
│  liveViewRef（毎入力更新、React setViewState なし）      │
│  Canvas 折れ線レイヤー（rAF 60fps、domain 再計算描画）   │
│  + スキル発動点の小丸（速度線上・layout 不要）           │
│  Recharts: domain 固定・Line 非表示（cartesian 実測維持）│
│  ReferenceArea / phaseLines / overlay（赤線・ラベル）: defer │
│  Tooltip: defer                                          │
└─────────────────────────────────────────────────────────┘
                          │
         pointerup / wheel idle / dblclick reset
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Settling（停止直後）                                    │
│  liveView → committed viewState（setState 1 回）         │
│  Recharts domain 更新 → ChartMetricsBridge → probe       │
│  Canvas 最終フレーム維持（折れ線 + 小丸）                │
│  → overlayLayoutReady まで Canvas 表示（案 A）          │
│  → probe 合格後 Canvas 非表示 + overlay 復帰             │
└─────────────────────────────────────────────────────────┘
```

### なぜ CSS transform ではなく Canvas + domain 再計算か

| 手法 | 問題 |
|------|------|
| Recharts を `scale/translate` のみ | ズームしても可視データ範囲が変わらない（ボケ・LOD 不正） |
| Recharts を bitmap 化して transform | 拡大時にボケ。Maps 級のネイティブ感にならない |
| **Canvas + `visibleWindowFromViewState(liveView)`** | 毎フレーム正しい幾何。~1800点×6系列の座標変換は CPU 的に軽量 |

---

## 座標・状態の正本（退行防止・変更禁止）

| 概念 | 役割 | 変更 |
|------|------|------|
| `ChartViewState` | 論理正本（center + scale） | **不変** |
| `visibleWindowFromViewState` | domain 算出（percent 3 系列連動） | **不変** |
| `applyWheelZoom` / `applyPanDrag` / `svgToPercent` | pan/zoom 数学 | **不変** |
| `ChartPlotMetrics` + probe ゲート | overlay 座標・赤線整合 | **不変**（idle 時の正本） |
| `overlayLayoutReady` | 停止後 overlay 復帰条件 | **不変** |

操作中の Canvas は **idle 時に実測された `cartesian` 矩形を固定**し、`visibleWindow` のみ `liveView` から毎フレーム算出する。

---

## 実装フェーズ（Phase 1〜4 が本 REQ スコープ）

Phase 5〜6 は follow-up（本 REQ 完了後に別起票可）。

| Phase | 内容 | 完了の定義 |
|-------|------|-----------|
| **1** | 描画コア抽出 `chartLineRenderer.ts` | Canvas 描画が idle Recharts と視覚一致（許容差あり） |
| **2** | Interaction View 分離（`liveViewRef`、操作中 `setViewState` 停止） | 操作中 Recharts Line commit ゼロ |
| **3** | Canvas レイヤー配線 + rAF ループ + **スキル発動点小丸** | 60fps 近傍の主観 OK。操作中発動位置が視認できる |
| **4** | ハンドオフ品質（フラッシュ防止・probe 連携） | 停止後 200ms overlay 復帰・退行なし |
| 5（follow-up） | ReferenceArea defer 正式化、30fps cap 削除 | 別タスク可 |
| 6（follow-up） | Recharts Line 廃止（軸・Tooltip のみ） | 別タスク可 |

---

## Phase 1 — 描画コア抽出

### 新規ファイル

`desktop-app/app/lib/chartLineRenderer.ts`

### 公開 API（案）

```typescript
import type { CartesianRect, GraphPoint, VisibleWindow } from "./raceGraphBuilder";
import type { GraphDisplayState } from "./raceGraphBuilder";

/** Canvas 描画コンテキスト（論理 px。DPR は呼び出し側で ctx スケール済み想定） */
export interface ChartLineRenderContext {
  ctx: CanvasRenderingContext2D;
  cartesian: CartesianRect;
  window: VisibleWindow;
}

export type ChartLineYAxis = "speed" | "percent";

export type ChartLineInterpolation = "linear" | "monotone";

export interface ChartLineSeriesSpec {
  /** GraphPoint のキー（baseline* 含む） */
  dataKey: keyof GraphPoint;
  yAxis: ChartLineYAxis;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  strokeOpacity?: number;
  interpolation: ChartLineInterpolation;
  visible: boolean;
}

/** データ座標 → Canvas ピクセル（cartesian 内。クリップ前提） */
export function timeToCanvasX(
  time: number,
  window: VisibleWindow,
  cartesian: CartesianRect,
): number;

export function speedToCanvasY(
  speed: number,
  window: VisibleWindow,
  cartesian: CartesianRect,
): number;

export function percentValueToCanvasY(
  value: number,
  window: VisibleWindow,
  cartesian: CartesianRect,
): number;

/** 1 系列を描画（可視窓外は clip で切る） */
export function drawChartLineSeries(
  renderCtx: ChartLineRenderContext,
  points: GraphPoint[],
  spec: ChartLineSeriesSpec,
): void;

export interface DrawChartLinesOptions {
  displayState: GraphDisplayState;
  showBaseline: boolean;
  /** RaceDetailChart と同色定数を渡す */
  colors: {
    speed: string;
    stamina: string;
    lane: string;
    baselineOpacity: number;
  };
}

/** 速度・体力・レーン（+ baseline）を一括描画 */
export function drawChartLines(
  renderCtx: ChartLineRenderContext,
  points: GraphPoint[],
  options: DrawChartLinesOptions,
): void;

export interface DrawSkillActivationDotsOptions {
  displayState: GraphDisplayState;
  /** buildSkillMarkers 出力（layoutSkillMarkers 前） */
  markers: Pick<SkillMarker, "startTime" | "labelColor" | "kind">[];
  /** 丸の半径（CSS px。DPR スケール済み ctx 上） */
  radius?: number;
}

/** 速度折れ線上にスキル発動点の小丸を描画（Phase 3 で Canvas rAF から呼ぶ） */
export function drawSkillActivationDots(
  renderCtx: ChartLineRenderContext,
  points: GraphPoint[],
  options: DrawSkillActivationDotsOptions,
): void;

/** Canvas の bitmap サイズを DPR に合わせる（width/height は CSS px） */
export function resizeCanvasToDisplaySize(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
): { width: number; height: number; dpr: number };
```

### 補間方針（Recharts 整合）

| 系列 | Recharts 現状 | Canvas 採用 |
|------|--------------|-------------|
| speed | `type="linear"` | `linear` |
| stamina / lane | `type="monotone"` | `monotone`（Phase 1 で Recharts 出力と diff 検証。差が大きければ設計レビューで決定） |
| baseline 3 系列 | 破線 `strokeDasharray="6 4"` | 同一 |

### `getSpeedAtTime` の export（Phase 1）

- `raceGraphBuilder.ts` の非公開 `getSpeedAtTime` を **export** する（pan/zoom ロジックは不変。折れ線 linear 補間と同一）
- `drawSkillActivationDots` の Y 座標は `getSpeedAtTime` + `speedToCanvasY` で算出（停止後 overlay の stack 0 赤線アンカーと同一データ点）

### Phase 1 完了条件

- [x] `drawChartLines` が compare OFF/ON・checkbox 表示切替に対応
- [x] `drawSkillActivationDots` が `buildSkillMarkers` 出力 + displayState フィルタに対応（単体座標検証。Phase 3 まで UI 未配線可）
- [x] `getSpeedAtTime` export（`raceGraphBuilder.ts`）
- [x] `resizeCanvasToDisplaySize` で Retina 対応
- [x] cartesian クリップ矩形内のみ描画
- [x] **Recharts はまだ変更しない**（単体検証: 同一 window + cartesian で座標サンプル比較 ≤1px）
- [x] `npm run build` 通過

---

## Phase 2 — Interaction View 分離

### 変更ファイル

`desktop-app/app/hooks/useChartViewInteraction.ts`

### 状態モデル（案）

```typescript
/** committed: React chartViewState（Recharts domain） */
/** live: 操作中の最新 view。ref のみ更新 */

export interface UseChartViewInteractionResult {
  isMapInteracting: boolean;
  /** 操作中の最新 view（Canvas rAF 用）。ref のみ — React state で返さない */
  liveViewRef: RefObject<ChartViewState>;
  /** 操作開始時に固定する cartesian（synthetic metrics / Canvas 描画用） */
  interactionCartesianRef: RefObject<CartesianRect | null>;
}

export interface UseChartViewInteractionOptions {
  // ...既存...
  /** true: 操作中は setViewState を呼ばず liveViewRef のみ更新 */
  deferDomainCommit?: boolean;
}
```

### 挙動変更

| イベント | 現状（30fps cap） | Phase 2 以降 |
|----------|------------------|--------------|
| wheel / pointermove | `pendingViewStateRef` → throttle 付き `setViewState` | `liveViewRef` のみ更新。`setViewState` **なし** |
| pointerup / wheel idle | `commitPendingViewStateNow` | `commitLiveView()` → `setViewState` 1 回 |
| dblclick reset | 即時 `setViewState` | 即時（live + committed 両方リセット） |
| `isMapInteracting` setState | 即時（維持） | 即時（維持） |

### ホイール座標入力

- `plotMetricsRef` は **committed cartesian + liveView から組み立てた synthetic metrics** を使用
- `visibleWindowFromViewState(liveViewRef.current)` + 固定 `cartesian` で `svgToTime` / `svgToSpeed` / `svgToPercent`
- **30fps cap のドリフト問題が構造的に解消**される

### 移行期

- `deferDomainCommit` フラグ or 段階的ロールアウトで、Phase 2 単体では Canvas なしでも「操作中 commit ゼロ」を検証可能
- 30fps cap コードは Phase 3 まで **残す**（`deferDomainCommit=false` 時のフォールバック）

### Phase 2 完了条件

- [x] 操作中 `setViewState` / Recharts domain 変更が **ゼロ**（React Profiler で確認 — **実機は省略**。Phase 3 Canvas 追従で間接検証）
- [x] 停止時 `commitLiveView` で最新 live が committed に反映
- [x] `expandSkillRows` ON（map 無効）時は従来どおり cap のみ・live 分離なし
- [x] `npm run build` 通過

---

## Phase 3 — Canvas レイヤー配線

### 新規ファイル

`desktop-app/app/hooks/useInteractionCanvasLoop.ts`

```typescript
export interface UseInteractionCanvasLoopOptions {
  enabled: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isMapInteracting: boolean;
  /** overlayLayoutReady 後は Canvas 非表示（settling 中は true のまま維持） */
  canvasVisible: boolean;
  /** 操作開始時に固定した cartesian */
  cartesian: CartesianRect;
  liveViewRef: RefObject<ChartViewState>;
  raceEnd: number;
  points: GraphPoint[];
  /** buildSkillMarkers 出力（layout 前） */
  skillMarkers: SkillMarker[];
  displayState: GraphDisplayState;
  showBaseline: boolean;
  chartAreaHeight: number;
  chartAreaWidth: number;
}

/** isMapInteracting 中のみ rAF で Canvas 再描画 */
export function useInteractionCanvasLoop(
  options: UseInteractionCanvasLoopOptions,
): void;
```

### 変更ファイル

`desktop-app/app/components/RaceDetailChart.tsx`

- `<canvas>` を `chartAreaRef` 内・plot area 上に `absolute` 配置
- `canvasVisible = isMapInteracting || !overlayLayoutReady`（案 A: settling 中も Canvas 維持）
- `isMapInteracting` 中:
  - Canvas `drawChartLines` + **`drawSkillActivationDots`**（下記）
  - Recharts `Line` 6 本は `strokeOpacity:0`（**ChartMetricsBridge は動かすな** — domain 固定のため Bridge は idle domain のまま）
- `overlayLayoutReady` 後: Canvas 非表示、Recharts Line 表示

### ReferenceArea / phaseLines（Phase 3）

- 操作中は **非表示**（`isMapInteracting && null` または `hide`）
- 左下凡例ピル（「直線/コーナー」等の Recharts 外 `div`）は **操作中も表示**（defer 対象外）

### スキル発動点の小丸（Phase 3 拡張・設計承認済み）

操作中の **最低要件は速度・体力・レーン 3 折れ線**。スキル名・赤線・ラベルは非表示のまま、発動位置の視認性を補う **軽量 overlay 代替**。

| 項目 | 仕様 |
|------|------|
| 描画タイミング | 操作中: Canvas rAF。非操作時: overlay SVG `<circle>`（`showSkillOverlay` 時） |
| 非表示 | スキル/デバフ checkbox OFF |
| データ | `buildSkillMarkers` 出力（**`layoutSkillMarkers` は呼ばない**） |
| 座標 | `getSpeedAtTime` + `speedToCanvasY` / `plotMetrics.scales.speedToY` — stack 0 赤線アンカーと同一 |
| 見た目 | 半径 **2.5px**（`SKILL_ACTIVATION_DOT_RADIUS`）。色は `SkillMarker.labelColor` |
| 同時刻複数 | 速度線上同一点に重なる — 操作中は許容。停止後 overlay が縦展開 |
| 性能 | Canvas `arc` × N（20〜40+）。layout / getBBox 不要 |
| やらない | 丸の hover / Tooltip / 赤線 / スキル名 |

**Settling**: 案 A に従い `overlayLayoutReady` まで小丸も Canvas に残す。overlay 復帰時に同座標から赤線・ラベルが現れる UX を狙う。

### Phase 3 完了条件

- [x] `useInteractionCanvasLoop` 連続 rAF + DPR + drawChartLines + drawSkillActivationDots 配線
- [x] RaceDetailChart: canvas 要素、canvasVisible / rechartsLinesVisible、Line strokeOpacity defer
- [x] ReferenceArea / phaseLines / Tooltip 操作中 defer（左下凡例ピル・STAMINA_PLOT_FLOOR は維持）
- [x] settling 配線（`canvasVisible = isMapInteracting || !overlayLayoutReady`、idleCartesian で committed 描画）
- [x] `npm run build` 通過
- [x] 50+ スキル終盤でホイール/2D ドラッグ 2〜3 秒が **30fps cap 時より明確に軽い**（**実機検証クローズ** 2026-06-19）
- [x] compare ON（6 系列）・percent 3 系列 checkbox 切替が Canvas に反映（**実機検証クローズ**）
- [x] スキル/デバフ ON 時、操作中に速度線上の **発動点小丸** が live window に追従（**実機検証クローズ**）
- [x] 停止後 overlay 復帰・赤線↔速度線整合（**実機検証クローズ**。小丸は非操作時も overlay SVG で常時表示に拡張 — 下記）
- [x] ReferenceArea / phaseLines 操作中非表示 → 停止後復帰（**実機検証クローズ**）
- [x] 操作中 Tooltip 非表示（defer）（**実機検証クローズ**）

---

## Phase 3 以降の追記（実装・実機クローズ 2026-06-19）

Phase 3 本体（`8ab7c60`）のあと、同一セッション〜続チャットで以下を追加。**Phase 4 設計レビューの前提**。

### 実機検証クローズ（Phase 3 本体）

ユーザー実機確認: Canvas 追従・compare 6 系列・checkbox 切替・小丸追従・overlay 復帰・ReferenceArea/phaseLines/Tooltip defer・dblclick・expandSkillRows 無効 — **すべて OK**。Maps 級体感の改善を確認。

### 追記 A — パン時 Y 軸テキスト選択防止（`9a3b8ca`）

| 項目 | 内容 |
|------|------|
| 症状 | 1 回目ドラッグ後、Y 軸目盛り（`23.0` 等）が選択状態だと再ドラッグ不能 |
| 対策 | `chartAreaRef` に `select-none`、`globals.css` で recharts 配下 `user-select: none`、`pointerdown` で `preventDefault()`、pointerup で `getSelection()?.removeAllRanges()` |
| 実機 | **OK** |

### 追記 B — 非操作時も発動点小丸を常時表示（`c6db25c` / `d22db24`）

| 項目 | 内容 |
|------|------|
| 変更 | overlay SVG に `<circle>` を追加（`showSkillOverlay` 時）。操作中は Canvas のみ |
| 半径 | `SKILL_ACTIVATION_DOT_RADIUS = 2.5`（Canvas / SVG 共通） |
| 実機 | **OK** |

### 追記 C — ホイールズーム中心を可視窓 center に変更（`6ac05a9`・map-view 採用）

| 項目 | 内容 |
|------|------|
| 変更 | `useChartViewInteraction` の `handleWheel` が `wheelZoomAnchor(view)` → `centerTime/Speed/Percent` を `applyWheelZoom` に渡す（**画面中心拡大**） |
| 数学 | `applyWheelZoom` 本体は不変。アンカー = center のとき scale のみ変化 |
| 実機 | **採用確定**。視認性・操作性が大幅改善 |
| 関連 | [`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md) 決定ログ 2026-06-19 17:09 |

### Phase 4 着手前の既知所見（設計レビューで扱う）

- **停止後 overlay 表示までの短い lag**: probe ゲート（Recharts scales が committed domain に追いつくまで `overlayLayoutReady=false`）による **意図的同期待ち**。固定 ms タイマーではない。Phase 4 でフラッシュ防止・体感改善を検討
- **settling 中の見え方**: Canvas（折れ線+小丸）→ probe 合格後 Recharts Line + overlay（赤線+ラベル+小丸）。案 A どおり

---

## Phase 4 — ハンドオフ品質（Settling）

### シーケンス（必須）

```
1. pointerup / wheel idle
2. commitLiveView() → setChartViewState(liveView)
3. isMapInteracting = false（既存 syncInteracting）
4. Canvas: liveView == committed で **最終 1 フレーム描画維持**
5. Recharts: domain 更新 → 1 回だけ全系列再描画
6. ChartMetricsBridge: 新 scales → handlePlotMetrics
7. probe 合格（plotMetricsScalesMatchWindow + view 一致）
8. Canvas 非表示 + Recharts Line 表示 + overlay 復帰
```

### フラッシュ防止策（**案 A 採用**）

- `canvasVisible = isMapInteracting || !overlayLayoutReady`
- `rechartsLinesVisible = overlayLayoutReady && !isMapInteracting`
- Canvas（折れ線 + 小丸）を `overlayLayoutReady` まで表示。Recharts Line は `strokeOpacity:0` → probe 合格後に Line 表示・Canvas 非表示
- `isSettling` フラグは追加しない

### `onViewReset`（ダブルクリック）

- live + committed 即時リセット（現状どおり）
- Canvas クリア + `setMeasuredPlotMetrics(null)` + Recharts 俯瞰

### Phase 4 実装仕様（設計レビュー承認 2026-06-19 17:36）

**方針**: 案 A 維持 + ChartMetricsBridge 多フレーム rAF probe リトライ + dev 計測

| 項目 | 仕様 |
|------|------|
| 案 A | `canvasVisible` / `rechartsLinesVisible` 式は **変更なし**。`isSettling` フラグ追加なし |
| probe リトライ | 不合格時 rAF ループ。上限 `METRICS_PROBE_MAX_FRAMES=12` **または** `METRICS_PROBE_MAX_MS=200`（先着） |
| probe ゲート | `plotMetricsScalesMatchWindow`（tolerance 1.5px）**変更なし** |
| 200ms SLA 起点 T0 | `commitLiveView` 実行 tick（= `isMapInteracting=false`。wheel は idle 150ms **後**） |
| 200ms SLA 終点 T1 | `overlayLayoutReady=true` 最初の render |
| dev 計測 | `NODE_ENV=development` のみ。`handoff:commit` → `handoff:overlay-ready` → measure `handoff:commit-to-overlay`。>200ms で `console.warn` |
| flushSync | Phase 4 では **入れない**（A1 未達時のみ follow-up 検討） |
| 線切替微差 | Canvas/Recharts ≤1px 差は主観 OK で許容 |

### 後続要検証（Phase 4 スコープ外・値変更しない）

| 項目 | 内容 |
|------|------|
| **`MAP_INTERACTION_WHEEL_IDLE_MS=150`** | Phase 4 では **変更しない**（scope 外）。実機で「最終 wheel 入力 → commit needs commit → overlay 復帰」の体感（目安上限 **350ms** = 150ms idle + probe 200ms）を Phase 4 実機チェックで確認。短縮の要否は **Phase 5 以降** に判断 |
| 関連定数 | `useChartViewInteraction.ts` の `MAP_INTERACTION_WHEEL_IDLE_MS` |

### Phase 4 完了条件（本 REQ 全体完了）

- [x] ChartMetricsBridge: probe 多フレーム rAF リトライ（max 12 frames or 200ms）
- [x] dev 計測: `handoff:commit-to-overlay` が development で計測可能
- [x] 操作中 Recharts `Line` commit **ゼロ**（Phase 3 資産・退行なし）
- [x] 停止後 **200ms 以内**（T0=commit 後）overlay probe 合格・赤線↔速度線 OK
- [x] commit 瞬間のフラッシュ・線ジャンプなし（主観）
- [x] wheel idle 150ms: **値変更なし**。体感要検証項目を実機で確認（上記「後続要検証」）
- [x] ダブルクリックリセット・compare・percent 3 系列・リサイズ・ホイール窓中心で退行なし
- [x] `expandSkillRows` ON 時 map 操作無効のまま
- [x] `npm run build` 通過
- [x] **実機検証クローズ**（2026-06-19。連続ホイールひっかかりは別 REQ）

### Phase 4 実機チェックリスト

**A. 200ms SLA（dev Console）**

1. `npm run tauri dev`、DevTools Console 開く
2. 50+ スキル終盤: 2D ドラッグ 2 秒→離す / ホイール連打 2 秒→停止（各 3 回）
3. `handoff:commit-to-overlay` ≤200ms（warn なし）
4. ホイール: 最終入力→赤線表示が主観 OK（目安 ≤350ms = idle 150 + probe）

**B. フラッシュ・連続性**

5. ドラッグ離し: 折れ線空白・白 flash なし
6. 速度線ジャンプなし（≤1px 許容）
7. スキル ON: Canvas 小丸→overlay 小丸+赤線 位置連続
8. compare ON: baseline 破線切替 OK

**C. 退行**

9. percent 3 系列 checkbox / ダブルクリック / リサイズ / expandSkillRows 無効
10. ReferenceArea・phaseLines・Tooltip defer 復帰
11. ホイール窓中心（6ac05a9）/ Y 軸選択防止（9a3b8ca）

**D.** `npm run build` 通過

---

## ファイル分割（全体）

| ファイル | Phase | 責務 |
|---------|-------|------|
| `app/lib/chartLineRenderer.ts` | 1 | 折れ線 + スキル発動点小丸描画。座標変換 pure functions |
| `app/lib/raceGraphBuilder.ts` | 1 | `getSpeedAtTime` export のみ（ロジック不変） |
| `app/hooks/useChartViewInteraction.ts` | 2 | liveView / committed 分離、入力イベント、commit |
| `app/hooks/useInteractionCanvasLoop.ts` | 3 | rAF ループ、DPR、drawChartLines 呼び出し |
| `app/components/RaceDetailChart.tsx` | 3–4 | canvas 要素、表示切替、settling 連携 |
### 触らないもの

- `applyWheelZoom` / `applyPanDrag` / `visibleWindowFromViewState` / probe 関数群の **ロジック**
- WASM / OCR / `src-tauri/`
- ステップ 3 暫定 UI 削除（`expandSkillRows` checkbox・K=4 dev 表示）— 別タスク
- Phase 6 の Recharts Line 完全廃止 — 本 REQ 外

---

## perf-fallback（30fps cap）との関係

| 期間 | 扱い |
|------|------|
| Phase 2 着手〜Phase 4 完了 | `deferDomainCommit=false` 時は既存 cap が有効（安全弁） |
| Phase 4 実機クローズ後 | cap 削除 or `deferDomainCommit` 常時 true を follow-up で |

---

## やらないこと（本 REQ）

- 操作中 overlay フル（赤線 + スキル名ラベル + layoutSkillMarkers）— 停止後のみ
- 操作中 overlay 中間レベル（赤線のみ・P2 Backlog）— 小丸で代替。Phase 6 以降に再検討可
- 操作中スキル発動丸の hover / Tooltip
- WebGL 描画（Canvas 2D で十分な見込み）
- Recharts 完全除去（Phase 4 時点では軸・Tooltip・Legend・ReferenceArea は Recharts 維持）

---

## 検証手順（実機・全 Phase 共通）

1. 50+ スキル終盤 — ホイール連打・2D ドラッグ 2〜3 秒（体感・任意 Profiler）
2. 停止後 200ms 以内 overlay 復帰（赤線↔速度線）。小丸→赤線の位置連続性
3. スキル ON 時: 操作中は小丸のみ、停止後 overlay 復帰
4. percent 3 系列・compare ON・ダブルクリックリセット
5. ウィンドウリサイズ後の整合
6. `expandSkillRows` ON 時 map 操作無効
7. ReferenceArea / phaseLines: 操作中非表示・停止後復帰
8. （任意）React Profiler: 操作中 `RaceDetailChart` の commit 回数・時間

---

## 完了条件（REQ 全体）

- [x] Phase 1〜4 すべて完了
- [x] 上記検証手順 **実機検証クローズ**（2026-06-19）
- [x] `docs/TODO.md` 完了済み・本 REQ `done`

**follow-up（本 REQ 外）**: Phase 5（30fps cap 削除等）・連続ホイール途中 commit 除去 → [`REQ-race-detail-graph-wheel-continuous-zoom.md`](REQ-race-detail-graph-wheel-continuous-zoom.md)

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-19 01:19 | **Interaction Canvas Engine を sibling REQ に起票**。Dual-Viewport（操作中 Canvas / idle Recharts） | 30fps cap 後も Maps 級を目指す。ユーザー合意: 工数可・妥協しない |
| 2026-06-19 01:19 | Phase 1〜4 を本 REQ スコープ。Phase 5〜6 は follow-up | 段階的に退行リスクを抑えつつ効果を早期検証 |
| 2026-06-19 01:19 | pan/zoom 数学・probe ゲート・overlayLayoutReady は不変 | 実機検証済み資産の維持 |
| 2026-06-19 14:22 | **設計レビュー承認**: Dual-Viewport Phase 1〜4。ハンドオフ **案 A**（`canvasVisible` / `overlayLayoutReady` 連動） | Ask mode 設計レビュー合意 |
| 2026-06-19 14:22 | ReferenceArea / phaseLines **操作中非表示**（停止後復帰）。左下凡例ピルは残す | 操作中最低要件は 3 折れ線。domain stale との位置ズレ回避 |
| 2026-06-19 14:22 | **スキル発動点小丸**を Phase 3 拡張として追加（Canvas・layout 不要・`overlayLayoutReady` まで表示） | 操作中視認性。停止後赤線アンカーと同一 `(startTime, speed)` |
| 2026-06-19 14:22 | monotone は **d3-shape `curveMonotoneX`**。`liveViewRef` は React state で返さない | 既存依存流用。60fps 親 re-render 防止 |
| 2026-06-19 14:22 | 30fps cap: Phase 3 で `deferDomainCommit=true` 常時化、**コード削除は Phase 5 follow-up** | 安全弁として Phase 2〜3 は cap 残存 |
| 2026-06-19 15:11 | **Phase 1 着手**: `chartLineRenderer.ts` 新規、`getSpeedAtTime` export、vitest 座標検証（≤1px） | 設計レビュー承認後の描画コア抽出 |
| 2026-06-19 15:19 | **Phase 1 完了**: drawChartLines / drawSkillActivationDots / resizeCanvasToDisplaySize、build 通過 | vitest 5 件 OK。Recharts 未変更 |
| 2026-06-19 15:58 | **Phase 2 設計承認・着手**: liveViewRef 分離、buildInteractionPlotMetrics、deferDomainCommit デフォルト true | 操作中 Recharts 折れ線固定は Phase 2 単体で受け入れ。視覚追従は Phase 3 |
| 2026-06-19 15:58 | **Phase 2 完了**: useChartViewInteraction defer パス、commitLiveView、RaceDetailChart deferDomainCommit: true、vitest 2 件追加 | 30fps cap は defer=false フォールバック用に残置。REQ は Phase 3 まで in-progress 維持 |
| 2026-06-19 16:13 | **Phase 2 実機検証クローズ（軽量）**: ドラッグ離し commit・ホイール停止後ズーム・dblclick 俯瞰 OK。操作中折れ線固定は期待どおり | Profiler は Tauri DevTools 非対応・Chrome 確認面倒のため省略。liveView 整合は Phase 3 Canvas で統合検証 |
| 2026-06-19 16:13 | **Phase 3 設計レビュー着手待ち**: useInteractionCanvasLoop 新規、RaceDetailChart canvas 配線、Line strokeOpacity、発動点小丸 | Phase 1〜2 資産（chartLineRenderer・liveViewRef）を接続 |
| 2026-06-19 16:21 | **Phase 3 設計レビュー承認**: 連続 rAF、Tooltip conditional unmount、settling idleCartesian、checkbox 即 Canvas 反映、小丸 3.5px | Ask mode 設計レビュー合意 |
| 2026-06-19 16:21 | **Phase 3 実装完了（実機検証待ち）**: useInteractionCanvasLoop + RaceDetailChart canvas 配線、Line strokeOpacity defer、ReferenceArea/phaseLines/Tooltip defer | build 通過。実機チェックはユーザー別途 |
| 2026-06-19 17:09 | **Phase 3 実機検証クローズ** + 追記 A/B/C（選択防止・非操作時小丸 2.5px・ホイール窓中心採用） | ユーザー全項目 OK。停止後 overlay まで短い lag は probe 同期待ち（Phase 4 で検討） |
| 2026-06-19 17:28 | **Phase 4 設計レビュー着手待ち**: ハンドオフ品質・200ms SLA・settling 体感 lag | Phase 3 + 追記を前提。probe ゲート維持が前提 |
| 2026-06-19 17:36 | **Phase 4 設計レビュー承認**: 案 A 維持 + ChartMetricsBridge 多フレーム rAF probe リトライ + dev 計測。200ms SLA は T0=commit 後 | Ask mode 設計レビュー合意。未決事項すべて OK |
| 2026-06-19 17:36 | **`MAP_INTERACTION_WHEEL_IDLE_MS=150` は Phase 4 で変更しない**。体感要検証は実機チェックに記載、短縮判断は Phase 5 以降 | scope 外。ユーザー要望: docs に後続検証として控え |
| 2026-06-19 17:39 | **Phase 4 実装完了**: ChartMetricsBridge 多フレーム rAF probe リトライ（max 12 frames / 200ms）+ dev 計測 `handoff:commit-to-overlay`（`9042aa9`） | 設計レビュー承認どおり。実機検証クローズはユーザー別途 |
| 2026-06-19 17:53 | **Phase 4 実機検証クローズ** + **REQ Phase 1〜4 done** | ユーザー全項目 OK。連続ホイールひっかかりは Phase 4 スコープ外・別 REQ 起票 |

---

## 設計レビュー起票プロンプト（Phase 4 — ハンドオフ品質・Settling）

```
@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-race-detail-graph.md
@docs/tasks/REQ-race-detail-graph-map-view.md
@docs/tasks/REQ-race-detail-graph-interaction-engine.md
@desktop-app/app/components/RaceDetailChart.tsx
@desktop-app/app/hooks/useChartViewInteraction.ts
@desktop-app/app/hooks/useInteractionCanvasLoop.ts
@desktop-app/app/lib/chartLineRenderer.ts
@desktop-app/app/lib/raceGraphBuilder.ts

## チャット種別
設計レビュー（Ask mode）

## 進め方（重要）
- このチャットでは **コード変更・ファイル編集・コミットを一切しない**
- 現状整理 → 方針提案 → 変更範囲 → リスク → 検証手順 まで提示する
- 私が「承認」「修正」「見送り」のいずれかを返すまで、実装に進まない

## 背景
Interaction Canvas Engine Phase 1（`5693968`）〜 Phase 3（`8ab7c60`）+ 追記（`9a3b8ca` 選択防止、`c6db25c`/`d22db24` 非操作時小丸 2.5px、`6ac05a9` ホイール窓中心採用）まで **実機検証クローズ**。
Phase 3: Canvas rAF 追従・Maps 級体感 OK。操作中 commit ゼロ（deferDomainCommit）。
**既知所見**: 操作停止後、赤線 overlay 表示までほんの短い lag あり — probe ゲート（Recharts scales ↔ committed domain 一致待ち）が主因。固定 ms マージンではない。
Phase 4 で **ハンドオフ品質**（フラッシュ防止・settling 体感・200ms SLA 厳密検証）を設計し、本 REQ 全体の実機検証クローズまで持っていく。

## 今回決めたいこと
本 REQ の **Phase 4 のみ** について設計レビューし、実装チャット用の承認済み完成プロンプトを出力する。
Phase 5（30fps cap 削除等）は follow-up として概要確認のみ。

### レビュー観点（必須）
1. **settling シーケンス** — commit → domain 更新 → ChartMetricsBridge → probe 合格 → Canvas 非表示 + Line + overlay の現状 gap と改善余地
2. **案 A 維持 vs 拡張** — `canvasVisible = isMapInteracting || !overlayLayoutReady` を維持したままフラッシュ/ lag をどう詰めるか
3. **200ms SLA** — 計測方法（Performance API / 主観 / 自動テストの可否）、合格基準、ホイール idle 150ms との関係
4. **Canvas ↔ Recharts Line 切替** — strokeOpacity 0→1 と canvas visibility のタイミング。二重描画・線ジャンプ防止
5. **小丸の連続性** — 操作中 Canvas 小丸 → settling → overlay SVG 小丸（2.5px 常時）。赤線・ラベル復帰との視覚連続性
6. **probe ゲート** — 緩和せずに lag を短くできるか（rAF リトライ最適化、commit タイミング等）。**撤廃は不可** が前提
7. **ホイール窓中心**（`6ac05a9`）— Phase 4 検証項目への影響（退行なし確認）
8. **Phase 4 / Phase 5 境界** — 30fps cap 削除・ReferenceArea 操作中 defer 正式化は Phase 5 に残すか
9. **未決事項** — 判断が必要な点を質問形式で列挙

## 確認してほしいファイル
- desktop-app/app/components/RaceDetailChart.tsx（overlayLayoutReady・canvasVisible・rechartsLinesVisible・ChartMetricsBridge）
- desktop-app/app/hooks/useChartViewInteraction.ts（commitLiveView・MAP_INTERACTION_WHEEL_IDLE_MS・wheelZoomAnchor）
- desktop-app/app/hooks/useInteractionCanvasLoop.ts（settling 中 idleCartesian + committedViewState 描画）
- desktop-app/app/lib/raceGraphBuilder.ts（plotMetricsScalesMatchWindow・probe  tolerance）

## 触らないこと（設計上も変更提案に含めない）
- applyWheelZoom / applyPanDrag / visibleWindowFromViewState の **数学ロジック**変更
- probe ゲートの **撤廃**
- Recharts Line 完全廃止（Phase 6 follow-up）
- 操作中 overlay 赤線・ラベル（P2 Backlog）
- 30fps cap コード削除（Phase 5 follow-up）
- WASM / OCR / src-tauri
- expandSkillRows checkbox 削除（map-view ステップ 3）

## 報告形式（CHAT_TEMPLATE.md に準拠）
1. 現状整理 — Phase 3 完了状態と settling の gap（lag の正体）
2. 選択肢比較 — フラッシュ/lag 対策案（簡潔。案 A 維持前提）
3. 推奨案（1つ）— Phase 4 確定仕様
4. 変更計画 — ファイル / 責務 / 触る・触らない
5. **Phase 4 / Phase 5 境界**
6. リスク・未決事項 — 質問形式
7. 検証手順 — Phase 4 実機チェックリスト（200ms SLA・フラッシュ・退行）
8. 実装チャット用完成プロンプト — CHAT_TEMPLATE パターン A（▼ここからコピー / ▲ここまで）

## スコープ（REQ Phase 4 要約）
### やること
- settling ハンドオフ品質（案 A ベースのチューニング）
- 停止後 200ms 以内 overlay probe 合格・赤線↔速度線 OK（厳密検証）
- commit 瞬間のフラッシュ・線ジャンプ抑制（主観 OK）
- 本 REQ 全体の実機検証クローズ
- npm run build 通過

### やらないこと
- probe 撤廃
- 30fps cap 削除
- Recharts Line 廃止
- 操作中 overlay フル表示
```

---

## 設計レビュー起票プロンプト（Phase 3 — Canvas レイヤー配線）

```
@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-race-detail-graph.md
@docs/tasks/REQ-race-detail-graph-interaction-engine.md
@desktop-app/app/components/RaceDetailChart.tsx
@desktop-app/app/hooks/useChartViewInteraction.ts
@desktop-app/app/lib/chartLineRenderer.ts
@desktop-app/app/lib/raceGraphBuilder.ts

## チャット種別
設計レビュー（Ask mode）

## 進め方（重要）
- このチャットでは **コード変更・ファイル編集・コミットを一切しない**
- 現状整理 → 方針提案 → 変更範囲 → リスク → 検証手順 まで提示する
- 私が「承認」「修正」「見送り」のいずれかを返すまで、実装に進まない

## 背景
Interaction Canvas Engine Phase 1（chartLineRenderer.ts・`8767b1a` 以前 `5693968`）と Phase 2（liveViewRef 分離・deferDomainCommit・`8767b1a`）が完了。
Phase 2 実機検証（軽量）: ドラッグ離し・ホイール停止・dblclick OK。操作中 Recharts 折れ線固定は期待どおり。Profiler は省略。
Phase 3 で操作中の視覚追従を Canvas rAF に接続し、Maps 級の体感を実現する。

## 今回決めたいこと
本 REQ の **Phase 3 のみ** について設計レビューし、実装チャット用の承認済み完成プロンプトを出力する。
Phase 4（ハンドオフ品質）は概要確認のみ。Phase 3 実装スコープに含めない。

### レビュー観点（必須）
1. **useInteractionCanvasLoop API** — options 設計、rAF 開始/停止条件、DPR・resize 扱い
2. **RaceDetailChart 配線** — canvas 要素の DOM 位置・z-index・chartAreaRef との関係
3. **canvasVisible / rechartsLinesVisible** — 案 A（`isMapInteracting || !overlayLayoutReady`）の Phase 3 適用範囲
4. **liveViewRef / interactionCartesianRef の取得** — hook から destructuring するタイミングと null ガード
5. **Recharts Line strokeOpacity:0** — 6 系列・compare baseline。ChartMetricsBridge は触らない方針の維持
6. **ReferenceArea / phaseLines / Tooltip defer** — Phase 3 で非表示にする条件と既存 overlay defer との整合
7. **スキル発動点小丸** — drawSkillActivationDots 条件、layoutSkillMarkers 非使用、半径・色
8. **Phase 3 と Phase 4 の境界** — settling・probe 合格後の Canvas 非表示は Phase 3 でどこまでやるか
9. **未決事項** — 判断が必要な点を質問形式で列挙

## 確認してほしいファイル
- desktop-app/app/components/RaceDetailChart.tsx（LineChart・ChartMetricsBridge・overlayLayoutReady・isMapInteracting）
- desktop-app/app/hooks/useChartViewInteraction.ts（liveViewRef・interactionCartesianRef・commitLiveView）
- desktop-app/app/lib/chartLineRenderer.ts（drawChartLines・drawSkillActivationDots・resizeCanvasToDisplaySize）
- desktop-app/app/lib/raceGraphBuilder.ts（visibleWindowFromViewState・buildInteractionPlotMetrics）

## 触らないこと（設計上も変更提案に含めない）
- applyWheelZoom / applyPanDrag / svgToPercent / probe 関数群のロジック変更
- overlay probe ゲートの撤廃・緩和
- Phase 4 ハンドオフの本格実装（Phase 3 では最小限の canvasVisible のみ）
- 30fps cap コード削除（Phase 5 follow-up）
- WASM / OCR / src-tauri
- ステップ 3 暫定 UI 削除（expandSkillRows checkbox）

## 報告形式（CHAT_TEMPLATE.md に準拠）
1. 現状整理 — Phase 2 完了状態と Phase 3 接続点
2. 選択肢比較 — rAF ループ・canvas 配置・Line 非表示の案（簡潔）
3. 推奨案（1つ）— Phase 3 確定仕様
4. 変更計画 — ファイル / 責務 / API 確定版
5. **Phase 3 / Phase 4 境界** — settling で Phase 3 が担う範囲
6. リスク・未決事項 — 質問形式
7. 検証手順 — Phase 3 実機チェックリスト（視覚追従が確認できる項目中心）
8. 実装チャット用完成プロンプト — CHAT_TEMPLATE パターン A（▼ここからコピー / ▲ここまで）

## スコープ（REQ Phase 3 要約）
### やること
- useInteractionCanvasLoop.ts 新規（rAF・DPR・drawChartLines 呼び出し）
- RaceDetailChart: canvas 要素、liveViewRef 配線、Line strokeOpacity:0
- 操作中 ReferenceArea / phaseLines 非表示
- スキル発動点小丸（drawSkillActivationDots）
- npm run build 通過

### やらないこと
- Phase 4 フラッシュ防止の本格チューニング
- Recharts Line 完全廃止
- 操作中 overlay 赤線・ラベル
- probe ゲート変更
```

---

## 設計レビュー起票プロンプト（Interaction Canvas Engine）

```
@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-race-detail-graph.md
@docs/tasks/REQ-race-detail-graph-map-view.md
@docs/tasks/REQ-race-detail-graph-performance.md
@docs/tasks/REQ-race-detail-graph-map-view-perf-fallback.md
@docs/tasks/REQ-race-detail-graph-interaction-engine.md
@desktop-app/app/components/RaceDetailChart.tsx
@desktop-app/app/hooks/useChartViewInteraction.ts
@desktop-app/app/lib/raceGraphBuilder.ts

## チャット種別
設計レビュー（Ask mode）

## 進め方（重要）
- このチャットでは **コード変更・ファイル編集・コミットを一切しない**
- 現状整理 → 方針提案 → 変更範囲 → リスク → 検証手順 まで提示する
- 私が「承認」「修正」「見送り」のいずれかを返すまで、実装に進まない

## 背景
Google Map 型グラフ UI はステップ 2 + overlay 同期 + 30fps domain cap（perf fallback）まで実機クローズ済み（`5053012`〜`a1ac811`）。
体感は改善したが、ユーザーは **Google Maps 級（60fps 近傍）** を要求。単純チューニング延長では妥協しない方針で、**Dual-Viewport（操作中 Canvas / 停止後 Recharts）** の構造変更を採用する。

## 今回決めたいこと
本 REQ（`REQ-race-detail-graph-interaction-engine.md`）の **Phase 1〜4** について設計レビューし、実装チャット用の承認済み完成プロンプトを出力する。

### レビュー観点（必須）
1. **Dual-Viewport アーキテクチャ** — 操作中 Canvas + idle Recharts の分離は妥当か。代替案（CSS transform 等）との比較
2. **Phase 1 API** — `chartLineRenderer.ts` の関数分割・linear vs monotone 整合方針
3. **Phase 2 liveView 分離** — `useChartViewInteraction` の synthetic metrics（固定 cartesian + live window）でホイール入力をどう組むか
4. **Phase 3 配線** — Canvas 配置、Recharts Line 非表示時の ChartMetricsBridge 挙動
5. **Phase 4 ハンドオフ** — フラッシュ防止（案 A/B/C から1つに絞る）、`overlayLayoutReady` との同期シーケンス
6. **退行防止境界** — 赤線↔速度線、percent 3 系列、compare、ダブルクリックリセット
7. **30fps cap 移行** — いつ削除するか、Phase ごとのロールアウト
8. **未決事項** — 判断が必要な点を質問形式で列挙

## 確認してほしいファイル
- desktop-app/app/components/RaceDetailChart.tsx（LineChart・ChartMetricsBridge・overlayLayoutReady）
- desktop-app/app/hooks/useChartViewInteraction.ts（30fps cap・commitPendingViewStateNow）
- desktop-app/app/lib/raceGraphBuilder.ts（ChartViewState・visibleWindow・applyWheelZoom）

## 触らないこと（設計上も変更提案に含めない）
- applyWheelZoom / applyPanDrag / svgToPercent 等の pan/zoom ロジック変更
- overlay probe ゲートの撤廃・緩和
- ステップ 3 暫定 UI 削除（expandSkillRows checkbox）
- WASM / OCR / src-tauri

## 報告形式（CHAT_TEMPLATE.md に準拠）
1. 現状整理 — ボトルネックと既存資産
2. 選択肢比較 — Dual-Viewport vs 代替（簡潔）
3. 推奨案（1つ）— Phase 1〜4 の確定仕様
4. 変更計画 — ファイル / 責務 / API 確定版
5. ハンドオフ戦略 — settling シーケンス（ステップ図可）
6. リスク・未決事項 — 質問形式
7. 検証手順 — Phase 別チェックリスト
8. 実装チャット用完成プロンプト — CHAT_TEMPLATE パターン A（▼ここからコピー / ▲ここまで）

## スコープ（REQ 要約）
### やること
- Phase 1: chartLineRenderer.ts
- Phase 2: liveView 分離（操作中 setViewState なし）
- Phase 3: Canvas + rAF ループ
- Phase 4: ハンドオフ・実機検証クローズ

### やらないこと
- Recharts 完全除去、WebGL、操作中 overlay 赤線表示
```
