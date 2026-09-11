# データ更新手順（スキル・コース・プリセット）

ウマ娘のゲームアップデート後、または umasim エンジン更新後に、本プロジェクトのデータを最新化する手順です。

## データ源の全体像

本番アプリ（`desktop-app`）は **複数のデータファイル** を同時に使います。更新漏れがあると、表示は正しくてもシミュレーションや OCR マッチングがずれることがあります。


| データ                  | 出力先                          | 更新方法                                                        | 本番での役割                                  |
| -------------------- | ---------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| `skillRarityData.ts` | `desktop-app/app/lib/`       | `master.mdb` → `extract_rarity_from_mdb.js`                 | スキル一覧の色分け（金・緑など）                        |
| `umasimSkillData.ts` | `desktop-app/app/lib/`       | `extract_umasim_skill_data.js`（**同梱予備**）                  | 起動時にシミュ JSON から差し替える OCR／パレット一覧の初期値 |
| `skill_data.txt`     | `desktop-app/public/`        | 同上（`umasimSkillData.ts` と同時生成）                          | **WASM 同梱フォールバック**（オフライン・fetch 失敗時）     |
| `skill_data.txt`     | GitHub + AppData キャッシュ       | **起動時** fetch（`runtimeMasterData.ts`）                         | **OCR／パレット／WASM** の正本（オンライン時は最新優先）           |
| `race.js` / `*.wasm` | `desktop-app/public/umaemu/` | umasim `:race` ビルド → 手動コピー（[手順 7](#7-racejs--wasm-エンジンの更新)） | **レースシミュレーション本体**（`worker.js` 経由）       |
| `trackData.ts`       | `desktop-app/app/lib/`       | **手動編集**                                                    | コース選択 UI・レース条件の ID 変換                   |
| 開催ローテ           | umasim `data/event_track.txt` | **起動時 fetch**（失敗時はボタン非表示）                         | チャンミ／LoH ワンタッチ                             |


### 重要: 二重管理になっていた部分（起動時に一本化）

- **OCR／パレット／シミュレーション（オンライン）** → 起動時に GitHub（umasim）から取得する `skill_data.txt`
- **オフライン** → AppData キャッシュ、なければ同梱 `public/skill_data.txt` と同梱一覧

ゲーム更新後はオンライン起動できれば **OCR／パレット／シミュは umasim の最新 `skill_data.txt` に追従**します。同梱を新しくしたいときだけ `extract-umasim-skills` を実行してください。

---

## クイックチェックリスト（ゲームアップデート後）

`master.mdb` がある場合（推奨）:

```powershell
# 1. master.mdb をリポジトリルートに配置

cd desktop-app
npm run extract-skill-info      # skillRarityData.ts（UI 色分け）
npm run extract-umasim-skills   # umasimSkillData.ts（OCR マッチング）
```

`master.mdb` がない場合（最低限）:

```powershell
cd desktop-app
npm run extract-umasim-skills   # OCR マッチング用（ネットワーク必須）
```

手動で必要な場合:

- [ ] `desktop-app/app/lib/trackData.ts` — 新コース・新競馬場
- [ ] `desktop-app/public/umaemu/race.js` 等 — シミュレーションだけ失敗する場合（[手順 7](#7-racejs--wasm-エンジンの更新)）

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

### 1. `master.mdb` の配置

ウマ娘公式アプリから抽出した `master.mdb`（SQLite3）をリポジトリルートに配置します。

```text
umamusume-skill-emulator/
 ├─ master.mdb  <-- ここ
 ├─ tools/
 └─ desktop-app/
```

> `master.mdb` は `.gitignore` 対象です。リポジトリには含めません。

### 2. `skillRarityData.ts` の更新（UI 色分け）

```powershell
cd desktop-app
npm run extract-skill-info
```

- スクリプト: `tools/mdb-extractor/extract_rarity_from_mdb.js`
- 入力: `master.mdb`（ルート）
- 出力: `desktop-app/app/lib/skillRarityData.ts`

### 3. `umasimSkillData.ts` の更新（OCR マッチング）★本番で重要

```powershell
cd desktop-app
npm run extract-umasim-skills
```

- スクリプト: `tools/mdb-extractor/extract_umasim_skill_data.js`
- デフォルト: [umasim の skill_data.txt](https://github.com/mee1080/umasim/blob/main/data/skill_data.txt) をネットワークから取得
- 出力:
  - `desktop-app/app/lib/umasimSkillData.ts`（OCR 用簡略化 TS）
  - `desktop-app/public/skill_data.txt`（WASM 同梱フォールバック用の生 JSON）
- 用途: `fuzzyMatcher.ts` が OCR 結果のスキル名を ID に変換。`public/skill_data.txt` は fetch 失敗時の sim フォールバック

ローカルファイルから生成する場合:

```powershell
node tools/mdb-extractor/extract_umasim_skill_data.js path/to/skill_data.txt
```

### 4. WASM エンジンの `skill_data.txt`（実行時取得 + フォールバック）

本番アプリはシミュレーション開始時に次の優先順位でスキルデータを取得します。

1. **GitHub fetch**（最新優先）— 成功時 AppData にキャッシュ
2. **AppData キャッシュ** — `%APPDATA%\com.umamusume.race-analyzer\skill_data\skill_data.txt`
3. **同梱フォールバック** — `desktop-app/public/skill_data.txt`（`extract-umasim-skills` で生成）

- 取得元 URL: `https://raw.githubusercontent.com/mee1080/umasim/refs/heads/main/data/skill_data.txt`
- コード: `desktop-app/app/lib/engine/umaemuAdapter.ts`, `desktop-app/app/lib/skillDataStorage.ts`

通常は **手動更新不要** ですが、オフライン初回起動や umasim のフォークを使う場合は同梱 `skill_data.txt` の更新または取得 URL の変更が必要です。

### 5. `trackData.ts` の更新（手動）

コース選択 UI とシミュレーション payload の `location` / `course` ID に使われます。

- ファイル: `desktop-app/app/lib/trackData.ts`
- **自動生成スクリプトは現状なし**

新競馬場・新距離が追加された場合:

1. umasim エンジンが認識する `locationId` / `courseId` を確認
2. `trackData.ts` に競馬場（`TrackLocation`）とコース（`TrackCourse`）を追記
3. `RaceConditionSelector` で選択できることを確認

### 6. 開催ローテ（起動時取得）

チャンミ／LoH のワンタッチは umasim の [`data/event_track.txt`](https://raw.githubusercontent.com/mee1080/umasim/refs/heads/main/data/event_track.txt) を起動時に取得します。失敗時はボタンを出しません。新競馬場が `trackData.ts` に無い場合はチップを作れません。

### 7. `race.js` / WASM エンジンの更新

本番アプリのレースシミュレーションは、Git 同梱の **Kotlin/Wasm エンジン**（`race.js` + ハッシュ名 `*.wasm`）を Web Worker（`worker.js`）経由で実行します。実行時の自動更新はありません。

> **技術メモ**: エンジンは Kotlin/Wasm（webpack バンドル）です。`worker.js` 内の「Emscripten」コメントは古い記述で、実装とは一致しません。

#### いつ更新するか

- umasim の `:race` モジュールにレースロジックの更新が入ったとき
- ゲームアップデート後、OCR・スキル表示は正常だが **シミュレーションだけ失敗** する
- 新コース・新スキル機構でエンジン側の対応が必要なとき

#### 前提環境

- **JDK 17 以上**（`JAVA_HOME` 設定済み）
- Git
- ネットワーク（初回 Gradle 依存取得）

#### 使わないもの（混同注意）


| 対象                                 | 用途                                               | 本アプリとの関係                                |
| ---------------------------------- | ------------------------------------------------ | --------------------------------------- |
| `build_wasm.bat`                   | `:compose` モジュール用（`wasm.js` を `docs/race/` へコピー） | **使用しない** — 出力は Compose UI 付き `wasm.js` |
| GitHub Releases の `umasim.zip`     | umasim **デスクトップアプリ**配布                           | **使用しない** — レース WASM エンジンとは別物           |
| `docs/race/wasm.js`（umasim リポジトリ内） | Compose ベースのレースエミュレータ Web UI                     | **使用しない** — 本アプリはヘッドレス `race.js` を使用    |


#### umasim のビルド

```powershell
# 1. umasim をクローン（作業用。本リポジトリに含めない）
git clone https://github.com/mee1080/umasim.git
cd umasim

# 2. :race モジュールの Wasm 配布物をビルド
.\gradlew.bat :race:wasmJsBrowserDistribution
```

ビルド成功後、出力は次のディレクトリに生成されます（Kotlin/Wasm の標準パス）:

```text
umasim/race/build/dist/wasmJs/productionExecutable/
```

ビルド後に実在を確認してください:

```powershell
dir race\build\dist\wasmJs\productionExecutable\
```

想定される主なファイル:


| ファイル            | 必須  | 説明                                                                    |
| --------------- | --- | --------------------------------------------------------------------- |
| `race.js`       | ✅   | webpack バンドル。`self.race` として `initializeEngine` / `runSimulation` を公開 |
| `race.js.map`   | 推奨  | ソースマップ（デバッグ用）                                                         |
| `*.wasm`（ハッシュ名） | ✅   | Kotlin/Wasm バイナリ。ビルドごとにファイル名が変わることがある                                 |
| `index.html` 等  | ❌   | コピー不要                                                                 |


#### 本リポジトリへのコピー

コピー元: `umasim/race/build/dist/wasmJs/productionExecutable/`  
コピー先: `desktop-app/public/umaemu/`

```powershell
# 本リポジトリのルートから（パスは環境に合わせて調整）
$src = "..\umasim\race\build\dist\wasmJs\productionExecutable"
$dst = "desktop-app\public\umaemu"

Copy-Item "$src\race.js" $dst -Force
Copy-Item "$src\race.js.map" $dst -Force
Copy-Item "$src\*.wasm" $dst -Force
```

**コピーしないもの**

- `worker.js` — 本プロジェクト固有の Web Worker ラッパー（umasim からは来ない）
- `index.html`、画像、その他 UI 用アセット

#### 古い `*.wasm` の削除

`race.js` は内容ハッシュ付きの `*.wasm` を参照します。更新時は **コピー先に残っている古い `*.wasm` を削除** してください。放置すると不要ファイルが蓄積し、参照先と不一致になることがあります。

```powershell
# 新しい wasm をコピーしたあと、古いハッシュ名の wasm を手動削除
dir desktop-app\public\umaemu\*.wasm
# 新ビルドに含まれないファイルを Remove-Item
```

#### `skill_data.txt` との関係

エンジン（`race.js`）とスキルマスタは **別経路** で管理されています。


| データ                  | 更新方法                                                                            | 役割               |
| -------------------- | ------------------------------------------------------------------------------- | ---------------- |
| `race.js` / `*.wasm` | 手順 7（本節）                                                                        | レース計算ロジック        |
| `skill_data.txt`     | 実行時 GitHub 取得（[手順 4](#4-wasm-エンジンの-skill_datatxt実行時自動)）                         | エンジン初期化時のスキル定義   |
| `umasimSkillData.ts` | `npm run extract-umasim-skills`（[手順 3](#3-umasimskilldatats-の更新ocr-マッチング本番で重要)） | OCR スキル名 → ID 変換 |


エンジン更新時は、併せて次を実行することを推奨します:

```powershell
cd desktop-app
npm run extract-umasim-skills   # OCR マッチング用 TS を同期
```

`skill_data.txt` 自体はネットワーク接続時に自動取得されるため、通常は手動コピー不要です（オフライン時は [手順 4](#4-wasm-エンジンの-skill_datatxt実行時自動) を参照）。

#### 検証手順

```powershell
cd desktop-app
npm run tauri dev
```

確認項目:

- [ ] シミュレーションがエラーなく完了する
- [ ] ブラウザ DevTools の Console に WASM 読み込みエラーがない
- [ ] `desktop-app/public/umaemu/` に `race.js` と対応する `*.wasm` が存在する

---

## npm スクリプト一覧（desktop-app）


| コマンド                            | スクリプト                          | 入力                                      |
| ------------------------------- | ------------------------------ | --------------------------------------- |
| `npm run extract-skill-info`    | `extract_rarity_from_mdb.js`   | `master.mdb`（ルート）                       |
| `npm run extract-umasim-skills` | `extract_umasim_skill_data.js` | umasim `skill_data.txt`（ネットワーク or ローカル） |


> いずれも `desktop-app/` から実行できます。パスはスクリプト内でリポジトリルート基準に解決されます。

---

## トラブルシューティング


| 症状                       | 疑わしい原因                   | 対処                                                          |
| ------------------------ | ------------------------ | ----------------------------------------------------------- |
| 新スキルが OCR 後に空欄になる        | umasim 未更新、またはオンライン取得失敗 | 設定で「最新のスキルデータを取得する」。umasim 側の `skill_data.txt` 更新待ち |
| スキル色がずれる                 | `skillRarityData.ts` が古い | `npm run extract-skill-info`（要 `master.mdb`）。表示正本は実行時一覧 |
| シミュレーションだけ失敗             | `race.js` が古い / ネットワーク   | [手順 7（race.js / WASM エンジンの更新）](#7-racejs--wasm-エンジンの更新) を参照 |
| 新コースが選べない                | `trackData.ts` 未更新       | 手順 5 で追記                                                    |
| 開催チップが出ない                 | `event_track.txt` 取得失敗、またはコース未収録 | オンライン確認。新場は手順 5 |


