# REQ-stitch-terminal-coarse-reprobe: 最終ペア coarse≈S* 誤採用時の短帯再探索（案 A2a）

> 親文脈: [`REQ-stitch-terminal-exact-bottom.md`](REQ-stitch-terminal-exact-bottom.md)（案 A′）・[`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md) R3.5c-2（terminal 微探索）。
> 案 A′ は **短 raw** の偽 refine を塞ぐ。本 REQ は **非短 coarse（≈S*）** で SSD が誤ピークを採用する穴を塞ぐ。

- **ステータス**: done（実装完了・**実機検証クローズ** 2026-07-14 10:03）
- **作成日**: 2026-07-14 09:43
- **関連コミット**: `f2a4c3e`

---

## 目的

オートキャプチャでスキル一覧末端に **わずかな正当スクロール** が残るとき、最終ペアの SSD が S* 近傍（例: 145px）を誤採用し、結合画像末尾が約2行分二重になる。最終ペアで coarse ≥ 0.85·S* でも短帯 `[0, 0.85·S*)` を再探索し、正当な小シフトを採用する。

---

## 再現条件（ユーザー報告・2026-07-14）

| 項目 | 内容 |
|------|------|
| 画面 | ウマ娘詳細・スキルタブ（ナリタトップロード・長スキルリスト） |
| 条件 | Frame12 はスクロールバー未達・Frame13 で最下部到達。**ずれ=0 ではなく小さい正当シフト** |
| 症状 | 末尾スキル行（奮い立つ心〜本気で休んで…）が約2行分二重 |
| ログ | S*=143・Frame12→13 `scrollAmount=145` `score=0.941` `method=ssd`（terminal / skip 不発） |

---

## 採用案（A2a）

1. 最終ペア + セッション安定 + **coarse ≥ 0.85·S*** + **raw ≥ 0.85·S***（FRD release 正当 refine 退行回避）
2. `[0, floor(0.85·S*) - 1]` を再探索
3. `shortDiff < coarseDiff × 0.98` なら短シフト採用（≤25 → skip、それ以外 → terminal）
4. 非採用なら coarse 維持
5. 案 A′・既存 terminal 微探索（短 coarse）は維持

### FRD release 退行ガード

短 raw（例: 59）→ 正当 refine（166）の経路では **raw < 0.85·S*** のため A2a 非対象。golden G-FRD-S-release std(S_k)<20 を維持。

---

## 触るファイル

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/lib/stitch/shiftEstimateCore.ts` | A2a 再探索・`runTerminalReprobeForPair` export |
| `desktop-app/app/lib/stitch/shiftEstimateCore.test.ts` | A2a Vitest |
| `desktop-app/app/lib/stitch/stitch.ts` | `terminal coarse re-probe` ログ |
| 本 REQ / `TODO.md` / `INDEX.md` | 記録 |

---

## 完了条件

- [x] 案 A2a 実装（raw/coarse 両方 ≥ 0.85·S* 時のみ）
- [x] Vitest 7/7 + golden 29/29 PASS
- [x] 実機: ナリタトップロードで二重なし（**ユーザー実施 OK・2026-07-14 10:03**）
- [x] REQ `done`・TODO 完了済み・INDEX 更新

### 実機確認チェックリスト（ユーザー実施）

1. [x] ナリタトップロード長スキルリストでオートキャプチャ
2. [x] 結合画像末尾が二重でない（目視 OK）
3. [x] DevTools: Frame12→13 `terminal coarse re-probe（coarse=144px→final=38px）` score=0.987
4. [ ] 回帰: オグリびったし（案 A′）・G-FRD-S-release（今回ログ対象外・必要なら別途）

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-07-14 09:43 | 設計レビュー: 案 A2a 承認。再探索上限 A2a `[0, 0.85·S*)` | ユーザー訂正: 末端は無移動ではなく小さい正当シフト |
| 2026-07-14 09:43 | A2a 発火に raw ≥ 0.85·S* を追加 | G-FRD-S-release golden 退行（短 raw→166 refine） |
| 2026-07-14 09:43 | **実装完了**。Vitest + golden PASS | 同一セッション実装 |
| 2026-07-14 10:03 | **実機クローズ**: S*=143・Frame12→13 terminal coarse re-probe（coarse=144→final=38）・二重なし | ユーザー提供ログ＋結合画像 |
| 2026-07-14 10:03 | CONCEPT-MAP: 追記 0 件（`terminal coarse re-probe` 既存カードで十分） | Phase 完了時検討 |
