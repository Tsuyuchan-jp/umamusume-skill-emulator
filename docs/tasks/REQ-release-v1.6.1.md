# REQ-release-v1.6.1: v1.6.1 リリース（実機クローズ済み差分 + ビルド）

> v1.6.0 以降の Unreleased を **v1.6.1** として配布するための作業正本。

- **ステータス**: in-progress
- **作成日**: 2026-09-10 19:42
- **関連コミット**: （完了後に記入）

---

## 目的

実機確認済みの OCR 結合濁点修正・AppData キャッシュ修正・スキルマスタ更新・ファイル OCR の WebP 対応・umasim クレジットを **v1.6.1** として配布する。

---

## スコープ

### やること

- `desktop-app/package.json` を `1.6.1` に bump
- `docs/CHANGELOG.md` の Unreleased を v1.6.1 節へ昇格
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

- [ ] `desktop-app/package.json` → `1.6.1`
- [ ] `docs/CHANGELOG.md` に v1.6.1 節（Unreleased は「（なし）」）
- [ ] `npm test` 通過（`version.test.ts` 含む）
- [ ] `npm run build:release-exe` で `app.exe` 生成
- [ ] `docs/TODO.md` 完了済み行にコミットハッシュ

---

## 決定事項ログ

| 日時 | 内容 |
|------|------|
| 2026-09-10 19:42 | ユーザー指示。新規実装は実機 OK 済み。版上げは 1.6.1 |
| 2026-09-10 19:42 | CONCEPT-MAP: 今回の用語追加なし（既存カードで十分） |
