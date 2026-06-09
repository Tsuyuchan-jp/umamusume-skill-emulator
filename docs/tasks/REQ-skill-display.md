# REQ-skill-display: スキル表示・パレット整備

- **ステータス**: in-progress
- **作成日**: 2026-06-10
- **関連コミット**: `8e6ff01`, `2d20a50`, `570a1f2`

---

## 目的

スキル一覧・パレット・所持スキル表示で、レアリティが一目で分かるようにする。
あわせて、育成で使わないスキルをパレットから除外し、選択肢を実用的なものに絞る。

---

## スコープ

### やること

- ID ベースの5色表示（unique / inherit / evo / rare / その他）
- 通常固有の先頭スロット専用ガード
- パレットから `special` / `minus` を除外

### やらないこと

- OCR / fuzzyMatcher / キャプチャロジックの変更
- `special` / `minus` の色分け定義（除外するため不要）

---

## 仕様

### 色・アイコン（`getSkillRarityInfoById`）

| レアリティ | 色 | アイコン |
|-----------|-----|---------|
| unique | `text-blue-400` | ◆ |
| inherit | `text-emerald-400` | ❖ |
| evo | `text-red-400` | ★ |
| rare | `text-amber-400` | ✦ |
| その他 | `text-zinc-200` | なし |

### 通常固有ガード

- index 0 のみ配置可（`canPlaceSkillAtIndex`）
- 2つ目以降は除去（`sanitizeSkillIds`）

### パレット除外

- `special`: 育成で取得不可
- `minus`: マイナス効果・実用性なし

---

## 触るファイル

| ファイル | 変更内容 |
|---------|---------|
| `app/lib/umasimSkillData.ts` | 色分け・ガード関数 |
| `app/components/SkillCommandPalette.tsx` | パレットフィルタ・色表示 |
| `app/components/SkillPanel.tsx` | 所持スキル色表示 |

---

## 完了条件

- [x] 先頭=通常固有（青）、継承=緑、進化=赤、金=金、白=白
- [x] 2つ目以降に通常固有が入らない
- [x] パレット先頭が `inherit` から始まる（special/minus 非表示）
- [ ] SkillVerifier 側の表示統一（未着手なら Backlog へ）

---

## 検証手順

1. `npm run tauri dev` でアプリ起動
2. 「＋ スキルを追加」でパレットを開く
3. 先頭が継承スキル（緑）から始まること
4. `日本総大将` 等の special スキルが検索に出ないこと
5. スキル追加後、所持一覧で色・アイコンが正しいこと

---

## 決定事項ログ

| 日付 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-10 | special/minus はパレットから除外 | 育成外・マイナス効果で実用性なし |
| 2026-06-10 | 色定義は `getSkillRarityInfoById` のみ変更 | 見た目のみ、OCR 等に影響させない |
