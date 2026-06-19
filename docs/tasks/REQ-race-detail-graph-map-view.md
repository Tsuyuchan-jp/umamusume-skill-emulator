# REQ-race-detail-graph-map-view: Google Map 型グラフ UI（等倍ズーム + 2D パン）

> **レース詳細グラフ Phase 5 の最終ゴール正本。**
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
> 前提: Phase 4 baseline diff・スキル Tooltip・Phase 5-R1 / R1b の知見（下記「現行コードとの関係」）
>
> **本 REQ は [`REQ-race-detail-graph-time-window.md`](REQ-race-detail-graph-time-window.md)（R2）および [`REQ-race-detail-graph-pan-zoom.md`](REQ-race-detail-graph-pan-zoom.md)（R3）を統合・置換する。**

- **ステータス**: done
- **作成日**: 2026-06-18 21:01
- **関連コミット**: `aca5f6f`（ステップ 1）、`91e76cb`（ステップ 2）、`f8a62f0`（percent 軸追従）、`ee6d460`（ステップ 3）、Phase 5 ステップ 4 実機検証クローズ（2026-06-19 18:45）

---

## 目的

レース詳細グラフを **Google Map 型の操作感** に統一する。

- **起動時**: レース全体を俯瞰（速度・体力・スキル発動の流れを一望）
- **ホイール**: 可視窓 center（画面中心）で **XY 等倍ズーム**（2026-06-19 採用。旧: カーソル中心）
- **ドラッグ**: **2D パン**（時間軸・速度軸方向をまとめて移動）
- **分析**: ズームインした視野で、赤線左端＝速度折れ線上の発動地点を読み取れる

`expandSkillRows`（縦拡大）checkbox や **Y だけ 4 倍（K=4 固定）** といった暫定 UI は廃止し、操作と座標を一本化する。

---

## ユーザー意図（合意・変更不可）

| 項目 | 内容 |
|------|------|
| ズーム | X・Y **同じ倍率**（等倍スケール）。速度線の傾き・スキルと赤線の相対位置がズーム後も崩れない |
| パン | 横ドラッグだけでなく **縦横まとめて** 移動（Google Map と同型） |
| 俯瞰 | ズーム最小＝レース全体。スキルは重なり **概ね許容**、同時刻のみ軽い Y ずらし |
| 拡大 | ズームを上げるとスキル可読性が上がる。赤線↔速度線の整合は **全ズームレベルで維持** |
| 廃止 | 縦拡大 checkbox、K=4 固定トグル、Y だけ伸ばす縦スクロール分析、固定 px reserve の場当たり調整 |

---

## 背景：なぜ作り直すか

### 暫定方式の限界（Phase 5-R1〜R1b 以降）

現行の「縦拡大 ON」は **Y 方向だけ** キャンバスを `K=4` 倍し、X は常にレース全時間を表示する。Google Map 型ではない。

Recharts `LineChart` と overlay SVG の **二重座標** を、`LEGEND_RESERVE` / `XAXIS_RESERVE` 等の **固定 px** で近似しており、K や viewport が変わるとズレが増幅する（5-R1b ポリッシュで顕在化）。

### 段階分割（旧 R2 / R3）とのずれ

旧 R2（X だけ時間窓）+ 旧 R3（Y/K 連動）は、目的文では Google Map 型としていたが、仕様が **X 窓・Y スクロール・K しきい値 layout 切替** と混在していた。本 REQ で **等倍ズーム + 2D パン** を正本とする。

---

## スコープ

### やること

#### 1. ビュー状態（単一の正本）

```typescript
/** グラフの表示変換。scale=1 がレース全体の初期俯瞰（ステップ 2 承認済み） */
interface ChartViewState {
  /** 等倍ズーム倍率。1 = 俯瞰、>1 = 拡大。上限 CHART_VIEW_SCALE_MAX（24） */
  scale: number;
  /** 可視窓中心（秒） */
  centerTime: number;
  /** 可視窓中心（m/s） */
  centerSpeed: number;
  /** 可視窓中心（percent 軸 0〜1）。既定 0.5 */
  centerPercent: number;
}

/** scale=1 かつレース全体が viewport に収まる初期値を race から算出 */
function createInitialChartViewState(raceEnd: number): ChartViewState;
```

- 内部正本は **center + scale**（旧 `panX` / `panY` は採用しない）
- `scale` は **連続値**（固定 K=4 やしきい値での ON/OFF 切替はしない）
- ホイールは **可視窓 center** で `scale` を増減（`k=1.2` / `k≈0.833`）
- ドラッグは `centerTime` / `centerSpeed` を更新（2D パン）
- ダブルクリックで **リセット**（`scale=1`、全体表示）。ステップ 2 必須
- 任意: **「終盤へ」** ショートカット（ステップ 2 スコープ外）
- `expandSkillRows` ON 時は map 操作無効（legacy K=4 維持）。ステップ 3 で checkbox 削除

#### 2. 座標の正本（ChartPlotMetrics）

Recharts の cartesian 矩形と overlay を **同一変換** で結ぶ。

```typescript
interface ChartPlotMetrics {
  /** Recharts が折れ線を描く矩形（実測 or Customized offset） */
  cartesian: { left: number; top: number; width: number; height: number };
  /** 現在の viewState */
  view: ChartViewState;
  /** 表示中の時間範囲（秒） */
  timeMin: number;
  timeMax: number;
  /** 速度軸 domain（拡大時は可視窓） */
  speedMin: number;
  speedMax: number;
  /** percent 軸 domain（拡大時は可視窓。scale=1 で [0,1]） */
  percentMin: number;
  percentMax: number;
}

function timeToSvgX(time: number, m: ChartPlotMetrics): number;
function speedToSvgY(speed: number, m: ChartPlotMetrics): number;
function svgToTime(x: number, m: ChartPlotMetrics): number;
function svgToSpeed(y: number, m: ChartPlotMetrics): number;
```

- **固定 `LEGEND_RESERVE` / `XAXIS_RESERVE` への依存を廃止**（フォールバック初期値のみ可）
- `layoutSkillMarkers` / `skillMarkersToPx` / ドラッグヒット判定は **すべて ChartPlotMetrics 経由**
- 実装優先: Recharts `Customized` の `offset` または `useLayoutEffect` + `getBoundingClientRect`

#### 3. 描画アーキテクチャ（ステップ 2 承認済み）

- **採用: domain 駆動可視窓（center + scale）+ ChartPlotMetrics 同期**
  - 速度–時間平面では transform 等倍ズームと数学的同等
  - `ChartMetricsBridge`（`usePlotArea` + `useXAxisScale` + `useYAxisScale`）が返す `scales` を pixel 変換の正本とする
  - transform 親は使わない
- **全軸連動ズーム（パターン B）**: 時間・速度・percent を **同じ `scale`** で可視窓を狭める
  - 例: `halfT = raceEnd/(2*scale)`, `halfS = (SPEED_MAX-SPEED_MIN)/(2*scale)`, `halfP = 0.5/scale`
  - `scale=1` では俯瞰（時間全体・速度 13–30・percent 0–100%）
- **UI chrome 固定**: Legend・checkbox 行・区間ピルは transform しない。軸目盛は可視 domain に追従

#### 4. スキルレイアウト（全 scale で共通ロジック）

| ズーム | 赤線↔速度線 | 同時刻スタック | X 被り |
|--------|-------------|----------------|--------|
| 低（俯瞰） | **一致**（`markerLineY_px` 系） | **compact**（`COMPACT_STACK_STEP` 16px 程度） | 許容 |
| 高（拡大） | **一致** | compact + 必要なら full 段（`STAGGER_ROW × scale` 等は設計で決定） | 案3 維持（X 重なり時同一 stackLevel 不可） |

- **ON/OFF で layout パスを分けない**（`useDetailAnchorLayout` の expanded 分岐を廃止方向）
- フォント・hit box・赤線 gap は **px 固定**（scale で typography だけ巨大化しない）
- 5-R1b の知見を流用: 赤線左端＝速度線上、ラベルは赤線上、同時刻のみ `yStackOffset`

#### 5. UI 変更

- [x] `GraphDisplayState` から `expandSkillRows` を削除
- [x] checkbox 行の「縦拡大」を削除
- [x] dev 用 `Y zoom: 4.00` 表示を削除
- [x] `computeDetailYZoomFactor` / `DETAIL_ZOOM_FIXED` / Y だけの `contentChartHeight` 倍率を削除
- [x] 操作ヒント（「ドラッグで移動・ホイールで拡大・ダブルクリックでリセット」）

#### 6. 退行防止

- [ ] Phase 4 baseline compare（破線）
- [ ] スキル hover Tooltip・ピル
- [ ] 区間帯・phase 線・表示 checkbox（速度/体力/レーン/スキル/デバフ）
- [ ] `npm run build` 通過

### やらないこと

- WASM `skillEvents` スキーマ変更
- OCR / パレット / `src-tauri/`
- ラベル X オフセット（発動時刻の横位置はずらさない）
- 2 層キャンバス（速度層と Gantt 完全分離）
- 旧 R2 単独（X だけ窓）の先行リリース

### 将来拡張（ステップ 2 では実装しない）

- **上級者向けトグル「体力・レーンは常に 0〜100% 表示」**（パターン A 相当）
  - ステップ 2 ではパターン B（percent も `scale` 連動）を正本として実装する
  - 将来トグル ON 時は `percentDomain = [0, 1]` 固定に上書きするだけで足せる設計にする（`lockPercentFullRange` 等）
  - トグル実装時は `visibleWindowFromViewState` の percent 分岐と `YAxis(percent)` domain 1 行が主な差分

---

## 現行コードとの関係

| 既存 | 本 REQ での扱い |
|------|----------------|
| [`REQ-race-detail-graph-skill-layout-sync.md`](REQ-race-detail-graph-skill-layout-sync.md) | シリーズ文脈・決定ログは参照。**実装の正本は本 REQ へ移管** |
| [`REQ-race-detail-graph-analysis-revert.md`](REQ-race-detail-graph-analysis-revert.md) R1 | **完了・知見利用**。K=4 固定 UI は廃止 |
| [`REQ-race-detail-graph-same-time-stack-compact.md`](REQ-race-detail-graph-same-time-stack-compact.md) R1b | **完了・知見利用**。detail ON 専用分岐は統合 layout へ |
| `expandSkillRows` / `DETAIL_ZOOM_FIXED=4` | **廃止** |
| `SKILL_CHART_LEGEND_RESERVE` / `XAXIS_RESERVE` | **廃止方向**（metrics 実測へ） |
| 5-R1b ポリッシュ（`a8744ef` 等） | **暫定**。本 REQ 着手時に metrics 基準へ置換 |

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/components/RaceDetailChart.tsx` | viewState、ホイール/ドラッグ、transform 層、checkbox 削除、metrics 取得 |
| `desktop-app/app/lib/raceGraphBuilder.ts` | ChartPlotMetrics、座標変換一本化、layout 統合、旧 zoom 定数削除 |
| `docs/TODO.md` | Backlog / 完了 |
| `docs/tasks/REQ-race-detail-graph.md` | ロードマップ行更新 |

---

## 実装の推奨順（同一 REQ 内。別 REQ には分割しない）

1. **ChartPlotMetrics + scale=1** — 俯瞰で赤線↔速度線一致・同時刻 compact（旧 OFF 相当を正しく）
2. **ホイール等倍ズーム + 2D パン** — viewState 配線、transform or domain
3. **暫定 UI 削除** — 縦拡大 checkbox、K=4、dev 表示、固定 reserve
4. **実機検証** — 50+ スキル終盤、baseline compare、リセット

---

## 完了条件

- [x] `docs/TODO.md` Backlog に本 REQ リンク（起票済み）
- [x] 起動時にレース全体が俯瞰表示される（`scale=1`）
- [x] ホイールで可視窓 center に **XY 等倍** ズームできる
- [x] ドラッグで **2D パン** できる
- [x] 全ズームレベルで赤線左端が速度折れ線上に乗る
- [x] 同時刻スキルが compact 段で読める（俯瞰でも最低限）
- [x] 縦拡大 checkbox がなく、操作だけで俯瞰→分析に遷移できる
- [x] Phase 4 compare / Tooltip / 表示 checkbox に退行なし
- [x] `npm run build` 通過
- [x] ユーザー実機確認（ステップ 4 検証手順 1〜7 すべて OK / 2026-06-19 18:45）
- [x] REQ `done` + コミット

---

## 検証手順

1. シミュ実行後、グラフがレース全体表示（checkbox 縦拡大なし）
2. 終盤へホイールアップ → スキル名・赤線が読める密度。速度線の傾きが不自然に横潰れ/縦伸びしない
3. ドラッグで終盤〜中盤を 2D に追える
4. 同時刻複数スキルで compact スタック。赤線が速度線から外れない
5. ダブルクリック or リセットで全体に戻る
6. baseline compare ON、スキル Tooltip、区間 checkbox
7. ウィンドウリサイズ後も赤線整合が維持されること

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-18 21:01 | **本 REQ を Phase 5 最終ゴール正本とする**。旧 R2/R3 を superseded | ユーザー合意: Google Map 型（等倍 XY ズーム + 2D パン）が意図。段階分割が実装を逸らした |
| 2026-06-18 21:01 | 座標正本は **ChartPlotMetrics**（cartesian 実測 + viewState）。固定 px reserve は廃止方向 | K=4・パンで破綻。OFF(scale=1) で揃えた変換式を scale/pan に拡張する |
| 2026-06-18 21:01 | スキル layout は **scale によらず同一ロジック**（赤線アンカー + 同時刻 compact） | ON/OFF 二重パスがズレの温床。5-R1b 知見は統合して流用 |
| 2026-06-18 21:01 | `expandSkillRows` / `DETAIL_ZOOM_FIXED` / Y 単独クローズアップを廃止 | 暫定 UI。最終操作はホイール+ドラッグのみ |
| 2026-06-18 21:22 | **ステップ 1 完了**: ChartPlotMetrics + Recharts Customized 実測、統合 layout（赤線アンカー + 同時刻 compact + 案3）、scale=1 固定 | 固定 LEGEND/XAXIS reserve を OFF 経路から除去。ステップ 2 で viewState 配線 |
| 2026-06-18 21:49 | **ステップ 1 フォローアップ**: `Customized` offset 廃止 → `usePlotArea` + `useYAxisScale('speed')` + `useXAxisScale` を正本に | Recharts 3 で offset 未注入。速度依存 Y ずれ（序盤大・終盤小）を scale 一本化で解消 |
| 2026-06-18 22:49 | **ステップ 2 設計承認**: domain 駆動（center+scale）、`CHART_VIEW_SCALE_MAX=24`、ホイール `k=1.1`、ダブルクリックリセット、リサイズは center 維持+clamp、イベントは `chartAreaRef` のみ | ステップ 1 資産（ChartMetricsBridge/scales）を維持。`expandSkillRows` ON 時は map 無効 |
| 2026-06-18 22:49 | **percent 軸はパターン B**（時間・速度と同じ `scale` で可視窓連動）。将来トグルでパターン A（0–100% 固定）を足せる設計 | 全系列の見た目一貫性（Google Map 型）。将来コストは B 土台 + A 上書きが最小 |
| 2026-06-18 23:01 | **ステップ 2 実装完了**: `ChartViewState`（center+scale）、`visibleWindowFromViewState`、ホイール `k=1.1` カーソル中心ズーム、2D パン、ダブルクリックリセット、`useChartViewInteraction`、全軸 domain 配線、`expandSkillRows` ON 時 legacy 無効 | 設計承認どおり domain 駆動。`npm run build` 通過。実機検証はステップ 4 |
| 2026-06-18 23:26 | **percent 軸フォローアップ**: 実機でレーンのみ拡大されない問題。`applyWheelZoom` / `applyPanDrag` で `centerPercent` をカーソル追従・縦パン連動（`svgToPercent` 追加） | ステップ 2 は centerPercent 固定の暫定だった。体力・レーンは右軸共有のため同じ画面 Y で percent 変換が必要 |
| 2026-06-18 23:30 | **percent 軸追従の実機検証クローズ**（終盤ホイールで速度・体力・レーン同時拡大、縦パンでレーン付近追従、赤線整合、ダブルクリックリセット） | ユーザー実機確認 1〜4 すべて OK |
| 2026-06-18 23:40 | **ズーム操作レスポンス改善（Step A+B）**: `useChartViewInteraction` に rAF バッチ（wheel/pointermove 各 1 frame 最大 1 commit）、`MAP_INTERACTION_WHEEL_IDLE_MS=150`、返り値 `isMapInteracting`。`RaceDetailChart` で metrics null リセット deps から `chartViewState`/`visibleWindow` 除外、操作中は `layoutSkillMarkers`/`skillMarkersToPx`/getBBox/overlay SVG を defer | ステップ 2 機能は検証済み。Recharts domain 駆動・percent ロジックは変更なし。実機検証は別チャット |
| 2026-06-18 23:54 | **overlay 復帰ずれ修正 + 将来レベル方針**: 操作終了時 `commitPendingViewStateNow`、overlay は `chartViewStatesEqual(plotMetrics.view, metricsViewState)` まで defer。操作中 overlay の中間（赤線のみ）・理想（赤線+ラベル）は **別タスク**（TODO P2 Backlog） | 実機: 停止直後にずれ・クリックで直る症状。最小レベル（全非表示）は維持 |
| 2026-06-19 00:35 | **overlay scales 同期修正**: `plotMetricsScalesMatchWindow` probe（domain 端点 ↔ cartesian）、`visibleWindowsEqual`、`handlePlotMetrics` dedup 廃止、ChartMetricsBridge rAF リトライ、ダブルクリック `onViewReset` で measured null、stale measured 自動無効化 | 実機: ズーム後リセットで俯瞰ずれ・単独スキルでもずれ。view 一致だけでは不十分と判明 |
| 2026-06-19 00:40 | **follow-up**: `plotMetricsEquivalent` で scale 端点出力比較 + dedup 復活。無条件 setState と invalidation effect が Maximum update depth を招いたため除去 | probe ゲートは維持 |
| 2026-06-19 00:46 | **ズーム操作レスポンス + overlay 同期の実機検証クローズ**（俯瞰・拡大→ダブルクリック俯瞰・パン停止後・単独 stack0 各拡大率で赤線↔速度線 OK） | `98c0cea`〜`a1dd542`。次はステップ 3 暫定 UI 削除 |
| 2026-06-19 01:03 | **perf fallback を sibling REQ へ分離**（[`REQ-race-detail-graph-map-view-perf-fallback.md`](REQ-race-detail-graph-map-view-perf-fallback.md)）: 操作中 domain commit 30fps cap | Step A+B 後もホイール/2D ドラッグのもたつき残存。設計レビュー承認済み |
| 2026-06-19 17:09 | **ホイールズーム中心を可視窓 center に変更**（カーソル位置 → `centerTime/Speed/Percent`）。`applyWheelZoom` 数学は不変 | Phase 3 実機後・Phase 4 前の UX 試行。画面中心で XY 等倍拡大 |
| 2026-06-19 17:28 | **ホイール窓中心を採用確定**（実機検証クローズ）。視認性・操作性が大幅改善 | map-view 正本を窓中心に更新 |
| 2026-06-19 01:12 | **perf fallback 実機検証クローズ**（30fps cap。体感改善・overlay 復帰・退行なし） | `5053012`〜`cba1f4c`。次はステップ 3 暫定 UI 削除 |
| 2026-06-19 01:19 | **Interaction Canvas Engine を sibling REQ に起票**（[`REQ-race-detail-graph-interaction-engine.md`](REQ-race-detail-graph-interaction-engine.md)）: Dual-Viewport Phase 1〜4 | Maps 級を目指す構造変更。設計レビュー待ち |
| 2026-06-19 18:15 | **ホイール 1 ノッチ倍率を 1.1 → 1.2 に引き上げ**（`CHART_VIEW_WHEEL_ZOOM_FACTOR`） | 実機所感: 1 ノッチあたりの拡大縮小が弱い。連続ホイール改善後の UX 調整 |
| 2026-06-19 18:18 | **ホイール 1.2 倍率の実機検証クローズ** | ユーザー OK。次はステップ 3 暫定 UI 削除 |
| 2026-06-19 18:27 | **ステップ 3 完了**: `expandSkillRows` / K=4 legacy 経路 / dev Y zoom 表示を削除。map-view 単一路線（`visibleWindowFromViewState` 常時・viewport 固定高さ・`MAX_STACK_COLLAPSED=4` collapsed layout）。操作ヒント UI 追加。`npm run build` 通過。実機検証はステップ 4 | 設計レビュー承認済み方針どおり。Interaction Canvas / handoff ロジックは不変 |
| 2026-06-19 18:45 | **Phase 5 ステップ 4 実機検証クローズ**（検証手順 1〜7 すべて OK）。REQ `done` | ユーザー実機確認。停止後 overlay 復帰 latency が長く感じる → P2 Backlog「合成 metrics 即時 handoff」を登録 |

---

## 設計レビュー起票プロンプト（ズーム操作レスポンス改善）

```
@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-race-detail-graph-map-view.md
@docs/tasks/REQ-race-detail-graph-performance.md
@desktop-app/app/components/RaceDetailChart.tsx
@desktop-app/app/hooks/useChartViewInteraction.ts
@desktop-app/app/lib/raceGraphBuilder.ts

## チャット種別
設計レビュー（Ask mode）

## 背景
Google Map 型グラフ UI ステップ 2 + percent 軸追従（`f8a62f0`）は実機検証クローズ済み。
機能は OK だが、ホイールズーム・2D ドラッグのレスポンスが非常に重く実用に耐えない。

## 既知のボトルネック候補（レビューで裏取りしてほしい）
1. `chartViewState` 変更のたび `setMeasuredPlotMetrics(null)` → ChartMetricsBridge 再計測 → overlay layout 連鎖
2. ホイール/ドラッグ毎に React setState → Recharts 全 domain 変更 → 数千点 × 複数系列の再描画
3. `pointermove` ごとに `setViewState`（rAF バッチなし）
4. ズーム中も `layoutSkillMarkers`（衝突解決）が毎フレーム実行

## レビューで決めてほしいこと
1. **優先施策の順序**（効果/リスク比）— 例: metrics リセット削減 vs rAF バッチ vs ズーム中 overlay defer
2. **Recharts 維持 vs 部分 escape** — domain 変更コストを下げる現実的な落とし所
3. **インタラクション中の描画品質トレードオフ** — ドラッグ中は折れ線のみ・overlay は pointerup 後でよいか
4. **退行防止** — 赤線↔速度線整合・percent 3 系列連動・baseline compare を壊さない境界
5. **完了条件・検証手順** — 体感と計測（任意: Performance API / React Profiler の見方）

## 触らないこと
- percent 軸の挙動ロジック（検証済み）
- ステップ 3 暫定 UI 削除（別タスク）
- WASM / OCR / src-tauri

## 出力形式
- ボトルネック仮説の優先度表
- 推奨実装方針（1案に絞る。代替案は簡潔に）
- 変更ファイル一覧
- 実装チャット用の承認済み方針ドラフト
```

## 設計レビュー起票プロンプト（ステップ 3 暫定 UI 削除）

```
@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-race-detail-graph-map-view.md
@docs/tasks/REQ-race-detail-graph-interaction-engine.md
@desktop-app/app/components/RaceDetailChart.tsx
@desktop-app/app/lib/raceGraphBuilder.ts
@desktop-app/app/hooks/useChartViewInteraction.ts

## チャット種別
設計レビュー（Ask mode）

## 進め方（重要）
- このチャットでは **コード変更・ファイル編集・コミットを一切しない**
- 現状整理 → 削除対象の洗い出し → 方針提案 → 変更範囲 → リスク → 検証手順 まで提示する
- 私が「承認」「修正」「見送り」のいずれかを返すまで、実装に進まない
- 承認後は CHAT_TEMPLATE.md「承認後・実装チャット用」の完成プロンプトを1ブロックで出力する

## 背景
Google Map 型グラフ UI（[`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md)）の Phase 5 本線。
ステップ 1（ChartPlotMetrics + scale=1 俯瞰）・ステップ 2（等倍 XY ズーム + 2D パン）・percent 軸追従・ズームレスポンス改善・Interaction Canvas Phase 1〜4・連続ホイール idle 300ms・ホイール倍率 1.2 は **すべて実機検証クローズ**。
**次はステップ 3**: 旧「縦拡大」暫定 UI と legacy 経路の削除。操作はホイール+ドラッグ+ダブルクリックリセットのみに一本化する。

## 今回決めたいこと
1. **削除スコープの確定** — 何を消し、何を残すか（下記「暫定 UI 候補」の取捨選択）
2. **layout 統合方針** — `layoutSkillMarkers({ expanded, yZoomFactor })` の expanded 分岐を map-view 単一路線に統合する方法
3. **chart 高さ・scroll コンテナ** — `isExpanded` 廃止後の `contentChartHeight` / 縦スクロール / viewport 固定の扱い
4. **dead code 削除範囲** — `DETAIL_ZOOM_FIXED` / `computeDetailYZoomFactor` / `computeExpandedChartHeight` / `legacyFullVisibleWindow` 等
5. **退行防止境界** — Interaction Canvas（Dual-Viewport）・overlay handoff 200ms SLA・compare・Tooltip・表示 checkbox との整合
6. **任意 UI** — 「ドラッグで移動・ホイールで拡大」ヒントを入れるか

## 暫定 UI 候補（REQ 5. UI 変更より）
| 対象 | 現状 |
|------|------|
| `GraphDisplayState.expandSkillRows` | checkbox「縦拡大」。ON 時 map 操作無効 |
| `isExpanded` 分岐（RaceDetailChart） | visibleWindow / metricsViewState / mapInteractionEnabled / chart 高さ / scroll / layout 等 |
| `DETAIL_ZOOM_FIXED=4` / `computeDetailYZoomFactor` | Y だけ 4 倍固定 |
| dev `Y zoom: 4.00` 表示 | `process.env.NODE_ENV === "development"` のみ |
| `layoutSkillMarkers({ expanded: true })` | 旧 detail 専用 stack 段 |
| `buildSkillMarkers` の `expandedChartHeight` | 旧縦拡大用高さ算出（利用箇所要確認） |

## 確認してほしいファイル
- `desktop-app/app/components/RaceDetailChart.tsx` — `isExpanded` 分岐の全箇所（約 20+ 参照）
- `desktop-app/app/lib/raceGraphBuilder.ts` — `GraphDisplayState`, layout, DETAIL_ZOOM 系
- `desktop-app/app/hooks/useChartViewInteraction.ts` — `mapInteractionEnabled` 連動
- `desktop-app/app/hooks/useInteractionCanvasLoop.ts` — canvas 高さ連動
- `desktop-app/app/lib/chartLineRenderer.ts` — displayState 参照

## 触らないこと（設計上も変更提案に含めない）
- `applyWheelZoom` / `applyPanDrag` / `visibleWindowFromViewState` の数学
- Interaction Canvas Engine の canvasVisible / handoff probe / 200ms SLA
- probe ゲート（`plotMetricsScalesMatchWindow`）
- 30fps cap（別 follow-up）
- WASM / OCR / `src-tauri`
- ステップ 4 全体実機検証の実行（実装後別チャット）

## 報告形式（この順で）
1. **現状整理** — expanded ON/OFF で何が分岐しているか（表形式推奨）
2. **削除方針** — 推奨案 1 つ + 代替案（簡潔）
3. **変更ファイル一覧** — ファイル × 変更概要
4. **リスク・未決事項** — 実装前にユーザー判断が必要な点
5. **検証手順** — ステップ 3 単体 + ステップ 4 への接続
6. **承認後・実装チャット用完成プロンプト** — CHAT_TEMPLATE 外枠込みで1ブロック（▼ここからコピー〜▲ここまで）

## 完了条件（設計レビュー）
- [ ] 削除対象と残す API が明確
- [ ] map-view 単一路線で赤線↔速度線整合が維持できる根拠
- [ ] Interaction Canvas / overlay handoff 退行リスクが評価済み
- [ ] 実装チャット用完成プロンプトが出力可能
```

## 設計レビュー起票プロンプト（Agent 着手時・初回）

```
@docs/tasks/REQ-race-detail-graph-map-view.md
@desktop-app/app/components/RaceDetailChart.tsx
@desktop-app/app/lib/raceGraphBuilder.ts

Phase 5 最終: Google Map 型グラフ UI。
1) ChartPlotMetrics の取得方法（Customized vs DOM）
2) transform 親 vs domain ズームの選択
3) 実装順 1（scale=1 で赤線整合）から着手
```
