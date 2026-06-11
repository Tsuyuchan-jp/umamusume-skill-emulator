# REQ-race-detail-graph-stamina-keep-line: スタミナキープ持続線異常修正

> endedSkills 未検出スキルの endTime 誤フォールバック解消。親シリーズ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)（P1 polish）

- **ステータス**: done
- **作成日**: 2026-06-12 04:11
- **関連コミット**: `8b02849`

---

## 目的

スタミナ回復のみスキル（例: 200562 スタミナキープ）で、発動点からレース終端まで伸びる赤線を解消する。本家 umasim 同様、endedSkills 未登録スキルはラベルのみ表示とする。

---

## スコープ

### やること

- `WasmEngine.kt` `buildSkillEvents`: endIndex 未検出時の `frames.size-1` フォールバック削除。`endTime = startTime` センチネル
- `RaceDetailChart.tsx`: `hasDurationLine` / `endTime > startTime + ε` のときのみ水平線描画
- `raceGraphBuilder.ts`: `hasSkillDurationLine` / `hasDurationLine` 付与
- WASM 再ビルド + `desktop-app/public/umaemu/` 更新

### やらないこと

- `operating.duration` / heal 有無による線描画分岐（200562 特例ハック禁止）
- 単体テスト追加
- Tooltip hover ロジック・縦拡大クリップ・Phase 4 compare の変更

---

## 根本原因

| 層 | 問題 |
|----|------|
| WASM | `endIndex` 未検出時 `endTime = (frames.size - 1) / 15` でレース終端へフォールバック |
| 本家 | `GraphSkill.end = endIndex?.div(15f)` — null のまま。`GraphOutput.kt` は `skill.end != null` のみ赤線 |
| フロント | WASM `endTime` をそのまま `endX` に変換し常に line 描画 |

---

## 触るファイル

| ファイル | 変更内容 |
|---------|---------|
| `tools/umasim-race-wasm/WasmEngine.kt` | endTime センチネル |
| `desktop-app/public/umaemu/` | race.js / wasm 再配布 |
| `desktop-app/app/lib/raceGraphBuilder.ts` | `hasDurationLine` |
| `desktop-app/app/components/RaceDetailChart.tsx` | 条件付き line 描画 |
| `docs/TODO.md` | 着手・完了更新 |
| 本 REQ | draft → done |

---

## 完了条件

- [x] SkillVerifier で 200562 発動 sim → ラベル表示・赤線なし（WASM endTime センチネル + フロント hasDurationLine）
- [x] 持続バフ系スキルの短い赤線に退行なし（endedSkills 検出時 endTime > startTime のみ描画）
- [x] デバフ持続紫線なし（kind === debuff は hasDurationLine false）
- [x] 縦拡大 ON/OFF、Tooltip、Phase 4 compare に退行なし（描画条件のみ変更）
- [x] WASM 再ビルド + public/umaemu 更新済み
- [x] `npm run build` 通過
- [x] REQ `done` + TODO 完了済み + コミット

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-12 04:11 | 本 REQ を draft 起票。承認済み設計レビューに従い実装着手 | Ask mode 設計レビュー承認済み |
| 2026-06-12 04:11 | endIndex なし → `endTime = startTime`（型変更なし） | 本家 `GraphSkill.end = null` 相当 |
| 2026-06-12 04:11 | `operating.duration` フォールバックは実装しない | 200562 特例ハック禁止 |
| 2026-06-12 04:11 | 単体テスト追加なし | vertical-clip 同様 |
| 2026-06-12 04:13 | 完了: endTime センチネル + hasDurationLine + WASM 再ビルド + build 通過 | 実機 UI 確認は tauri dev で推奨 |
| 2026-06-12 04:27 | **実機検証クローズ**（200562 ラベルのみ・持続バフ赤線・縦拡大/Tooltip/Phase 4 compare 退行なし） | ユーザー確認 |
