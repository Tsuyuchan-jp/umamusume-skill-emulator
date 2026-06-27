# REQ-XXX: （機能名）

> 大きめの機能・仕様変更用テンプレート。
> 小さな修正は `docs/TODO.md` だけで足りる。このファイルは不要。
>
> **起票時必須**: 本 REQ を `draft` で作成したら、**同一コミット内**で `docs/TODO.md` Backlog に1行追加する（タイトル・優先度・本ファイルへのリンク）。詳細は `.cursor/rules/docs-management.mdc`。

- **ステータス**: draft / in-progress / done
- **作成日**: YYYY-MM-DD HH:mm
- **関連コミット**: （完了後に記入）

---

## 目的

（なぜこの機能が必要か。1〜3文）

---

## スコープ

### やること

- 

### やらないこと

- 

---

## 仕様

（UI 挙動、データ条件、エッジケース）

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| | |

---

## 永続正本同期（エージェント必須）

> 正本: [`DOCS-GUIDE.md`](../DOCS-GUIDE.md)「永続正本同期表」。本節は **この REQ のドメイン固有** を書く。無記載なら同表のドメイン行のみ適用。

| トリガー | 更新先 |
|----------|--------|
| 着手 | `TODO.md` 進行中（共通） |
| 実装完了 | 本 REQ 決定ログ、`TODO.md` |
| （ドメイン固有。例: 実機 Step 記録） | （例: `SCENE-CATALOG.md` 該当行） |
| Phase / REQ 完了 | （ドメイン固有）+ `CONCEPT-MAP.md`（新用語時のみ） |

---

## 完了条件

- [ ] `docs/TODO.md` Backlog に起票と同時に1行追加（`draft` 起票時必須）
- [ ] 実機確認
- [ ] **リリース（バージョン bump / CHANGELOG）を含む場合**: `desktop-app/package.json` の `version` のみ手動 bump → [`RELEASE_BUILD.md`](../RELEASE_BUILD.md#バージョン管理) に従い `npm run build:release-exe` で `app.exe` を更新（配布正本。ユーザー指示なしでもエージェント必須）
- [ ] REQ 完了時: TODO を完了済みへ移動
- [ ] コミット

---

## 検証手順

1. 
2. 
3. 

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| YYYY-MM-DD HH:mm | | |
