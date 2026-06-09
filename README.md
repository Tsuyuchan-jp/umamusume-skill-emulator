# ウマ娘 レースアナライザー

Steam版「ウマ娘 プリティーダービー」向けのレースアナライザーです。ゲーム内の詳細ステータス画面をキャプチャし、OCR でデータを抽出、umasim WASM エンジンでレースをシミュレーションします。

**現在のバージョン**: v1.0.6

## プロジェクト構成

```
umamusume-skill-emulator/
├── desktop-app/     ★ 本番アプリ（Next.js 16 + Tauri 2 + React 19）
├── webapp/          エミュレータ R&D 用（TS 物理エンジン・Vitest・parity 検証）
├── tools/mdb-extractor/  master.mdb からスキルデータを抽出
├── .cursor/rules/   Cursor Agent 用プロジェクトルール
└── UPDATE_SKILLS.md スキルデータ更新手順
```

### desktop-app と webapp の関係

| | desktop-app | webapp |
|--|-------------|--------|
| 状態 | **本番** | 研究・検証用（維持） |
| シミュレーション | umasim WASM (`race.js`) | 自前 TS `RaceSimulator` |
| 用途 | キャプチャ → OCR → シミュレーション → 分析 | umasim/race のリバースエンジニアリング、エンジン改良 |

## 開発環境セットアップ

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

1. アプリの設定画面から **Gemini API キー** を登録（OCR に必須）
2. Steam版ウマ娘を起動（ウィンドウ名: `UmamusumePrettyDerby_Jpn`）

## ワークフロー

```
[ゲーム画面] → Tauri キャプチャ → OpenCV.js 画像結合
    → Gemini OCR → スキル名マッチング → umasim WASM シミュレーション → 結果表示
```

## データ更新（ゲームアップデート後）

詳細は [UPDATE_SKILLS.md](./UPDATE_SKILLS.md) を参照。

```powershell
# master.mdb をルートに配置できる場合（フル更新）
cd desktop-app
npm run extract-db              # webapp 用 SkillDataGen.ts
npm run extract-skill-info      # UI 色分け
npm run extract-umasim-skills   # OCR スキル名マッチング（本番で重要）

# master.mdb がない場合の最低限
npm run extract-umasim-skills   # ネットワーク必須
```

手動更新: `trackData.ts`（コース）、`race_presets.json`（プリセット）

## 動作確認済み（P0）

以下は実機検証で開発環境の正常動作を確認済みです。

- `npm run tauri dev` での起動
- キャプチャ → 画像結合 → OCR → シミュレーションの一連フロー
- `opencv.js` / `race.js` / `worker.js` の動作

## 開発ルール

- Cursor 用ルール: `.cursor/rules/`
- 人間向け要約: `desktop-app/AI_DEVELOPMENT_RULES.md`

## 廃止済み

因子管理 DB・Tesseract OCR・Supabase 連携（旧要件 v1.3）は開発予定なし。
