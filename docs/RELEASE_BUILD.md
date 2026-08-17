# リリースビルド手順（配布用 app.exe）

> **配布正本**: インストーラー（msi / setup.exe）は使わず、**`app.exe` を直接起動・配布**する。
> リリース作業（バージョン bump・CHANGELOG 追記など）の **最終ステップで必ず** 本手順を実行する。ユーザーからの明示指示がなくてもエージェントが実施する。

---

## 配布物のパス（正本）

```text
desktop-app/src-tauri/target/release/app.exe
```

- この exe をそのまま起動して利用する
- 配布時は次を **同じフォルダ（または同じ zip）に入れて** 渡す
  - `desktop-app/src-tauri/target/release/app.exe`
  - リポジトリ直下の [`NOTICE.md`](../NOTICE.md)
  - [`licenses/AGPL-3.0.txt`](../licenses/AGPL-3.0.txt)
- ソース一式は毎回同梱しなくてよい。配布を受けた人から求められたら渡す（案内は `NOTICE.md`）
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

## バージョン管理

> **正本**: `desktop-app/package.json` の `version` フィールドのみ。  
> 2026-06-23 に UI / Tauri / Cargo の多重管理を廃止し一元化（コミット `89434db`）。

### ファイルと役割

| ファイル | 役割 | bump 時の操作 |
|---------|------|--------------|
| `desktop-app/package.json` | **semver 正本** | **ここだけ手動更新** |
| `desktop-app/app/lib/version.ts` | UI 用定数（`APP_VERSION`, `APP_VERSION_LABEL`） | 不要 |
| `desktop-app/app/(main)/page.tsx` | ヘッダーに `APP_VERSION_LABEL` を表示 | 不要 |
| `desktop-app/src-tauri/tauri.conf.json` | `"version": "../package.json"` | 不要 |
| `desktop-app/src-tauri/Cargo.toml` | Rust crate の version（cargo ログ用） | `sync-version` で同期 |
| `desktop-app/scripts/sync-cargo-version.js` | `package.json` → `Cargo.toml` 同期スクリプト | 通常は直接実行不要 |
| `desktop-app/app/lib/version.test.ts` | 正本・Tauri 参照・Cargo の整合テスト | `npm test` で自動検証 |

### 同期タイミング

`sync-version` は次のいずれかで自動実行される。

- `npm run sync-version`（明示）
- `npm run build`
- `npm run tauri`（`tauri dev` / `tauri build` 含む）
- `npm run build:release-exe`（`build-release-exe.ps1` 先頭）

### バージョン bump の手順（リリース時）

1. **`desktop-app/package.json` の `version` を更新**（例: `1.1.0` → `1.2.0`）
2. **`docs/CHANGELOG.md`**: [`Unreleased` の運用](CHANGELOG.md#運用unreleased-の維持)に従い、**`Unreleased` の全項目を新バージョン節へ昇格**（`## vX.Y.Z — YYYY-MM-DD`）。`Unreleased` は `（なし）` に戻す
3. `cd desktop-app` → `npm test`（`version.test.ts` 含む）
4. `npm run build:release-exe`（`sync-version` 実行後、`Cargo.toml` に差分があればコミットに含める）
5. アプリ UI ヘッダーの `v*` 表示を実機で確認
6. コミット（`app.exe` 本体は含めない）

### やらないこと

- `tauri.conf.json` に `"version": "1.x.y"` と直書きする（`../package.json` 参照を維持）
- `page.tsx` にバージョン文字列を直書きする
- `package.json` 以外のファイルだけ version を変えて正本とミラーをずらす

---

## エージェント必須（リリース Phase / バージョン bump 時）

次のいずれかに該当する作業を **完了報告・コミットの前** に行う。

- `desktop-app/package.json` の **version bump**（正本。`tauri.conf.json` / `Cargo.toml` / UI は自動同期）
- `docs/CHANGELOG.md` の **新バージョン追記**
- REQ の **R3 相当**（リリースビルド Phase）
- ユーザーが「リリース」「配布用 exe 更新」と言ったとき

### バージョン bump 時

[`バージョン管理`](#バージョン管理) を参照。要約:

1. **`desktop-app/package.json` の `version` のみ** を更新する（正本）
2. `docs/CHANGELOG.md` — **`Unreleased` を新バージョン節へ昇格**し、`Unreleased` を `（なし）` に戻す（[`CHANGELOG.md` 運用節](CHANGELOG.md#運用unreleased-の維持)）
3. `npm test` → `npm run build:release-exe`（`sync-version` は build / tauri / release スクリプトで自動実行）
4. `Cargo.toml` に同期差分が出たらコミットに含める

手動更新不要: `tauri.conf.json`（`../package.json` 参照）、`page.tsx`（`app/lib/version.ts` 経由）。

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

## トラブルシュート（next build）

### `LayoutConfig<"/lib/stitch">` / `Property 'default' is missing`

**原因**: `app/` 配下に Next.js の [予約ファイル名](https://nextjs.org/docs/app/api-reference/file-conventions)（`layout.ts` / `page.ts` / `route.ts` 等）がある。例: 旧 `app/lib/stitch/layout.ts` が `/lib/stitch` ルートのレイアウトと誤認された（2026-06-27）。

**対処**:

1. 該当ファイルを予約名以外にリネーム（結合モジュールは **`layoutOpenCv.ts`** が正本）
2. 古い型キャッシュを削除して再ビルド:

```powershell
cd desktop-app
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

詳細: [`REQ-stitch-rewrite.md`](tasks/REQ-stitch-rewrite.md) 決定事項ログ（2026-06-27 19:56）。

---

## 関連

- プロジェクト概要・配布方針: `docs/PROJECT.md`
- 変更履歴: `docs/CHANGELOG.md`
- 開発ルール（エージェント常時適用）: `.cursor/rules/development.mdc`
