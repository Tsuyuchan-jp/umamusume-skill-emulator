# プロジェクト概要

> Cursor 作業チャット起票時に `@docs/PROJECT.md` で参照する正本。
> 変わりにくい情報のみを書く。進捗は `docs/TODO.md` に書く。

## アプリ概要

- **名称**: ウマ娘 レースアナライザー（Umamusume Skill Emulator）
- **目的**: ゲーム内ステータス画面をキャプチャ → OCR → umasim WASM でレースシミュレーション
- **対象**: Steam版・DMM版「ウマ娘 プリティーダービー」（Windows 10/11）
- **現在バージョン**: [`desktop-app/package.json`](../desktop-app/package.json) の `version` が正本（詳細: [バージョン管理](#バージョン管理)）

## 配布・起動（本番）

- **配布形式**: インストーラーは使わず、`desktop-app/src-tauri/target/release/app.exe` を **直接起動・配布**する
- **リリースビルド**: バージョン bump や CHANGELOG 更新時は、完了前に必ず `npm run build:release-exe` で上記 exe を最新化する（詳細: [`RELEASE_BUILD.md`](RELEASE_BUILD.md)）
- **git**: `app.exe` はコミットしない（ビルド成果物）

## 技術スタック

| 領域 | 技術 |
|------|------|
| フロント | Next.js 16, React 19, Tailwind CSS 4 |
| デスクトップ | Tauri 2 |
| シミュレーション | umasim WASM（Web Worker 経由） |
| OCR | Google Gemini API |
| スキルデータ | `umasim/data/skill_data.txt`（GitHub 取得 + ローカル `umasimSkillData.ts`） |

## ディレクトリ構成（主要）

```
umamusume-skill-emulator/
├── desktop-app/                 ★ 本番アプリ
│   ├── app/
│   │   ├── components/          UI コンポーネント
│   │   └── lib/                 ビジネスロジック・データ
│   └── src-tauri/               Rust バックエンド（キャプチャ等）
├── tools/mdb-extractor/         スキルデータ抽出ツール
├── docs/                        ★ 本ドキュメント群（Cursor 運用の正本）
└── UPDATE_SKILLS.md             スキルデータ更新手順
```

## 開発ルール

### Git

- **コミット**: コード変更のたびに必ずコミット（復元点を作る）
- **コミットメッセージ**: `feat/fix/chore: 変更内容の要約`
- **push**: ユーザーが明示依頼したときのみ

### Cursor チャット運用

- **正本**: このファイル + `docs/TODO.md`（メインチャットは持たない）
- **進捗の正本**: `docs/TODO.md` の **Backlog・進行中・完了済み・保留**（着手時・完了時の両方で更新。詳細は TODO 内「エージェント必須手順」）
- **実装**: Agent mode + 新チャット
- **調査**: Ask mode + 新チャット
- **検証**: Agent mode + 新チャット（実装チャットとは分離）
- **日時記録**: `docs/` の更新・ログは `YYYY-MM-DD HH:mm`（`.cursor/rules/docs-management.mdc`）

### REQ（要件ドキュメント）の運用

| 置き場所 | 役割 |
|---------|------|
| `docs/TODO.md` | 次にやることの **唯一の入口**（優先度・REQ リンク） |
| `docs/tasks/REQ-*.md` | 仕様・スコープ・完了条件・決定ログ |
| ロードマップ REQ | マルチ Phase シリーズの索引（例: `REQ-race-detail-graph.md`） |

**必須**: REQ を `draft` で起票したら **同時に TODO Backlog へ1行追加**（詳細は `.cursor/rules/docs-management.mdc`）。

- チャット起票時: まず `@docs/TODO.md` → 着手 REQ を `@` 参照
- 全 REQ の一覧・ステータス: [`docs/tasks/INDEX.md`](tasks/INDEX.md)（TODO の代替ではない）
- REQ が20件超: [`docs/tasks/INDEX.md`](tasks/INDEX.md) で一覧管理（**2026-06-20 新設**）

### コメント・応答言語

- コードコメント: 日本語
- ユーザーへの説明: 日本語

## 触ってはいけない領域（デフォルト）

作業チャットで明示的に指示がない限り、以下は変更しない。

| 領域 | ファイル例 | 理由 |
|------|-----------|------|
| OCR | `app/lib/geminiOcr.ts` | キャプチャ連携の安定性 |
| ファジーマッチ | `app/lib/fuzzyMatcher.ts` | OCR 結果のスキル名解決 |
| キャプチャ / Rust | `src-tauri/` | 実機キャプチャの検証済み領域 |

※ UI の見た目変更のみのタスクでは、上記を触らないことを完了条件に含める。

## スキル表示仕様（色分け）

`getSkillRarityInfoById`（`app/lib/umasimSkillData.ts`）が正本。

| レアリティ | 色 | アイコン |
|-----------|-----|---------|
| unique（通常固有） | `text-blue-400` | ◆ |
| inherit（継承） | `text-emerald-400` | ❖ |
| evo（進化） | `text-red-400` | ★ |
| rare（金） | `text-amber-400` | ✦ |
| その他（normal 等） | `text-zinc-200` | なし |

### 通常固有ガード

- 通常固有は **先頭スロット（index 0）のみ** 配置可能
- `canPlaceSkillAtIndex` / `sanitizeSkillIds` で制御

### パレット除外ルール

`SkillCommandPalette.tsx` の `PALETTE_EXCLUDED_RARITIES` が正本。

| レアリティ | パレット表示 | 理由 |
|-----------|-------------|------|
| unique | 専用パレットのみ | 通常固有は別 UI |
| special | 非表示 | 育成で取得不可の特殊スキル |
| minus | 非表示 | マイナス効果・実用性なし |

## 起動方法

### 開発

```powershell
cd desktop-app
npm install
npm run tauri dev
```

### 配布用 exe（本番相当）

```powershell
cd desktop-app
npm run build:release-exe
```

成果物: `desktop-app/src-tauri/target/release/app.exe` — 詳細は [`RELEASE_BUILD.md`](RELEASE_BUILD.md)

## バージョン管理

> リリース手順の正本: [`RELEASE_BUILD.md`](RELEASE_BUILD.md)（ビルド・bump チェックリスト含む）

### 正本と反映先（2026-06-23 一元化）

| 役割 | ファイル | 更新方法 |
|------|---------|---------|
| **正本** | `desktop-app/package.json` → `version` | **手動のみ**（semver bump） |
| UI 表示 | `desktop-app/app/lib/version.ts` | 正本を import（`APP_VERSION` / `APP_VERSION_LABEL`） |
| Tauri | `desktop-app/src-tauri/tauri.conf.json` | `"version": "../package.json"` でビルド時に解決 |
| Rust crate | `desktop-app/src-tauri/Cargo.toml` | `npm run sync-version` で `package.json` に合わせる |
| 整合性テスト | `desktop-app/app/lib/version.test.ts` | Vitest（`npm test` に含む） |

### 自動同期コマンド

| コマンド | 内容 |
|---------|------|
| `npm run sync-version` | `Cargo.toml` の `version` を `package.json` に同期 |
| `npm run build` | 先頭で `sync-version` を実行してから `next build` |
| `npm run tauri` | 先頭で `sync-version` を実行してから Tauri CLI |
| `npm run build:release-exe` | `build-release-exe.ps1` 内でも `sync-version` を実行 |

### リリース時に手動で触るもの

1. `desktop-app/package.json` の `version`
2. `docs/CHANGELOG.md`（当該バージョン節の追記）
3. （任意）`docs/TODO.md` / REQ の完了記録

`Cargo.toml` は `sync-version` 実行後に差分が出たら **同一コミットに含める**（正本とのミラー）。

### 廃止した手順（v1.1.0 リリース時まで）

- `tauri.conf.json` への version 直書き（例: `"1.1.0"`）
- `app/(main)/page.tsx` ヘッダーへの `vX.Y.Z` 直書き
- `docs/PROJECT.md` / README への固定バージョン番号の手動メンテ（正本リンクに置換）

## 関連ドキュメント

- 進捗・Todo: `docs/TODO.md`
- **REQ 索引（全件カタログ）**: `docs/tasks/INDEX.md`
- 更新履歴: `docs/CHANGELOG.md`
- **リリースビルド（app.exe）**: `docs/RELEASE_BUILD.md`
- 個別要件: `docs/tasks/REQ-*.md`
- チャット起票手順: `docs/CHAT_TEMPLATE.md`
- スキルデータ更新: `UPDATE_SKILLS.md`
