# REQ-palette-local-skill-data: パレットのスキルデータ参照をローカルに統一

> 案C 採用。パレット正本を `umasimSkillDataList` に統一。WASM sim 用 GitHub fetch は現状維持。

- **ステータス**: done
- **作成日**: 2026-06-12 17:24
- **関連コミット**: （コミット後に記入）

---

## 目的

パレット一覧が `fetchSkillData()`（GitHub）と色分けが `umasimSkillData.ts`（ローカル ID）の二重参照になっており、更新タイミング差で ID 不一致→白表示等のリスクがある。パレット経路の正本を `umasimSkillDataList` に統一し不整合を減らす。

---

## 背景（設計レビュー合意 2026-06-12）

- 現状: パレット = GitHub fetch、色分け/名称 = ローカル ID
- 採用案: 案C — `buildPaletteSkillOptions` 新設 + パレットをローカル正本化。WASM `fetchSkillData()` は sim 専用で現状維持
- 案B（skill_data.txt 自前 GitHub 一本化）は P2 Backlog。今回スコープ外

---

## スコープ

### やること

- [x] `umasimSkillData.ts` に `buildPaletteSkillOptions` / `isPaletteVisibleSkill` 新設
- [x] 同名 dedupe: inherit → evo → rare → normal → その他 → 配列先頭
- [x] `SkillCommandPalette.tsx`: `fetchSkillData()` 削除、同期構築
- [x] `SkillPanel.tsx`: warm-up fetch / ネットワークエラーバナー削除
- [x] `umaemuAdapter.ts`: fetch は sim 専用コメント整理

### やらないこと

- `fetchSkillData` / GitHub URL / WASM 経路の変更（案B）
- `geminiOcr.ts` / `fuzzyMatcher.ts` / `src-tauri/` / グラフ / TabBar / extract

---

## 仕様

### フィルタ（`PALETTE_EXCLUDED_RARITIES` 維持）

- `special` / `minus` は常に非表示
- `onlyUnique=true`: `rarity === 'unique'` のみ（通常固有選択パレット）
- `onlyUnique=false`: `unique` 除外 + special/minus 除外

### 色分け

- 既存 `getSkillRarityInfoById` / `getSkillNameById`（ID ベース）を継続

### sim

- `runMultipleSimulations` 側 lazy `fetchSkillData()` は変更なし
- 同梱 `umasimSkillData.ts` が古くてもオンライン sim は GitHub で動作（現状維持）

---

## 触るファイル

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/lib/umasimSkillData.ts` | `buildPaletteSkillOptions` 等 |
| `desktop-app/app/components/SkillCommandPalette.tsx` | ローカル正本化 |
| `desktop-app/app/components/SkillPanel.tsx` | warm-up / エラー UI 削除 |
| `desktop-app/app/lib/engine/umaemuAdapter.ts` | コメント整理 |
| `docs/TODO.md` | ライフサイクル更新 |
| `docs/tasks/REQ-palette-local-skill-data.md` | 本 REQ |

---

## 完了条件

- [x] オフライン（GitHub raw block）でもパレットが即開き・一覧表示される
- [x] special / minus がパレットに出ない
- [x] 先頭数件が意図せず白にならない（getSkillRarityInfoById と一致）
- [x] 継承固有（例: シューティングスター inherit ID 900011）が通常パレットから正 ID/❖緑で追加できる
- [x] onlyUnique パレットは unique のみ。canPlaceSkillAtIndex ガード従来どおり
- [x] SkillPanel にネットワークエラーバナーが残っていない
- [x] extract 再実行なしでオンライン sim 100走 + レース詳細グラフが動作（`npm run build` + fetchSkillData 経路維持確認）
- [x] GitHub block 時: パレット OK / sim 失敗（既知・回帰なし）
- [x] TODO 着手・完了更新、REQ done、コミット

---

## 検証手順

1. `npm run tauri dev` — パレットを開き一覧が即表示されること（ネットワーク不要）
2. 通常パレット先頭付近に白だらけがないこと
3. 「シューティングスター」検索 → ❖緑 / ID 900011 で追加
4. onlyUnique パレットで unique のみ表示
5. オンラインで sim 100走 + レース詳細グラフ（extract 再実行なし）

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-12 | 案C 採用: パレット=ローカル正本、sim=GitHub fetch 維持 | 設計レビュー合意。案Bは別タスク |
| 2026-06-12 | 同名 ID 解決: inherit → evo → rare → normal → その他 → 先頭 | find 先頭禁止。継承固有を通常パレットで正 ID に |
| 2026-06-12 | SkillPanel warm-up / ネットワークエラー UI 削除 | パレットが同期化。sim は lazy load 委任 |
| 2026-06-12 17:24 | 実装着手 | P1 Backlog から進行中へ |
| 2026-06-12 17:28 | 実装完了。build 成功。fetchSkillData は umaemuAdapter のみ | P1 完了 |
