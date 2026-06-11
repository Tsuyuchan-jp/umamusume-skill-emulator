# REQ-race-detail-graph: 直近レース詳細グラフ（ロードマップ）

> **レース詳細グラフ実装シリーズ**の索引。各 Phase の詳細・完了条件は **Phase 別 REQ** を正本とする。
> 参考 UI: [umasim レースエミュレータ](https://mee1080.github.io/umasim/race/)「直近レース詳細」相当。

- **ステータス**: Phase 1 完了（シリーズ継続中）
- **作成日**: 2026-06-10 15:55
- **最終更新**: 2026-06-11 18:20

---

## 目的（シリーズ全体）

シミュレーション結果を平均数字だけでなく、**直近1走の走行イメージ**で把握する。最終的に **SkillVerifier の baseline グラフ diff** を核機能とする。

---

## 開発フロー（推奨順）

| 順 | Phase | REQ | ステータス | 完了後の次 |
|----|-------|-----|-----------|-----------|
| 1 | MVP（3本線） | [`REQ-race-detail-graph-phase1.md`](REQ-race-detail-graph-phase1.md) | **done** | → axis |
| 1.5 | Y軸・単位改善 | [`REQ-race-detail-graph-axis.md`](REQ-race-detail-graph-axis.md) | **done** | → Phase 2 |
| 2 | 区間オーバーレイ | [`REQ-race-detail-graph-phase2.md`](REQ-race-detail-graph-phase2.md) | **done** | → Phase 3 |
| 3 | スキル帯・表示切替 | [`REQ-race-detail-graph-phase3.md`](REQ-race-detail-graph-phase3.md) | **done** | → UX / 性能 |
| 3-UX | UX ポリッシュ | [`REQ-race-detail-graph-phase3-ux.md`](REQ-race-detail-graph-phase3-ux.md) | **done**（D OK / E → 性能 REQ で解消） | → 性能 |
| 3-P | UI レスポンス | [`REQ-race-detail-graph-performance.md`](REQ-race-detail-graph-performance.md) | **done**（`873080e` 実機検証完了） | → Phase 4 |
| 4 | baseline diff（核） | [`REQ-race-detail-graph-phase4.md`](REQ-race-detail-graph-phase4.md) | draft | シリーズ本線完了 |

### 1 Phase の進め方

1. **Ask mode** — 対象 Phase REQ を `@` 参照して設計レビュー
2. **承認** — CHAT_TEMPLATE パターン A で実装プロンプト取得
3. **Agent mode** — 1 Phase = 1 チャット（または axis 規模なら小 REQ 追加も可）
4. **完了** — Phase REQ を `done`、TODO 更新、コミット

---

## やらないこと（シリーズ共通）

- N 走分のグラフ平均化
- OCR / `fuzzyMatcher.ts` / `src-tauri/` キャプチャの変更
- ゲーム内実画面との完全一致保証
- Compose 版 `wasm.js` の iframe 埋め込み

---

## 技術方針（シリーズ共通）

1. **WASM 拡張** — 1走分 frames（+ Phase 2 以降 trackDetail / スキルイベント）
2. **N 走と詳細1走を分離** — 1000 走 × 全 frames は非現実的
3. **React + recharts** — `RaceDetailChart.tsx` / `raceGraphBuilder.ts`
4. **race.js 更新** — `UPDATE_SKILLS.md` 手順 7

---

## 決定事項ログ（ロードマップ）

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-10 15:55 | Phase 1〜4 の段階実装 | 設計レビュー承認 |
| 2026-06-11 04:47 | 親 REQ ステータスを `done（Phase 1 完了）` に明確化 | 誤解防止 |
| 2026-06-11 04:54 | Phase 1〜4 を sibling REQ に分割、本ファイルをロードマップ索引化 | 開発速度・スコープ明確化 |
| 2026-06-11 16:37 | 性能改善 REQ をロードマップに追加（Phase 3-P） | UX 実機 E NG。Phase 4 前のブロッカー |
| 2026-06-11 18:20 | Phase 3-P（性能）実機検証クローズ | `f8158c8`〜`873080e`。次は Phase 4 baseline diff（Ask mode 設計レビューから） |
| 2026-06-11 07:50 | Phase 2 完了（`5e2b401`）。次は Phase 3 設計レビュー | 実機確認・UX 改善含む完全完了 |

---

## 参考

- Phase 1 詳細: [`REQ-race-detail-graph-phase1.md`](REQ-race-detail-graph-phase1.md)
- Cockpit 統合: [`REQ-fullscreen-cockpit-layout.md`](REQ-fullscreen-cockpit-layout.md)
- WASM: `tools/umasim-race-wasm/`
