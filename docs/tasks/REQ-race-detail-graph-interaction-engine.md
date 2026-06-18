# REQ-race-detail-graph-interaction-engine: Google Map 型グラフ — Interaction Canvas Engine（Dual-Viewport）

> **Google Maps 級の操作レスポンスを目指す構造変更正本。**
> 親: [`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md)
> 文脈: [`REQ-race-detail-graph-performance.md`](REQ-race-detail-graph-performance.md)、[`REQ-race-detail-graph-map-view-perf-fallback.md`](REQ-race-detail-graph-map-view-perf-fallback.md)（30fps cap は移行期フォールバック）
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)

- **ステータス**: draft（設計レビュー待ち）
- **作成日**: 2026-06-19 01:19
- **関連コミット**: （完了後に記入）

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
│  Recharts: domain 固定・Line 非表示（cartesian 実測維持）│
│  ReferenceArea / phaseLines / overlay: defer             │
│  Tooltip: defer                                          │
└─────────────────────────────────────────────────────────┘
                          │
         pointerup / wheel idle / dblclick reset
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Settling（停止直後）                                    │
│  liveView → committed viewState（setState 1 回）         │
│  Recharts domain 更新 → ChartMetricsBridge → probe       │
│  Canvas 最終フレーム維持 → probe 合格後に Canvas 非表示  │
│  overlay 復帰（既存 overlayLayoutReady フロー）        │
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
| **3** | Canvas レイヤー配線 + rAF ループ | 60fps 近傍の主観 OK |
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

### Phase 1 完了条件

- [ ] `drawChartLines` が compare OFF/ON・checkbox 表示切替に対応
- [ ] `resizeCanvasToDisplaySize` で Retina 対応
- [ ] cartesian クリップ矩形内のみ描画
- [ ] **Recharts はまだ変更しない**（単体検証: 同一 window + cartesian でスクリーンショット or 座標サンプル比較）
- [ ] `npm run build` 通過

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
  /** 操作中の最新 view（Canvas rAF 用）。停止後は committed と一致 */
  liveView: ChartViewState;
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

- [ ] 操作中 `setViewState` / Recharts domain 変更が **ゼロ**（React Profiler で確認）
- [ ] 停止時 `commitLiveView` で最新 live が committed に反映
- [ ] `expandSkillRows` ON（map 無効）時は従来どおり cap のみ・live 分離なし
- [ ] `npm run build` 通過

---

## Phase 3 — Canvas レイヤー配線

### 新規ファイル

`desktop-app/app/hooks/useInteractionCanvasLoop.ts`

```typescript
export interface UseInteractionCanvasLoopOptions {
  enabled: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isMapInteracting: boolean;
  /** idle 時に実測された cartesian（操作中固定） */
  cartesian: CartesianRect;
  liveView: ChartViewState;
  raceEnd: number;
  points: GraphPoint[];
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
- `isMapInteracting` 中:
  - Canvas `visible` + `drawChartLines`
  - Recharts `Line` 6 本は `hide={true}` または wrapper `opacity:0`（**ChartMetricsBridge は動かすな** — domain 固定のため Bridge は idle domain のまま）
- `isMapInteracting` 外: Canvas 非表示、Recharts 表示

### ReferenceArea / phaseLines（Phase 3）

- 操作中は **非表示**（`isMapInteracting && null` または `hide`）
- Phase 5 で正式化してもよいが、Phase 3 で入れてよい（コスト低）

### Phase 3 完了条件

- [ ] 50+ スキル終盤でホイール連打・2D ドラッグ 2〜3 秒が **30fps cap 時より明確に軽い**（主観 60fps 近傍）
- [ ] compare ON（6 系列）・percent 3 系列 checkbox 切替が Canvas に反映
- [ ] 操作中 Tooltip 非表示（defer）
- [ ] `npm run build` 通過

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

### フラッシュ防止策（設計レビューで1案に絞る）

| 案 | 内容 | リスク |
|----|------|--------|
| **A（推奨）** | Canvas を `overlayLayoutReady` まで表示。Recharts Line は `opacity:0` → probe 合格後に Line 表示・Canvas 非表示 | 実装が明確 |
| B | commit フレームで Canvas と Recharts を 1 フレーム同時表示（opacity クロスフェード） | 二重描画のチラつき |
| C | settling 中 `isSettling` フラグで overlay も 1 フレーム遅延 | 状態が増える |

### `onViewReset`（ダブルクリック）

- live + committed 即時リセット（現状どおり）
- Canvas クリア + `setMeasuredPlotMetrics(null)` + Recharts 俯瞰

### Phase 4 完了条件（本 REQ 全体完了）

- [ ] 操作中 Recharts `Line` commit **ゼロ**
- [ ] 停止後 **200ms 以内** overlay probe 合格・赤線↔速度線 OK
- [ ] commit 瞬間のフラッシュ・線ジャンプなし（主観）
- [ ] ダブルクリックリセット・compare・percent 3 系列・リサイズで退行なし
- [ ] `expandSkillRows` ON 時 map 操作無効のまま
- [ ] `npm run build` 通過
- [ ] **実機検証クローズ**

---

## ファイル分割（全体）

| ファイル | Phase | 責務 |
|---------|-------|------|
| `app/lib/chartLineRenderer.ts` | 1 | データ→Canvas 折れ線描画。座標変換 pure functions |
| `app/hooks/useChartViewInteraction.ts` | 2 | liveView / committed 分離、入力イベント、commit |
| `app/hooks/useInteractionCanvasLoop.ts` | 3 | rAF ループ、DPR、drawChartLines 呼び出し |
| `app/components/RaceDetailChart.tsx` | 3–4 | canvas 要素、表示切替、settling 連携 |
| `app/lib/raceGraphBuilder.ts` | — | **触らない**（既存 export を import のみ） |

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

- 操作中 overlay 中間レベル（赤線のみ）— P2 Backlog・Phase 6 以降
- WebGL 描画（Canvas 2D で十分な見込み）
- Recharts 完全除去（Phase 4 時点では軸・Tooltip・Legend・ReferenceArea は Recharts 維持）

---

## 検証手順（実機・全 Phase 共通）

1. 50+ スキル終盤 — ホイール連打・2D ドラッグ 2〜3 秒（体感・任意 Profiler）
2. 停止後 200ms 以内 overlay 復帰（赤線↔速度線）
3. percent 3 系列・compare ON・ダブルクリックリセット
4. ウィンドウリサイズ後の整合
5. `expandSkillRows` ON 時 map 操作無効
6. （任意）React Profiler: 操作中 `RaceDetailChart` の commit 回数・時間

---

## 完了条件（REQ 全体）

- [ ] Phase 1〜4 すべて完了
- [ ] 上記検証手順 **実機検証クローズ**
- [ ] `docs/TODO.md` 完了済み・本 REQ `done`

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-19 01:19 | **Interaction Canvas Engine を sibling REQ に起票**。Dual-Viewport（操作中 Canvas / idle Recharts） | 30fps cap 後も Maps 級を目指す。ユーザー合意: 工数可・妥協しない |
| 2026-06-19 01:19 | Phase 1〜4 を本 REQ スコープ。Phase 5〜6 は follow-up | 段階的に退行リスクを抑えつつ効果を早期検証 |
| 2026-06-19 01:19 | pan/zoom 数学・probe ゲート・overlayLayoutReady は不変 | 実機検証済み資産の維持 |

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
