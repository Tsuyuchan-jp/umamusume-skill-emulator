# REQ-release-v1.7.0: v1.7.0 リリース（実機クローズ済み差分 + ビルド）

> v1.6.1 以降の Unreleased を **v1.7.0** として配布するための作業正本。

- **ステータス**: done
- **作成日**: 2026-09-12 09:02
- **関連コミット**: `4c042e6`〜`c692f89`

---

## 目的

実機確認済みの起動時スキルカタログ／開催ローテ、OCR 救済（難読・2文字誤読・シミュ対象外）、umasim `:race` WASM 差し替えを **v1.7.0** として配布する。

---

## スコープ

### やること

- `desktop-app/package.json` を `1.7.0` に bump
- `docs/CHANGELOG.md` の Unreleased を v1.7.0 節へ昇格
- `npm test` → `npm run build:release-exe`

### やらないこと

- 新機能の追加実装
- Backlog の P1 / P2 項目

---

## 設計制約（契約）

該当なし（版上げと配布 exe の再生成のみ）。

---

## 永続正本同期（エージェント必須）

| トリガー | 更新先 |
|----------|--------|
| 着手 | `TODO.md` 進行中 |
| version bump | `package.json`（正本）・CHANGELOG 昇格 |
| 完了 | 本 REQ `done`、`TODO.md`、`INDEX.md` |
| Phase / REQ 完了 | CONCEPT-MAP は新用語なしなら本文を触らない |

---

## 完了条件

- [x] `desktop-app/package.json` → `1.7.0`
- [x] `docs/CHANGELOG.md` に v1.7.0 節（Unreleased は「（なし）」）
- [x] `npm test` 通過（`version.test.ts` 含む）
- [x] `npm run build:release-exe` で `app.exe` 生成
- [x] `docs/TODO.md` 完了済み行にコミットハッシュ

---

## 決定事項ログ

| 日時 | 内容 |
|------|------|
| 2026-09-12 09:02 | ユーザー指示。現状を 1.7.0 として版上げ・リリースビルド |
| 2026-09-12 09:02 | CONCEPT-MAP: 今回の用語追加なし（既存カードで十分） |
| 2026-09-12 09:08 | `npm test` 116件 PASS・`build:release-exe` 成功（`app.exe` 2026-09-12 09:08、約 20.9 MB） |
