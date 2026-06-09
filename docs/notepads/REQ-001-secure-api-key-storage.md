# REQ-001: Gemini APIキーのセキュアストレージ化

> **ステータス**: 草案（試験用サンプル）  
> **作成日**: 2026-06-10  
> **対象アプリ**: `desktop-app/`  
> **優先度**: P2（セキュリティ改善）

---

## 1. 背景・課題

現状、Gemini API キーはブラウザの `localStorage` に平文保存されている。
README にも「セキュアストレージ化は今後の改善予定」と記載あり。

### 現状の問題

- 平文保存のため、ローカルストレージを読める手段でキーが漏洩しうる
- Tauri デスクトップアプリとして、OS 標準の秘密情報ストアを使っていない

### 関連コード（実装時に参照）

- `desktop-app/src/` 内の API キー保存・読み込み処理
- Tauri 側: `desktop-app/src-tauri/`

---

## 2. 目的（ゴール）

API キーを **OS のセキュアストレージ**（Windows Credential Manager 等）に移行し、
`localStorage` への平文保存を廃止する。

### 成功条件

- [ ] 既存ユーザーの API キーが初回起動時に自動マイグレーションされる
- [ ] 設定画面からキーの登録・更新・削除が従来どおり可能
- [ ] `localStorage` に API キーが残らない（マイグレーション後に削除）
- [ ] マイグレーション失敗時はユーザーに再入力を促す（サイレント失敗しない）

---

## 3. スコープ

### 含む（In Scope）

- Windows 10/11 向け Credential Manager 連携（Tauri plugin または Rust crate）
- フロントエンドの保存先切り替え（Tauri コマンド経由）
- 既存 `localStorage` データのワンタイム移行

### 含まない（Out of Scope）

- macOS / Linux 対応（本プロジェクトは Windows のみ）
- API キーの暗号化アルゴリズムの独自実装（OS 標準に委ねる）
- Gemini 以外の API キー管理

---

## 4. 機能要件

| ID | 要件 | 受け入れ基準 |
|---|---|---|
| FR-01 | キー保存 | Tauri コマンド `save_api_key` で Credential Manager に保存できる |
| FR-02 | キー取得 | `get_api_key` で OCR 処理前にキーを取得できる |
| FR-03 | キー削除 | 設定画面の「削除」で Credential Manager から消える |
| FR-04 | マイグレーション | `localStorage` にキーがある場合、初回のみ自動移行して削除する |
| FR-05 | エラー表示 | 保存・取得失敗時、設定画面に日本語のエラーメッセージを表示する |

---

## 5. 非機能要件

| ID | 要件 | 目標値 |
|---|---|---|
| NFR-01 | 後方互換 | v1.0.6 以前のユーザーがアップデート後も再設定なしで動作 |
| NFR-02 | パフォーマンス | キー取得が OCR 開始を 100ms 以上遅延させない |
| NFR-03 | セキュリティ | キーをログ・コンソール・コミットに出力しない |

---

## 6. 技術方針（案）

1. Rust 側に `api_key` モジュールを追加（Credential Manager ラッパー）
2. 既存の `localStorage` 読み書きを Tauri invoke に置き換え
3. アプリ起動時に `migrate_api_key_from_local_storage` を1回実行

### 検討事項（未決定）

- [ ] 使用 crate: `keyring` vs Tauri 公式 plugin
- [ ] マイグレーション失敗時の UX（モーダル vs トースト）

---

## 7. テスト観点

- 新規インストール: キー登録 → 再起動 → OCR が動く
- アップグレード: `localStorage` にキーあり → 起動 → 自動移行 → OCR が動く
- キー削除後: OCR が「APIキー未設定」エラーを出す
- マイグレーション後: DevTools で `localStorage` にキーが無いことを確認

---

## 8. 新チャットでの使い方（プロンプト例）

```
@REQ-001-secure-api-key-storage.md を要件として、
desktop-app の API キー保存をセキュアストレージに移行する実装計画を立ててください。
既存の localStorage 処理の場所を先に調査してください。
```
