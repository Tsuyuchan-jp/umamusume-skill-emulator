# REQ-inherit-evolution-special: 継承固有の継承進化（special）対応

> 名称同一・枠色のみ変化する継承進化を、sim / 表示 / パレット / OCR で正しく扱えるようにする。
> 設計レビュー採用案 C（ハイブリッド）。設計レビュー承認（未決すべて確定）。

- **ステータス**: done
- **作成日**: 2026-07-23 22:17
- **関連コミット**: `56b6896`（着手）〜（実装完了コミットは TODO 完了行を参照）

---

## 解くべき問題と目的（Problem Framing）

- **現状の課題**: ゲーム内で条件を満たすと継承固有が **継承進化** するが、**名称は変わらず** 枠色のみ淡い赤（進化スキル風）に変わる。アプリは同名の通常継承（`inherit`）寄りに解決し、`special` は白表示かつパレット除外のため、継承進化版を選べない・見えない
- **目的**: 継承進化を判定し、表示は evo（★赤）に寄せ、パレットで通常継承と継承進化を2行選べ、OCR は判別不能時に継承進化寄りにする

---

## スコープ

### やること

- 継承進化判定（`rarity === special` かつ同名 `inherit` が `umasimSkillDataList` に存在）
- `getSkillRarityInfoById` で継承進化を scenario と同様 evo 表示に寄せる（新 `SkillDisplayRarity` は増やさない）
- パレット: `PALETTE_EXCLUDED_RARITIES` の special/minus 全除外は維持し、継承進化 ID のみ除外例外。同名 dedupe 例外で通常継承と継承進化を2行（ラベルに「（継承進化）」）
- OCR: `fuzzyMatchSkillId` で先頭枠以外の同名複数ヒット時、継承進化 special を inherit より優先。unique 先頭優先は維持
- `countSkillSummary` の進化（evo）に継承進化を含める（表示関数追従 + テスト）
- 単体テスト追加

### やらないこと

- 枠色 OCR・手動切替 UI
- 既存タブの `901351` / `911091` 自動置換
- special 全件のパレット常時表示
- WASM / worker / race.js・geminiOcr・キャプチャ / stitch・minus 全体

---

## 仕様

### 判定

- `rarity` が `special` かつ、同名の `inherit` スキルが `umasimSkillDataList` に存在する → **継承進化**
- 現状該当: 「黄金を訪ねて」`91101351`、「ずっとずっと輝いて」`92111091`（名前固定配列・ID 数字規則は使わない）

### 表示

- `getSkillRarityInfoById`: 継承進化 → scenario と同様 `{ rarity: 'evo', icon: '★', colorClass: 'text-red-400' }`
- 通常継承は従来どおり ❖緑

### パレット

- `special` / `minus` 全除外は維持。継承進化判定に当たる ID だけ表示例外
- 同名 dedupe は例外し、例: 「黄金を訪ねて」と「黄金を訪ねて（継承進化）」の2行
- 日本総大将など通常 special は出さない

### OCR（名前解決）

- 先頭枠: unique 優先の既存挙動を維持
- 先頭以外: 同名複数ヒット時、継承進化 special を inherit より優先（ガチ勢向け・判別不能時 special 寄り）
- 未進化はパレットで修正

### 移行

- 既存タブの通常継承 ID は自動置換しない。新規 OCR デフォルトのみ継承進化寄り

---

## 設計制約（契約）

- **事前条件**: `umasimSkillDataList` に通常継承と継承進化（special）の両方が同名で載っていること
- **事後条件**: 継承進化 ID は evo 表示・サマリー evo 集計・パレットで選択可能。通常 special はパレット非表示のまま
- **不変条件**:
  - 新 `SkillDisplayRarity` を増やさない
  - `PALETTE_EXCLUDED_RARITIES` の special/minus 全除外方針は維持（継承進化のみ例外）
  - 既存タブの `901351` / `911091` を自動変更しない
  - geminiOcr / WASM / キャプチャ / stitch / minus 全体を触らない
- **異常時の保証**: 該当なし（純粋な参照・表示・マッチ優先度変更）

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/lib/umasimSkillData.ts` | 継承進化判定・表示 evo 寄せ・パレット例外2行 |
| `desktop-app/app/lib/fuzzyMatcher.ts` | 非先頭で継承進化優先 |
| `desktop-app/app/lib/skillSummary.ts` | 追従のみ（変更なし） |
| `desktop-app/app/lib/skillSummary.test.ts` | 継承進化の表示・集計・パレットケース |
| `desktop-app/app/lib/fuzzyMatcher.test.ts` | OCR 優先の最小テスト（新規） |
| `docs/TODO.md` / `INDEX.md` / `CHANGELOG.md` / `CONCEPT-MAP.md` | 進捗・索引・Unreleased・用語カード |

---

## 永続正本同期（エージェント必須）

| トリガー | 更新先 |
|----------|--------|
| 着手 | `TODO.md` 進行中・`INDEX.md` draft 行 |
| 実装完了 | 本 REQ 決定ログ、`TODO.md` 完了、`INDEX.md` done、`CHANGELOG` Unreleased、`CONCEPT-MAP` 継承進化カード |
| Phase / REQ 完了 | `CONCEPT-MAP.md`（継承進化カード追加） |

---

## 完了条件

- [x] パレットで黄金・ずっとずっとが通常継承と継承進化の2行で選べ、日本総大将等の special は出ない（単体テスト）
- [x] 継承進化 ID が SkillPanel 等で ★赤、通常継承は ❖緑（`getSkillRarityInfoById` テスト）
- [x] OCR 名前解決で非先頭の「黄金を訪ねて」が `91101351` になる（`fuzzyMatcher.test.ts`）
- [x] `countSkillSummary` で継承進化が evo に入るテスト追加・PASS
- [x] 既存 `901351` を自動変更する処理を入れていない
- [x] CONCEPT-MAP に継承進化カードを追加
- [x] CHANGELOG Unreleased に1行
- [x] `docs/TODO.md` 着手→完了、本 REQ `done`、`INDEX.md` 更新
- [x] 単体テスト PASS・コミット（push なし）

---

## 検証手順

1. `desktop-app` で `npm test`（74件 PASS）
2. （任意・実機）パレットで「黄金を訪ねて」「（継承進化）」の2行を確認。日本総大将が出ないこと
3. （任意・実機）継承進化 ID 追加時に ★赤・サマリー進化が増えること

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-07-23 22:17 | 設計レビュー採用案 C（ハイブリッド）承認。判定は special+同名 inherit。OCR は非先頭で継承進化優先。パレット例外2行。表示は evo 寄せ。手動 UI・既存タブ自動置換なし | ガチ勢向け・名前固定配列より一般化・枠色 OCR は難易度高 |
| 2026-07-23 22:21 | 実装完了。`isInheritEvolutionSkill` / パレット例外 / OCR 優先 / テスト74件 PASS。CONCEPT-MAP「継承進化」カード追加 | 承認済み方針どおり |
