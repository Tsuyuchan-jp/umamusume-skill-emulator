# REQ-race-detail-graph-phase3: 直近レース詳細グラフ — Phase 3 スキル帯・表示切替

> **レース詳細グラフ実装シリーズ** Phase 3（スキル可視化と表示設定）。
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)

- **ステータス**: done
- **作成日**: 2026-06-11 04:54
- **関連コミット**: `f8e8cbe`

---

## 開発フロー（シリーズ内の位置）

| 項目 | 内容 |
|------|------|
| **前** | [`REQ-race-detail-graph-phase2.md`](REQ-race-detail-graph-phase2.md)（区間オーバーレイ・**完了**） |
| **本 Phase** | スキル発動帯・デバフ、`GraphDisplaySetting` 相当のチェックボックス、縦方向拡大 |
| **次** | [`REQ-race-detail-graph-phase4.md`](REQ-race-detail-graph-phase4.md)（baseline グラフ diff・核機能） |
| **着手順** | **Ask mode 設計レビュー** → 承認 → **Agent mode 実装** |

---

## 目的

グラフ上で**スキル発動タイミング**やデバフ区間を把握し、表示系列の ON/OFF をユーザーが切り替えられるようにする（umasim `GraphDisplaySetting` 相当）。

---

## スコープ

### やること

- [x] スキル発動帯、デバフ等のオーバーレイ表示
- [x] `GraphDisplaySetting` 相当のチェックボックス切替（速度/体力/レーン等）
- [x] 「スキル数に応じて縦方向に拡大」オプション

### やらないこと

- Phase 4（baseline diff）— [`REQ-race-detail-graph-phase4.md`](REQ-race-detail-graph-phase4.md)
- Phase 2 の区間オーバーレイ再設計（**完了済み** `5e2b401`）
- WASM 詳細 API の Phase 1 部分の再設計

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `app/components/RaceDetailChart.tsx` | スキル帯・表示切替 UI |
| `app/lib/raceGraphBuilder.ts` | スキルイベントデータ変換 |
| `app/lib/types.ts` | スキル帯用型（要設計） |
| `public/umaemu/` | スキル発動タイミング出力（要設計） |

---

## 完了条件

- [x] スキル発動帯がグラフ上で確認できる
- [x] 系列の表示 ON/OFF が動作する
- [x] Phase 1 / axis / Phase 2 に退行なし
- [ ] `npm run tauri dev` 実機確認（ユーザー検証待ち）
- [x] REQ ステータス `done` + `docs/TODO.md` 更新 + コミット

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-11 04:54 | Phase 3 を単体 REQ として起票（draft） | 開発フロー明確化 |
| 2026-06-11 13:39 | WASM: `RaceFrame.triggeredSkills` / `endedSkills` から `skillEvents` 出力（案 A） | Ask mode 設計レビュー承認。フレーム毎 activeSkillIds 全量は禁止 |
| 2026-06-11 13:39 | `kind`: `minus` rarity → `debuff`、それ以外 → `skill` | umasim `SkillData.rarity` 準拠 |
| 2026-06-11 13:39 | フロント: `buildSkillBands` + `GraphDisplayState` + checkbox 正本（Legend クリック無効） | Phase 1/axis/Phase 2 退行防止 |
| 2026-06-11 14:08 | **方針変更**: 色付き帯廃止 → 本家準拠（発動ごと名前ラベル+赤線、`buildSkillMarkers`） | 実機 B-1 齟齬。umasim `GraphOutput.kt` 準拠 |
| 2026-06-11 14:08 | 縦拡大: `yDomainMax`/`topMargin` 廃止 → チャート高さ `max(360, eventCount×34)` + 親スクロール | 縦拡大 ON でグラフ消滅バグ修正。Y domain は常に 0–1 |

---

## 参考

- 親ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
- upstream: `compose/.../GraphDisplaySetting` 相当
