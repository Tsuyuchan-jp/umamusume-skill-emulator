# REQ-race-detail-graph-map-view-perf-fallback: Google Map 型グラフ — domain 更新 30fps cap（perf fallback）

> 親: [`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md)
> 文脈: [`REQ-race-detail-graph-performance.md`](REQ-race-detail-graph-performance.md)

- **ステータス**: in-progress
- **作成日**: 2026-06-19 01:03
- **関連コミット**: （完了後に記入）

---

## 目的

Step A+B（rAF バッチ・metrics リセット削減・操作中 overlay defer・probe ゲート）後も残る Recharts 全系列再描画（P0）の commit 頻度を、操作中のみ **30fps** に制限し、ホイール/2D ドラッグの体感レスポンスを改善する。

---

## スコープ

### やること

- `isMapInteracting` 中のみ `setViewState`（chartViewState → visibleWindow → Recharts domain）を **≤30fps** に cap
- `pointerup` / wheel idle（`MAP_INTERACTION_WHEEL_IDLE_MS=150`）/ `resetView`（ダブルクリック）で throttle バイパス即時同期
- 定数 `MAP_CHART_DOMAIN_COMMIT_FPS` / `MAP_CHART_DOMAIN_COMMIT_MS` を `useChartViewInteraction.ts` に export

### やらないこと

- `applyWheelZoom` / `applyPanDrag` / `svgToPercent` 等の pan/zoom ロジック変更
- overlay scales probe ゲートの撤廃・緩和
- ReferenceArea / phaseLines の操作中 defer
- Canvas 折れ線 escape
- ステップ 3 暫定 UI 削除（`expandSkillRows` checkbox・K=4 dev 表示）

---

## 仕様

### cap 対象

- `flushPendingViewState` 内の `setViewState` のみ

### cap 非対象

- `pendingViewStateRef` 更新（常に最新）
- `scheduleViewStateCommit`（毎入力で呼ぶ）
- `isMapInteracting` の React `setState`（overlay defer の正確性のため即時）
- `applyWheelZoom` / `applyPanDrag` 呼び出し

### 操作中フロー

rAF 到着 → throttle 判定（`lastDomainCommitTime` + `MAP_CHART_DOMAIN_COMMIT_MS`）→ commit or trailing flush 1 本スケジュール

### 非操作中

現状どおり rAF 1 frame 最大 1 commit（cap なし）

### ホイール中カーソルドリフト（許容トレードオフ）

cap 中は `plotMetricsRef` が最後 commit された domain 基準のため、高速連打ホイールで微小ドリフトが起きうる。停止時フル同期 + probe ゲートで overlay 整合を担保。

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/hooks/useChartViewInteraction.ts` | 30fps cap + 停止時バイパス（主変更） |
| `docs/tasks/REQ-race-detail-graph-map-view-perf-fallback.md` | 本 REQ |
| `docs/TODO.md` | Backlog / 進行中 / 完了済み |
| `docs/tasks/REQ-race-detail-graph-map-view.md` | 決定ログ 1 行 |

---

## 完了条件

- [x] `isMapInteracting` 中、`chartViewState` → Recharts domain の反映が **≤30fps**
- [x] `pointerup` / wheel idle / ダブルクリックで throttle バイパス即時同期
- [ ] ホイール連打・2D ドラッグ 2〜3 秒で現状比 **体感が明確に軽い**（ユーザー主観。任意: React Profiler）
- [ ] 操作停止後 **200ms 以内**に overlay が probe 合格位置へ復帰
- [ ] ダブルクリックリセット・compare・percent 3 系列に退行なし
- [x] `npm run build` 通過
- [ ] 実機検証クローズ

---

## 検証手順

1. 50+ スキル終盤でホイール連打・2D ドラッグ 2〜3 秒 — 現状比明確に軽いか
2. 停止後 200ms 以内 overlay 復帰（赤線↔速度線）
3. percent 3 系列・compare ON・ダブルクリックリセット
4. ウィンドウリサイズ後の整合
5. `expandSkillRows` ON 時 map 操作無効のまま
6. （任意）React Profiler: `RaceDetailChart` commit 回数・時間の改善確認

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-19 01:03 | **perf fallback を sibling REQ に分離**。30fps cap のみ採用（24fps 等は見送り） | Step A+B 実機クローズ後ももたつき残存。設計レビュー承認済み |
| 2026-06-19 01:03 | cap は `setViewState` のみ。pan/zoom 計算・probe ゲート・overlay defer は不変 | 退行防止境界の維持 |
| 2026-06-19 01:03 | ホイール連打時のカーソル中心ズーム微小ドリフトは許容 | 停止時フル同期で overlay 整合を担保 |
