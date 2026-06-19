# REQ-race-detail-graph-overlay-handoff-latency: ホイール停止後 overlay 復帰 latency 短縮

> 親: [`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md)
> 文脈: [`REQ-race-detail-graph-wheel-continuous-zoom.md`](REQ-race-detail-graph-wheel-continuous-zoom.md)（idle 300ms）、[`REQ-race-detail-graph-interaction-engine.md`](REQ-race-detail-graph-interaction-engine.md)（handoff SLA）
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)

- **ステータス**: done
- **作成日**: 2026-06-19 18:55
- **関連コミット**: （完了後に記入）

---

## 目的

連続ホイールの途中 commit なし（[`REQ-race-detail-graph-wheel-continuous-zoom.md`](REQ-race-detail-graph-wheel-continuous-zoom.md)）を **維持** しつつ、ホイール停止後にスキル overlay（赤線・ラベル）が表示されるまでの latency を短縮する。

**症状（Phase 5 ステップ 4 実機検証 2026-06-19）**: 機能・整合はすべて OK。停止後 overlay 表示が ~500ms 程度と長く感じる。

---

## 原因（調査済み）

停止〜overlay 表示は **直列の2段**:

| 段階 | 所要時間 | 内容 |
|------|---------|------|
| ① idle 待機 | 300ms 固定 | `MAP_INTERACTION_WHEEL_IDLE_MS` — 最後の wheel から `commitLiveView` |
| ② Recharts + probe | 数十〜200ms | `overlayLayoutReady` が `measuredPlotMetrics` + `plotMetricsScalesMatchWindow` を待つ |

① は連続ホイール改善（マウス段 100〜200ms 間隔）のため 300ms に延長したトレードオフ。② は Phase 4 handoff で probe ゲートを必須化した結果。

---

## スコープ

### やること

#### 施策 A — 合成 metrics 即時 handoff（主変更）

Recharts scales probe 完了を **overlay 表示のブロッカーから外す**。

1. `commitLiveView` 時に `interactionCartesianRef` を null にする直前に cartesian をスナップショット
2. `onViewCommit({ view, cartesian })` コールバックを wheel idle 終了・pointerup の両経路で呼ぶ
3. `RaceDetailChart` で `handoffPlotMetrics = buildInteractionPlotMetrics(cartesian, view, raceEnd)` を setState
4. `overlayLayoutReady` を handoff 経路で即時 true に（view / visibleWindow 一致）
5. `measuredPlotMetrics` 到着後 probe 確認 → `handoffPlotMetrics` クリア（Phase B・非ブロッキング）
6. `plotMetrics = measuredPlotMetrics ?? handoffPlotMetrics ?? estimatedPlotMetrics`

#### 施策 B — adaptive idle（副変更）

固定 300ms を **直前 wheel イベント間隔** で可変 settle に変更。

| 状況 | settle | 定数（初期値） |
|------|--------|---------------|
| 直前 gap > 180ms（単発 notch / バースト終了） | 短 | `MAP_WHEEL_SETTLE_MS_SHORT = 100` |
| 直前 gap ≤ 180ms（連続バースト中） | 長 | `MAP_WHEEL_SETTLE_MS_LONG = 280` |
| 閾値 | — | `MAP_WHEEL_BURST_GAP_MS = 180` |

- 初回 wheel は LONG を使用
- ドラッグ経路は変更しない（pointerup 即 commit）

### やらないこと

- `applyWheelZoom` / `applyPanDrag` / `visibleWindowFromViewState` の数学変更
- probe ゲート（`plotMetricsScalesMatchWindow`）の完全撤廃
- 操作中 Canvas へのスキル赤線描画（P2 別タスク「中間レベル」）
- Recharts 完全脱却
- 30fps cap 削除
- WASM / OCR / `src-tauri`

---

## 仕様

### overlayLayoutReady（改修後）

**Phase A（即時）**: `!isMapInteracting && handoffPlotMetrics != null && chartViewStatesEqual(handoff.view, chartViewState) && visibleWindowsEqual(handoff, visibleWindow)`

**Phase B（確認）**: `measuredPlotMetrics` が probe OK + view/window 一致 → `handoffPlotMetrics` を null、measured を正本へ

**合成**: handoff あれば即 ready。handoff なし時は従来の measured ゲート。

### canvasVisible / rechartsLinesVisible

既存式を維持。`overlayLayoutReady` が前倒しされることで Canvas 非表示・Recharts/overlay 表示も前倒し。

### dev 計測

`handoff:commit-to-overlay` は Phase A 到達時に計測。SLA 200ms は「commit → overlay 即時表示」として解釈（コメント更新可）。

### リセット・異常系

- ダブルクリック `resetView` / `onViewReset`: `handoffPlotMetrics` を null
- 新 wheel セッション開始: 前 handoff をクリア
- リサイズ effect: handoff も null

### 期待効果

| 操作 | 期待 latency |
|------|-------------|
| 単発 notch 停止 | ~100ms（B）+ 即時 overlay（A） |
| 連続ホイール停止 | ~280ms（B）+ 即時 overlay（A） |
| 連続ホイール中 | 途中 commit なし（現状維持） |

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/hooks/useChartViewInteraction.ts` | adaptive idle、onViewCommit、commitLiveView 改修 |
| `desktop-app/app/components/RaceDetailChart.tsx` | handoffPlotMetrics、overlayLayoutReady 前倒し |
| `desktop-app/app/lib/raceGraphBuilder.ts` | `plotMetricsHandoffCompatible` |
| `desktop-app/app/lib/raceGraphBuilder.test.ts` | handoff metrics 単体テスト |
| `docs/TODO.md` | Backlog / 進行中 / 完了済み |
| `docs/tasks/REQ-race-detail-graph-overlay-handoff-latency.md` | 本 REQ |

---

## 完了条件

- [x] `docs/TODO.md` Backlog に起票と同時に1行追加（起票済み）
- [x] 連続ホイール中に commitLiveView が走らない（SETTLE_LONG > 200ms）
- [x] commit 直後 Recharts probe 前に handoff 経路で overlay 表示可能
- [x] measured 到着後 handoff クリア + probe 確認
- [x] 2D ドラッグ停止後も handoff 即時復帰
- [x] ダブルクリック・compare・Tooltip・checkbox 退行なし（コードレビュー可能）
- [x] `npm run build` 通過
- [ ] ユーザー実機確認
- [x] REQ `done` + コミット

---

## 検証手順

1. マウス段ホイール連続 2〜3 秒 — 途中ひっかかりなし
2. 単発ホイール 1〜2 目盛り — 停止後 ~100ms 台でスキル overlay 表示
3. 連続ホイール停止後 — 現状より overlay 表示が早い
4. 停止直後 — 赤線↔速度線整合（各拡大率）
5. 2D ドラッグ停止後 — overlay 即時復帰・整合
6. ダブルクリック俯瞰・compare ON・percent 3 系列 — 退行なし
7. dev console — `handoff:commit-to-overlay` warn が頻発しない（200ms SLA）

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-19 18:45 | Phase 5 実機検証で overlay 復帰 latency が長いと判明。P2 Backlog 登録 | 連続ホイール 300ms idle + probe 待ちのトレードオフ |
| 2026-06-19 18:55 | **施策 A+B 採用**: 合成 metrics 即時 handoff + adaptive idle | 連続ホイール維持と停止後 ~100ms 台 overlay の両立 |
| 2026-06-19 18:55 | 本 REQ 起票（draft）。実装は別チャット | sibling REQ パターン（wheel-continuous-zoom 準拠） |
| 2026-06-19 19:02 | 実装完了（build + 単体テスト通過）。実機検証はユーザー別チャット | 施策 A: `onViewCommit` + `handoffPlotMetrics` / 施策 B: `wheelSettleMsForGap` |
