# REQ-release-v1.7.1: v1.7.1 リリース（Gemini OCR 安定化）

> v1.7.0 以降の Gemini OCR 修正を **v1.7.1** として配布するための作業正本。

- **ステータス**: done
- **作成日**: 2026-09-24
- **関連コミット**: `16c747a`、リリースビルドコミット

---

## 目的

`Gemini 3.1 Flash-Lite` で頻発した OCR エラーを受け、後継の `Gemini 3.5 Flash-Lite` へ移行する。429 と503を区別し、実機 OCR 完了を確認した状態で配布用 `app.exe` を更新する。

## スコープ

### やること

- `desktop-app/package.json` を `1.7.1` に bump
- `docs/CHANGELOG.md` に v1.7.1 のリリース内容を記録
- Gemini OCR の将来フォールバックを `docs/TODO.md` に追加
- `npm test` → `npm run build:release-exe`

### やらないこと

- 自動フォールバックの実装（将来タスク）
- OCR プロンプト・スキル照合ロジックの変更

## 完了条件

- [x] `Gemini 3.5 Flash-Lite` で実機 OCR 完了
- [x] `desktop-app/package.json` → `1.7.1`
- [x] `docs/CHANGELOG.md` に v1.7.1 節（Unreleased は「（なし）」）
- [x] `docs/TODO.md` に将来のモデルフォールバックを記載
- [x] `npm test` 通過（`version.test.ts` を含む、118件）
- [x] `npm run build:release-exe` で `app.exe` を生成

## 決定事項ログ

| 日時 | 内容 |
|------|------|
| 2026-09-24 | `Gemini 3.1 Flash-Lite` の OCR エラー継続を受け、`Gemini 3.5 Flash-Lite` へ切替。ユーザーのローカル実機で OCR 完了を確認 |
| 2026-09-24 22:57 | `npm test` 118件 PASS・`build:release-exe` 完了。`app.exe` を更新（約20.9 MB） |
