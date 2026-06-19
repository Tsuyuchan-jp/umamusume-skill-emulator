# REQ-race-detail-graph-wheel-continuous-zoom: 連続ホイールズームの途中 commit 除去

> 親: [`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md)
> 文脈: [`REQ-race-detail-graph-interaction-engine.md`](REQ-race-detail-graph-interaction-engine.md)（Phase 4 完了後の UX ポリッシュ）
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)

- **ステータス**: in-progress
- **作成日**: 2026-06-19 17:53
- **関連コミット**: （完了後に記入）

---

## 目的

連続ホイール操作中にズームが**ところどころ止まる（ひっかかる）**体感を解消する。Phase 4 以前から存在し、overlay 表示の問題とは別経路。

**症状（ユーザー実機）**: overlay は出ない。Canvas 上で拡大縮小は追従するが、入力に対してところどころ止まる。

---

## 原因（調査済み）

`MAP_INTERACTION_WHEEL_IDLE_MS=150` により、ホイールイベント間隔が 150ms を超えると `commitLiveView()` が走る。

| 処理 | 影響 |
|------|------|
| `setViewState(liveViewRef)` | Recharts LineChart 全再描画（メインスレッド占有） |
| `wheelActiveRef=false` → `isMapInteracting=false` | Canvas セッション終了。次の wheel まで描画が committed 固定 |
| `interactionCartesianRef=null` | 次 wheel でセッション再開 |

**ドラッグとの非対称**: ドラッグは `pointerup` まで commit しない。ホイールだけスクロールの「息継ぎ」で途中 commit する。マウスホイールの段（クリック感）ではイベント間隔 100〜200ms になりやすく、**1 目盛りごとに settle** が走りうる。

Phase 4（probe リトライ・handoff 計測）とは無関係。Phase 4 実機検証は本件と切り離してクローズ可。

---

## スコープ

### やること

- 連続ホイール中は **ドラッグと同型** に `liveViewRef` + Canvas セッションを維持（途中 `commitLiveView` しない）
- ホイール**完全停止後**に 1 回だけ `commitLiveView` → overlay handoff（Phase 4 資産維持）
- idle 閾値の見直し（マウス段を考慮し **250〜350ms** 程度を実装時に決定。Phase 4 の停止体感目安 350ms と整合）
- 実機検証: マウス段ホイール連打・トラックパッド連続スクロール

### やらないこと

- `applyWheelZoom` / `applyPanDrag` / `visibleWindowFromViewState` の数学変更
- probe ゲート（`plotMetricsScalesMatchWindow`）の撤廃・緩和
- Phase 4 の `canvasVisible` / `rechartsLinesVisible` 式変更
- 30fps cap コード削除（別 follow-up）
- WASM / OCR / `src-tauri`

---

## 仕様（推奨案 A）

### 案 A — ホイール中は commit しない（推奨）

1. `scheduleWheelIdleEnd` のタイムアウトでは **`wheelActiveRef=false` のみ**、または commit を遅延
2. **真の停止**（idle 閾値経過）でのみ `commitLiveView()` + `syncInteracting()`
3. idle 中も `interactionCartesianRef` と `liveViewRef` セッションを維持
4. 定数: `MAP_INTERACTION_WHEEL_IDLE_MS` を延長するか、**commit 用**と **interacting 解除用**を分離（実装時に選択）

### 案 B — 代替

idle で `isMapInteracting` を下ろすが `commitLiveView` は別の長い閾値（例: 300ms）まで遅延。案 A より複雑。

### 退行防止

- 停止後 overlay 復帰・赤線↔速度線（Phase 4 handoff SLA）
- ダブルクリックリセット・compare・percent 3 系列・ホイール窓中心

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/hooks/useChartViewInteraction.ts` | `scheduleWheelIdleEnd` / `commitLiveView` のホイール経路（主変更） |
| `docs/TODO.md` | Backlog / 完了済み |
| `docs/tasks/REQ-race-detail-graph-wheel-continuous-zoom.md` | 本 REQ |

---

## 完了条件

- [ ] 連続ホイール（マウス段・トラックパッド）で途中停止・ひっかかりなし
- [ ] 停止後 overlay 復帰・Phase 4 handoff 退行なし
- [ ] `npm run build` 通過
- [ ] 実機検証クローズ
- [ ] `docs/TODO.md` 完了済み

---

## 検証手順

1. 50+ スキル終盤 — マウスホイールを連続回転（段送り）2〜3 秒。ズームが途切れず追従すること
2. トラックパッド連続ピンチ/スクロール — 同様に滑らかであること
3. 停止後 — 赤線 overlay 復帰・`handoff:commit-to-overlay` warn なし（dev）
4. ダブルクリック俯瞰・compare ON・percent checkbox — 退行なし

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-19 17:53 | 本 REQ 起票。原因は 150ms wheel idle による途中 `commitLiveView` | Phase 4 実機 OK 後のユーザー提起。Ask mode 調査済み |
| 2026-06-19 17:53 | 推奨は案 A（ホイール中 commit しない）。idle 閾値 250〜350ms を実装時決定 | ドラッグと同型。probe / 案 A handoff は維持 |
