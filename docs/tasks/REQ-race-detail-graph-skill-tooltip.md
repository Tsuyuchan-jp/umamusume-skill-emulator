# REQ-race-detail-graph-skill-tooltip: グラフ内スキル hover Tooltip

> 本家 umasim 準拠のスキル情報 Tooltip。親シリーズ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)

- **ステータス**: done
- **作成日**: 2026-06-11 18:39
- **関連コミット**: `a5e5e7d`（Phase A hover UI）、`2c73c81`（Phase B WASM + umaemu）、`67b3707`（hover UI polish）

---

## 目的

グラフ overlay 上のスキル名ラベルにカーソルを合わせたとき、本家と同様に **効果量・持続時間・発動位置％** を Tooltip で表示する。走行グラフの読み取り価値を高める。

---

## スコープ

### やること

- [x] overlay SVG のスキル名ラベルのみ hover 領域（赤線は hit 対象外）
- [x] hover 時にスキル情報 Tooltip を表示（本家 `GraphOutput.kt` 相当）
- [x] 表示項目（GraphSkill.description 準拠）:
  - **効果量**: TriggeredSkill 由来（WASM `effectText`）
  - **持続時間**: `operating.duration` を effectText 内に含める
  - **発動位置％**: startRate/endRate（小数1桁％、範囲 or 単点）
- [x] 折れ線 Tooltip との干渉回避（ラベル hit で pointer 捕捉・z-index 1001）

### やらないこと

- Phase 4 baseline diff の2系列描画
- Phase 3 UX 表示仕様の変更
- スキル名ラベルのクリック操作
- スタミナキープ endTime 異常（別 TODO）

---

## 触ったファイル

| ファイル | 変更内容 |
|---------|---------|
| `RaceDetailChart.tsx` | ラベル hover・createPortal Tooltip |
| `raceGraphBuilder.ts` | tooltipKey / effectText / hit area / 位置％暫定 |
| `types.ts` | `SkillEventDump.effectText` |
| `WasmEngine.kt` | `buildGraphSkillDescription` + skillEvents 出力 |
| `desktop-app/public/umaemu/` | race.js + wasm 再ビルド配布 |

---

## 完了条件

- [x] スキル名ラベル hover で Tooltip 表示（効果量・持続時間・発動位置％）
- [x] hover 対象はスキル名のみ（赤線 hover なし）
- [x] 折れ線 Tooltip・縦拡大スクロール・Phase 4 compare・性能に退行なし
- [x] WASM 再ビルド + public/umaemu 更新済み
- [x] 本家 GraphSkill.description ロジックと Kotlin 実装一致（umasim AppState.kt 参照）
- [x] `npm run build` 通過
- [x] REQ `done` + `docs/TODO.md` 更新 + コミット

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-11 18:39 | 本 REQ を draft 起票。TODO P1 登録 | ユーザー要望。Phase 4 との優先は Phase 4 を先 |
| 2026-06-12 02:51 | Phase A 着手: スキル名ラベルのみ hover + Tooltip 枠 + 位置％暫定 | 設計レビュー承認済み方針 |
| 2026-06-12 02:58 | 効果量は WASM 事前フォーマット（`effectText` 1 フィールド）。本家 `GraphSkill.description` を Kotlin で再現 | AppState.kt 準拠。skill_data.txt 参照は使わない |
| 2026-06-12 02:58 | 2 コミット: (1) hover UI (2) WASM + umaemu | ユーザー承認済み方針 |
| 2026-06-12 02:58 | スタミナキープ endTime 異常は本 REQ 対象外 | 既知問題・別 TODO |
| 2026-06-12 03:24 | 実機検証チェックリスト全項目 OK | ユーザー確認 |
| 2026-06-12 03:24 | polish 方針: カーソル default、hover 時ピル+レアリティ色グロー（アニメあり）、赤線は非強調 | ユーザー承認。ピルは rect 固定サイズ+opacity で border ずれ回避 |
| 2026-06-12 03:26 | polish 実装: `cursor: default`、固定サイズピル+filter グロー、150ms opacity フェード | ユーザー承認後実装 |

---

## polish（実装予定・Tooltip 完了後）

Tooltip 機能本体は done。以下 UX polish は **実装済み**（2026-06-12）。

| 項目 | 方針 |
|------|------|
| カーソル | hit `<g>` / rect に `cursor: default`（I ビーム化を防ぐ） |
| hover 強調 | レアリティ色ベースのソフトグロー + **ピル型 rect**（`rx` 角丸） |
| アニメ | fill / stroke / filter の opacity を 150ms ease |
| 赤線 | hover 中も見た目変更なし |
| ずれ防止 | ピル rect は **常に同じ x/y/width/height**。hover 時は opacity のみ変化 |

### ピル hover の技術メモ

- overlay SVG は absolute のため、Recharts レイアウトやスキル行 Y 座標は **動かない**
- SVG `stroke` は path 中央に描かれるため、hover 時に stroke を「足す」と外側へ 0.5px 程度はみ出す可能性あり → **rect サイズ固定 + opacity アニメ**、または **filter（feGaussianBlur / drop-shadow）のみ** で回避
- 非 hover 時も透明 rect を同サイズで置き、hover 時に fill/stroke/filter の opacity だけ上げると視覚ジャンプなし

---

## 参考

- ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
- 本家: `GraphOutput.kt`（WithTooltip + skill.description）、`AppState.kt` GraphSkill.description
- overlay 実装: `f8158c8`（Phase 1 性能）
