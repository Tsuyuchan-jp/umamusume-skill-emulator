# 更新履歴

> アプリのリリース単位の変更記録。開発運用ドキュメント（TODO / REQ）とは別管理。

---

## Unreleased

### 開発者向け

- **バージョン管理の一元化** — 正本を `desktop-app/package.json` に集約。UI（`app/lib/version.ts`）、Tauri（`tauri.conf.json` → `../package.json`）、`Cargo.toml`（`npm run sync-version`）は自動同期。運用: [`RELEASE_BUILD.md`](RELEASE_BUILD.md#バージョン管理)

---

## v1.1.0 — 2026-06-19

### 新機能

- **全画面 Cockpit UI** — サイドバー折りたたみ・右カラム全幅・KPI ストリップ・グラフ常時表示
- **サイドバー狭幅 UI** — 380px 運用向けレイアウト整備・設定パネル折りたたみ
- **直近レース詳細グラフ** — Google Map 型パン/ズーム、Interaction Canvas、overlay handoff、Phase 4 比較、スキル帯・Tooltip
- **タブ切り替え keep-alive** — 非アクティブタブの state 保持
- **パレット** — スキルデータ参照をローカル正本（`umasimSkillData.ts`）に統一

### 修正

- スタミナキープ持続線の異常描画
- グラフ縦拡大時のスキル帯クリップ
- シミュレーション失敗時のトースト文言改善（`null` 等の内部エラー非表示）
- 詳細グラフ（`raceDetail`）取得失敗時のユーザー通知
- 各種グラフ UX（Y 軸テキスト選択防止、ホイール 1.3、overlay 復帰 latency 短縮 等）
- `simulationCount` localStorage 破損時の NaN ガード

### データ

- スキルマスタを umasim `skill_data.txt` と同期（2026-06-19 extract / 2021件）

### ビルド

- 配布正本: `desktop-app/src-tauri/target/release/app.exe`（インストーラーは使わない。手順は `docs/RELEASE_BUILD.md`）
- `npm run build:release-exe`（`tauri build --no-bundle`）で exe 更新

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
