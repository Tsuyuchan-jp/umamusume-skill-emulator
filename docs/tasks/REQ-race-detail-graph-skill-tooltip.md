# REQ-race-detail-graph-skill-tooltip: グラフ内スキル hover Tooltip

> 本家 umasim 準拠のスキル情報 Tooltip。親シリーズ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)

- **ステータス**: draft
- **作成日**: 2026-06-11 18:39
- **関連コミット**: （完了後に記入）

---

## 目的

グラフ overlay 上のスキル名・発動線にカーソルを合わせたとき、本家と同様に **効果量・持続時間・発動位置％** を Tooltip で表示する。走行グラフの読み取り価値を高める。

---

## スコープ

### やること

- [ ] overlay SVG のスキルラベル/赤線に hover 領域を設ける（現状 `pointer-events-none` を解除）
- [ ] hover 時にスキル情報 Tooltip を表示（本家 `GraphOutput.kt` 相当）
- [ ] 表示項目（最低限）:
  - **持続時間**: `endTime - startTime`（`skillEvents` から算出可）
  - **発動位置％**: `frames` の `startPosition` / `courseLength`（`startTime` からフレーム逆引き）
  - **効果量**: 要設計 — WASM 出力拡張 or マスタ参照（Ask mode で確定）
- [ ] 折れ線 Tooltip（速度/体力/レーン）との干渉を避ける（z-index・hit area・表示優先）

### やらないこと

- Phase 4 baseline diff の2系列描画（本 REQ とは別。Phase 4 後に diff 表示への追従は別判断）
- Phase 3 UX 表示仕様の変更（下ライン・19px 行等）
- スキル名ラベルのクリック操作

---

## データ調査メモ（起票時点）

| 項目 | 現状の取得元 | 備考 |
|------|-------------|------|
| 持続時間 | `SkillEventDump.startTime` / `endTime` | 追加実装不要 |
| 発動位置％ | `RaceDetailDump.frames` + `courseLength` | `buildRaceGraphPoints` と同様のフレーム参照 |
| 効果量 | **未出力** | `WasmEngine.kt` の `SkillEventOutput` は id/time/kind のみ。本家同等にするなら WASM 拡張が有力 |

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `RaceDetailChart.tsx` | overlay hover・Tooltip UI |
| `raceGraphBuilder.ts` | マーカーに Tooltip 用メタデータ付与（発動位置％等） |
| `types.ts` | 必要なら `SkillEventDump` 拡張 |
| `tools/umasim-race-wasm/WasmEngine.kt` | 効果量を出す場合のみ |

---

## 完了条件

- [ ] スキルラベル hover で Tooltip 表示（持続時間・発動位置％が正しい）
- [ ] 効果量の表示方針が決定ログに記録され、実装されている
- [ ] 折れ線 Tooltip・縦拡大スクロール・性能（Phase 1+2）に退行なし
- [ ] `npm run build` 通過・実機確認
- [ ] REQ `done` + `docs/TODO.md` 更新 + コミット

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-11 18:39 | 本 REQ を draft 起票。TODO P1 登録 | ユーザー要望。Phase 4 との優先は Phase 4 を先（下記 TODO 参照） |

---

## 参考

- ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
- overlay 実装: `f8158c8`（Phase 1 性能）
- 本家: `GraphOutput.kt`（TooltipSurface 相当）
