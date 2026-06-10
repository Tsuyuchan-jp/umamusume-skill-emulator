# REQ-secure-api-key: Gemini API キーのセキュアストレージ化

- **ステータス**: done
- **作成日**: 2026-06-10 08:42
- **完了日**: 2026-06-10 11:30
- **優先度**: P1

---

## 目的

Gemini API キーを `localStorage` の平文保存から、Windows Credential Manager（Tauri カスタム invoke + Rust keyring crate）へ移行し、ローカル環境での漏洩リスクを下げる。

---

## 採用方針

- **案A**: カスタム Tauri invoke + Rust `keyring` crate
- **保存先**: Windows Credential Manager
- **Service**: `com.umamusume.race-analyzer`
- **Entry**: `gemini_api_key`
- **識別子リネーム**: `com.umamusume.race-analyzer` / `umamusume-race-analyzer`
- macOS/Linux 非対応（Windows のみ）

---

## 実装内容

| ファイル | 変更内容 |
|---------|---------|
| `app/lib/apiKeyStorage.ts` | 新規。invoke ラッパー + localStorage 移行 |
| `src-tauri/src/api_key.rs` | 新規。Credential Manager read/write |
| `app/(main)/page.tsx` | localStorage 直アクセスを apiKeyStorage に置換 |
| `app/components/ApiKeyModal.tsx` | 説明文更新・async 保存 |
| `src-tauri/src/lib.rs` | mod + 4 コマンド登録 |
| `src-tauri/Cargo.toml` | `keyring = "3"` 追加 |
| `src-tauri/tauri.conf.json` | identifier / productName リネーム |

---

## 完了条件

- [x] API キーが `localStorage` に残らない
- [x] 既存キーがあれば自動移行される
- [x] OCR が従来どおり動作する（`geminiOcr.ts` 変更なし）
- [x] identifier が `com.umamusume.race-analyzer`
- [x] `docs/TODO.md` 更新・コミット

---

## 決定事項ログ

| 日時 | 内容 |
|------|------|
| 2026-06-10 08:42 | 案A（keyring + Credential Manager）採用。Stronghold 不採用 |
| 2026-06-10 11:30 | 実装完了。削除 UI なし。移行失敗は console.error のみ |

---

## 検証手順

1. 新規に API キーを登録 → 再起動後も保持されること
2. DevTools → Local Storage で `geminiApiKey` キーが無いこと
3. OCR 実行が成功すること
4. 手動で `localStorage.setItem("geminiApiKey", "AIza...")` → 再起動 → キーが消えていること・OCR 成功
