# リリースビルド手順（配布用 app.exe）

> **配布正本**: インストーラー（msi / setup.exe）は使わず、**`app.exe` を直接起動・配布**する。
> リリース作業（バージョン bump・CHANGELOG 追記など）の **最終ステップで必ず** 本手順を実行する。ユーザーからの明示指示がなくてもエージェントが実施する。

---

## 配布物のパス（正本）

```text
desktop-app/src-tauri/target/release/app.exe
```

- この exe をそのまま起動して利用する
- 配布時も **この1ファイル**（必要なら同フォルダの DLL 等は Tauri が同梱済みの単体 exe 想定）を渡す
- `bundle/msi`・`bundle/nsis` のインストーラーは **生成しても配布しない**（検証用に `npm run tauri build` だけ走らせる場合は除く）

---

## 標準コマンド（毎回これ）

```powershell
cd desktop-app
npm test
npm run build
npm run build:release-exe
```

| コマンド | 内容 |
|---------|------|
| `npm test` | 単体テスト |
| `npm run build` | Next.js 本番ビルド（`tauri build` の前段でも自動実行されるが、失敗を早く見るため明示実行を推奨） |
| `npm run build:release-exe` | `tauri build --no-bundle`（`scripts/build-release-exe.ps1` 経由）— **`src-tauri/target/release/app.exe`** に出力 |

`build-release-exe.ps1` は `CARGO_TARGET_DIR` を `desktop-app/src-tauri/target` に固定する。Cursor 等のサンドボックスで一時 target にだけ exe ができるのを防ぐ。

初回や Rust 依存変更後は **数分〜十数分** かかることがある。エージェント実行時は Shell の **`required_permissions: ["all"]`** を付ける。

---

## エージェント必須（リリース Phase / バージョン bump 時）

次のいずれかに該当する作業を **完了報告・コミットの前** に行う。

- `desktop-app/package.json` の **version bump**（正本。`tauri.conf.json` / `Cargo.toml` / UI は自動同期）
- `docs/CHANGELOG.md` の **新バージョン追記**
- REQ の **R3 相当**（リリースビルド Phase）
- ユーザーが「リリース」「配布用 exe 更新」と言ったとき

### バージョン bump 時

1. **`desktop-app/package.json` の `version` のみ** を更新する（正本）
2. `npm run sync-version` で `Cargo.toml` を同期（`npm run build` / `npm run tauri` / `build:release-exe` でも自動実行）
3. `tauri.conf.json` は `"version": "../package.json"` 参照のため手動変更不要
4. UI ヘッダーは `app/lib/version.ts` が `package.json` を読むため手動変更不要

### 手順

1. 上記「標準コマンド」を **プロジェクト直下の `target/release/`** に出力されるよう実行する（サンドボックス外・`required_permissions: ["all"]` 推奨。キャッシュ先にだけ exe ができるのを防ぐ）
2. 成功後、`app.exe` の更新日時または `--version` 相当（アプリ UI のバージョン表示）を確認
3. CHANGELOG のビルド節に **`app.exe` 更新済み** と記載（インストーラー名のみの記載にしない）
4. コミットメッセージに `app.exe` ビルド実施を含めてもよい（例: `chore: v1.1.0 リリースビルド（app.exe 更新）`）

### やらないこと

- `app.exe` を git にコミットしない（`.gitignore` 対象のビルド成果物）
- リリース作業で **frontend だけ build して exe を更新しない** こと

---

## オプション: インストーラー付きビルド

配布はしないが、MSI/NSIS の生成確認が必要なときのみ:

```powershell
cd desktop-app
npm run tauri build
```

---

## 関連

- プロジェクト概要・配布方針: `docs/PROJECT.md`
- 変更履歴: `docs/CHANGELOG.md`
- 開発ルール（エージェント常時適用）: `.cursor/rules/development.mdc`
