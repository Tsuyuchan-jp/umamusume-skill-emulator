# 更新履歴

> アプリのリリース単位の変更記録。開発運用ドキュメント（TODO / REQ）とは別管理。

---

## v1.0.7 — 2026-06-10

### 変更

- **Gemini API キーのセキュアストレージ化**
  - 保存先を `localStorage` から **Windows 資格情報マネージャー** へ移行
  - 起動時に旧 `localStorage` キー（`geminiApiKey`）があれば自動移行（成功後に削除）
  - `keyring` crate に `windows-native` を指定し、再起動後もキーが保持されるよう修正
- **アプリ識別子のリネーム**
  - `identifier`: `com.umamusume.race-analyzer`（旧: `com.umareceipt.capture`）
  - `productName`: `umamusume-race-analyzer`（旧: `uma-receipt-capture`）
- **ApiKeyModal** の説明文を資格情報マネージャー保存に合わせて更新

### ドキュメント

- Cursor 運用: 設計レビュー / バグ報告テンプレート整備（`docs/CHAT_TEMPLATE.md`）

### 修正

- 本番ビルド（`npm run tauri build`）向け TypeScript 修正
  - `page.tsx`: 型 import 追加
  - `SimulationLauncher.tsx`: strict チェック対応

### ビルド

- 本番ビルド（`npm run tauri build`）通過
- 成果物: `umamusume-race-analyzer_1.0.7_x64-setup.exe` / `.msi`

---

## v1.0.6 — （以前）

- スキル UI（5色表示・通常固有ガード・パレット除外）
- キャプチャ → OCR → umasim WASM シミュレーション一連フロー
- FHD 実機検証済み

※ v1.0.6 以前の詳細は git 履歴を参照。
