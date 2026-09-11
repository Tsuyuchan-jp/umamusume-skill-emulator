# ウマ娘 レースアナライザー

Steam版・DMM版「ウマ娘 プリティーダービー」向けのレースアナライザーです。ゲーム内の詳細ステータス画面をキャプチャし、OCR でデータを抽出、umasim WASM エンジンでレースをシミュレーションします。

**現在のバージョン**: [`desktop-app/package.json`](./desktop-app/package.json) の `version`（表示例: アプリヘッダー左下の `v*`）

更新履歴: [docs/CHANGELOG.md](./docs/CHANGELOG.md)  
バージョン bump・リリース手順: [docs/RELEASE_BUILD.md](./docs/RELEASE_BUILD.md#バージョン管理)  
**開発・Cursor 運用**: [docs/DOCS-GUIDE.md](./docs/DOCS-GUIDE.md)

## ライセンス・クレジット

レースシミュレーションは [umasim](https://github.com/mee1080/umasim)（mee1080、[AGPLv3](licenses/AGPL-3.0.txt)）を利用しています。詳細・ソース提供の案内は [NOTICE.md](./NOTICE.md) を参照してください。

本リポジトリは公開 GitHub としては配布しません。配布を受けた方からの求めがあれば、対応するソースを提供します。

## プロジェクト構成

```
umamusume-skill-emulator/
├── desktop-app/          ★ 本番アプリ（Next.js 16 + Tauri 2 + React 19）
├── tools/mdb-extractor/  master.mdb / umasim からスキルデータを抽出
├── .cursor/rules/        Cursor Agent 用プロジェクトルール
└── UPDATE_SKILLS.md      スキルデータ更新手順
```

## 動作環境

アプリを**利用する**際の前提条件です。開発・ビルド手順は [開発環境セットアップ](#開発環境セットアップ) を参照してください。

### 対応 OS

- **Windows 10 / 11（64bit）** のみ
- Win32 / Tauri ベースのため、macOS・Linux には非対応

### 対象ゲーム

- **Steam版・DMM版**の「ウマ娘 プリティーダービー」（両方対応済み）
- ゲームを起動し、ウィンドウが**表示されている**こと

ウィンドウ検出の条件（`desktop-app/src-tauri/src/window.rs`）:

| 項目 | 条件 |
|------|------|
| タイトル | `UmamusumePrettyDerby_Jpn` / `ウマ娘 プリティーダービー` / `umamusume`（大文字小文字不問）のいずれかを含む |
| クラス名 | `UnityWndClass` を含む |
| 状態 | 可視（非表示ウィンドウは対象外） |

### 画面解像度・DPI

- **FHD（1920×1080）で P0 実機検証済み**
- キャプチャはクライアント領域の高さに基づく 9:16 比率で領域を計算するため、他解像度でも動作する可能性はあるが、**未検証・未保証**
- DPI: `SetProcessDPIAware` を使用。Windows 表示スケール **100%〜125% を推奨**。150% 超ではキャプチャ位置のずれに注意

### OCR（Gemini API）

- **Google Gemini API キーが必須**（アプリの設定画面から登録）
- 使用モデル: `gemini-3.1-flash-lite` のみ（Auto-Fallback なし）
- API キーは **Windows 資格情報マネージャー** に保存される（`localStorage` には保存しない）

### ネットワーク

- **オンライン推奨** — 初回起動時やゲームアップデート直後は、umasim の最新 `skill_data.txt` を GitHub から取得するためインターネット接続があると確実です
- **オフライン時** — 以前オンラインで成功したキャッシュ（AppData）またはアプリ同梱の `skill_data.txt` でシミュレーションを継続できます（最新版ではない可能性あり。フォールバック使用時はトーストで通知）
- **Google Gemini API** — OCR 画像解析に必須（オフラインでは OCR 不可）

## 開発環境セットアップ

アプリを**開発・ビルドする**際に必要なツールと手順です。利用時の前提は [動作環境](#動作環境) を参照してください。

### 必要なツール

- Node.js（npm）
- Rust（edition 2021 以上）
- Tauri ビルド依存（Windows: Visual Studio Build Tools, WebView2）

### 起動（desktop-app）

```powershell
cd desktop-app
npm install
npm run tauri dev
```

- Next.js 単体: `npm run dev` → http://localhost:3000
- デスクトップビルド: `npm run tauri build`

### 初回設定

1. アプリの設定画面から **Gemini API キー** を登録（[OCR（Gemini API）](#ocrgemini-api) 参照）
2. ゲームを起動（[対象ゲーム](#対象ゲーム) 参照）

## ワークフロー

```
[ゲーム画面] → Tauri キャプチャ → OpenCV.js 画像結合
    → Gemini OCR → スキル名マッチング → umasim WASM シミュレーション → 結果表示
```

## データ更新（ゲームアップデート後）

詳細は [UPDATE_SKILLS.md](./UPDATE_SKILLS.md) を参照。

```powershell
# master.mdb をルートに配置できる場合
cd desktop-app
npm run extract-skill-info      # UI 色分け（master.mdb 直結）
npm run extract-umasim-skills   # OCR スキル名マッチング（本番で重要）

# master.mdb がない場合の最低限
npm run extract-umasim-skills   # ネットワーク必須
```

手動更新: `trackData.ts`（新コース追加時）、`race.js` / WASM エンジン（[手順 7](UPDATE_SKILLS.md#7-racejs--wasm-エンジンの更新)）。スキル一覧とチャンミ／LoH プリセットは起動時に umasim から取得（再配布不要）

## バージョン管理（開発者向け）

アプリの semver **正本は `desktop-app/package.json` の `version` のみ**。UI・Tauri・Rust はここから自動参照・同期する（2026-06-23 以降）。

| 反映先 | 仕組み | 手動更新 |
|--------|--------|----------|
| アプリ UI（ヘッダー） | `app/lib/version.ts` が `package.json` を import | 不要 |
| Tauri バンドル | `src-tauri/tauri.conf.json` の `"version": "../package.json"` | 不要 |
| `Cargo.toml` | `npm run sync-version`（`scripts/sync-cargo-version.js`） | 不要（同期コマンドで更新） |

### リリース時（バージョン bump）

```powershell
cd desktop-app
# 1. package.json の version を semver で更新
# 2. docs/CHANGELOG.md に当該バージョンを追記
npm test                    # version.test.ts で整合性も検証
npm run build:release-exe   # sync-version → build → tauri build
```

詳細・エージェント向けチェックリスト: [docs/RELEASE_BUILD.md](./docs/RELEASE_BUILD.md)

**やらないこと（旧運用）**: `page.tsx` への `vX.Y.Z` 直書き、`tauri.conf.json` への version 直書き、`docs/PROJECT.md` への固定バージョン番号の手動更新。

## 動作確認済み（P0）

以下は **FHD（1920×1080）** 環境での実機検証で確認済みです。

- `npm run tauri dev` での起動
- キャプチャ → 画像結合 → OCR → シミュレーションの一連フロー
- `opencv.js` / `race.js` / `worker.js` の動作

## 開発ルール

- **docs 運用・進捗**: [docs/DOCS-GUIDE.md](./docs/DOCS-GUIDE.md) · [docs/TODO.md](./docs/TODO.md)
- `.cursor/rules/`（Cursor Agent 用・正本）

## 廃止済み

- 因子管理 DB・Tesseract OCR・Supabase 連携（旧要件 v1.3）は開発予定なし
- `webapp/`（旧 TS 物理エンジン原型・Vitest parity 検証用）は削除済み。シミュレーションは umasim WASM のみ
