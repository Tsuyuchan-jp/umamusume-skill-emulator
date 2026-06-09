# REQ-secure-api-key: Gemini API キーのセキュアストレージ化

- **ステータス**: draft
- **作成日**: 2026-06-10
- **優先度**: P1

---

## 目的

Gemini API キーを `localStorage` の平文保存から、Tauri のセキュアストレージへ移行し、ローカル環境での漏洩リスクを下げる。

---

## 現状

- 保存先: `localStorage` キー `geminiApiKey`
- 読み書き: `desktop-app/app/(main)/page.tsx`, `ApiKeyModal.tsx`
- README にも「セキュアストレージ化は今後の改善予定」と記載

---

## スコープ

### やること

- Tauri プラグイン等で API キーを安全に保存・取得
- 既存ユーザーの `localStorage` からの移行（初回起動時に移して削除）
- 設定 UI（ApiKeyModal）の動作維持

### やらないこと

- API キーのクラウド同期
- OCR ロジック（`geminiOcr.ts`）の変更（呼び出し元からキーを渡す形は維持可）

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `app/(main)/page.tsx` | キー読み書きを Tauri 経由に |
| `app/components/ApiKeyModal.tsx` | 保存フロー調整 |
| `src-tauri/` | セキュアストレージコマンド or プラグイン設定 |

---

## 完了条件

- [ ] API キーが `localStorage` に残らない
- [ ] 既存キーがあれば自動移行される
- [ ] OCR が従来どおり動作する
- [ ] `docs/TODO.md` 更新・コミット

---

## 検証手順

1. 新規に API キーを登録 → 再起動後も保持されること
2. `localStorage` に `geminiApiKey` が無いこと
3. OCR 実行が成功すること
4. 既存 `localStorage` データがある環境で移行が動くこと
