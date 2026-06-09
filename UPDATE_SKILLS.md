# データ更新手順（スキル・コース・プリセット）

ウマ娘のゲームアップデート後、または umasim エンジン更新後に、本プロジェクトのデータを最新化する手順です。

## データ源の全体像

本番アプリ（`desktop-app`）は **複数のデータファイル** を同時に使います。更新漏れがあると、表示は正しくてもシミュレーションや OCR マッチングがずれることがあります。

| データ | 出力先 | 更新方法 | 本番での役割 |
|--------|--------|----------|-------------|
| `SkillDataGen.ts` | `webapp/src/engine/data/` | `master.mdb` → `extract_master.js` | **webapp R&D のみ**（TS エンジン・parity テスト） |
| `skillRarityData.ts` | `desktop-app/app/lib/` | `extract_skill_info.js` | スキル一覧の色分け（金・緑など） |
| `umasimSkillData.ts` | `desktop-app/app/lib/` | `extract_umasim_skill_data.js` | **OCR 後のスキル名→ID 変換**（`fuzzyMatcher.ts`） |
| `skill_data.txt` | （GitHub・実行時取得） | 自動（ネットワーク） | **WASM エンジン初期化**（`umaemuAdapter.ts`） |
| `trackData.ts` | `desktop-app/app/lib/` | **手動編集** | コース選択 UI・レース条件の ID 変換 |
| `race_presets.json` | `desktop-app/public/` | **手動編集** | レース条件プリセット |

### 重要: 二重管理になっている部分

- **OCR マッチング** → ローカルの `umasimSkillData.ts`
- **シミュレーション本体** → 実行時に GitHub から取得する `skill_data.txt`

ゲーム更新後は **`extract-umasim-skills` を必ず実行**し、ネットワーク接続時は umasim 側の最新 `skill_data.txt` も自動反映されます。オフライン環境では、取得した `skill_data.txt` をローカル引数で渡して更新してください。

---

## クイックチェックリスト（ゲームアップデート後）

`master.mdb` がある場合（推奨・フル更新）:

```powershell
# 1. master.mdb をリポジトリルートに配置

cd desktop-app
npm run extract-db              # SkillDataGen.ts（webapp 用）
npm run extract-skill-info      # skillRarityData.ts（UI 色分け）
npm run extract-umasim-skills   # umasimSkillData.ts（OCR マッチング）
```

`master.mdb` がない場合（最低限）:

```powershell
cd desktop-app
npm run extract-umasim-skills   # OCR マッチング用（ネットワーク必須）
```

手動で必要な場合:

- [ ] `desktop-app/public/race_presets.json` — 新しい CM / LoH プリセット
- [ ] `desktop-app/app/lib/trackData.ts` — 新コース・新競馬場

検証:

```powershell
cd desktop-app
npm run tauri dev
```

- 新スキルが一覧に表示されるか
- OCR 後にスキル名が正しく ID に変換されるか
- シミュレーションがエラーなく完了するか

---

## 詳細手順

### 1. `master.mdb` の配置（フル更新時）

ウマ娘公式アプリから抽出した `master.mdb`（SQLite3）をリポジトリルートに配置します。

```text
umamusume-skill-emulator/
 ├─ master.mdb  <-- ここ
 ├─ tools/
 ├─ webapp/
 └─ desktop-app/
```

> `master.mdb` は `.gitignore` 対象です。リポジトリには含めません。

### 2. `SkillDataGen.ts` の更新（webapp 用）

```powershell
cd desktop-app
npm run extract-db
```

- スクリプト: `tools/mdb-extractor/extract_master.js`
- 出力: `webapp/src/engine/data/SkillDataGen.ts`
- 用途: webapp の `RaceSimulator` / Vitest parity テスト

### 3. `skillRarityData.ts` の更新（UI 色分け）

**手順 2 の後**に実行してください（`SkillDataGen.ts` を入力に使います）。

```powershell
cd desktop-app
npm run extract-skill-info
```

- スクリプト: `tools/mdb-extractor/extract_skill_info.js`
- 出力: `desktop-app/app/lib/skillRarityData.ts`

### 4. `umasimSkillData.ts` の更新（OCR マッチング）★本番で重要

```powershell
cd desktop-app
npm run extract-umasim-skills
```

- スクリプト: `tools/mdb-extractor/extract_umasim_skill_data.js`
- デフォルト: [umasim の skill_data.txt](https://github.com/mee1080/umasim/blob/main/data/skill_data.txt) をネットワークから取得
- 出力: `desktop-app/app/lib/umasimSkillData.ts`
- 用途: `fuzzyMatcher.ts` が OCR 結果のスキル名を ID に変換

ローカルファイルから生成する場合:

```powershell
node tools/mdb-extractor/extract_umasim_skill_data.js path/to/skill_data.txt
```

### 5. WASM エンジンの `skill_data.txt`（実行時・自動）

本番アプリはシミュレーション開始時に GitHub から最新データを fetch します。

- 取得元: `https://raw.githubusercontent.com/mee1080/umasim/refs/heads/main/data/skill_data.txt`
- コード: `desktop-app/app/lib/engine/umaemuAdapter.ts`

通常は **手動更新不要** ですが、オフライン時や umasim のフォークを使う場合は取得 URL の変更が必要です。

### 6. `trackData.ts` の更新（手動）

コース選択 UI とシミュレーション payload の `location` / `course` ID に使われます。

- ファイル: `desktop-app/app/lib/trackData.ts`
- コメント: `Generated from umasim rawCourseData`
- **自動生成スクリプトは現状なし**

新競馬場・新距離が追加された場合:

1. umasim エンジンが認識する `locationId` / `courseId` を確認
2. `trackData.ts` に競馬場（`TrackLocation`）とコース（`TrackCourse`）を追記
3. `RaceConditionSelector` で選択できることを確認

関連コード: `aptitudeHelper.ts`, `umaemuAdapter.ts` の `createPayload`

### 7. `race_presets.json` の更新（手動）

チャンピオンズミーティングやリーグオブヒーローズ等のワンタッチプリセットです。

- ファイル: `desktop-app/public/race_presets.json`
- レース条件（競馬場 ID、コース ID、馬場状態、頭数など）を JSON で追記

---

## npm スクリプト一覧（desktop-app）

| コマンド | スクリプト | 入力 |
|----------|-----------|------|
| `npm run extract-db` | `extract_master.js` | `master.mdb`（ルート） |
| `npm run extract-skill-info` | `extract_skill_info.js` | `SkillDataGen.ts` |
| `npm run extract-umasim-skills` | `extract_umasim_skill_data.js` | umasim `skill_data.txt`（ネットワーク or ローカル） |

> いずれも `desktop-app/` から実行できます。パスはスクリプト内でリポジトリルート基準に解決されます。

---

## トラブルシューティング

| 症状 | 疑わしい原因 | 対処 |
|------|-------------|------|
| 新スキルが OCR 後に空欄になる | `umasimSkillData.ts` が古い | `npm run extract-umasim-skills` |
| スキル色がずれる | `skillRarityData.ts` が古い | `npm run extract-skill-info` |
| シミュレーションだけ失敗 | `race.js` が古い / ネットワーク | P2-2（`race.js` 更新手順）を参照 |
| 新コースが選べない | `trackData.ts` 未更新 | 手順 6 で追記 |
| `extract-db` が失敗 | `master.mdb` 未配置 | ルートに配置して再実行 |

---

## webapp との関係

| 更新 | desktop-app（本番） | webapp（R&D） |
|------|---------------------|---------------|
| `extract-db` | 間接的（extract-skill-info の入力） | `SkillDataGen.ts` を直接更新 |
| `extract-umasim-skills` | **必須** | 不要 |
| `RaceSimulator.test.ts` | 不要 | `SkillDataGen.ts` 更新後に `npx vitest` で確認 |
