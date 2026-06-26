# docs 運用ガイド — 唯一の入口

> **人間も AI も、docs で迷ったらまずこのファイル。**
> アプリの製品仕様・技術概要は [`PROJECT.md`](PROJECT.md)。**進捗・要件・運用の地図はここ。**

最終更新: 2026-06-27 04:26

---

## 30秒でわかる3層

```
┌─────────────────────────────────────────────────────────┐
│ ① 今やること          docs/TODO.md                        │
│    「次に何をするか」だけ。毎日ここを見る。                  │
├─────────────────────────────────────────────────────────┤
│ ② 作業チケット        docs/tasks/REQ-*.md               │
│    その作業のスコープ・Phase 表・決定ログ。完了後はアーカイブ。 │
├─────────────────────────────────────────────────────────┤
│ ③ 永続正本            仕様が残るファイル（下表）            │
│    機能が動いたあとも更新し続ける。REQ 完了後もここを見る。    │
└─────────────────────────────────────────────────────────┘
```

**覚えることは1つでよい**: 作業開始 → **`TODO.md`** → リンクされた **REQ** → 必要なら **永続正本**。

---

## 永続正本一覧（③）

REQ が `done` になっても、**ここを更新し続ける**。

### 全体・運用

| ファイル | 内容 |
|---------|------|
| [`README.md`](README.md) | 本ガイド（docs 入口） |
| [`PROJECT.md`](PROJECT.md) | アプリ概要・開発ルール要約 |
| [`CHAT_TEMPLATE.md`](CHAT_TEMPLATE.md) | チャット起票テンプレ（設計 / 実装 / 検証 / 実機クローズ） |
| [`RELEASE_BUILD.md`](RELEASE_BUILD.md) | app.exe ビルド・バージョン bump |
| [`CHANGELOG.md`](CHANGELOG.md) | リリース履歴 |
| [`SYSTEM_SPECIFICATION.md`](SYSTEM_SPECIFICATION.md) | 外部向け技術概要（評価・引き継ぎ用。日常作業の入口ではない） |

### 進捗・要件索引

| ファイル | 内容 |
|---------|------|
| [`TODO.md`](TODO.md) | **次にやること**（Backlog・進行中・保留・完了済み） |
| [`tasks/INDEX.md`](tasks/INDEX.md) | 全 REQ のステータス一覧（TODO の代替 **ではない**） |
| [`tasks/REQ-TEMPLATE.md`](tasks/REQ-TEMPLATE.md) | 新 REQ 起票用テンプレ |

### ドメイン別永続正本（機能ごと）

| 領域 | ファイル | 内容 |
|------|---------|------|
| オートキャプチャ結合 | [`tasks/REQ-stitch-rewrite.md`](tasks/REQ-stitch-rewrite.md) の「Capture–Stitch 契約」節 ※ | wheel 段・パイプライン（移行予定: 専用 doc） |
| キャプチャ結合シーン | [`../auto-capture-design-pack/SCENE-CATALOG.md`](../auto-capture-design-pack/SCENE-CATALOG.md) | 画面バリエーション一覧・golden 有無・実機状態 |
| キャプチャ設計パック | [`../auto-capture-design-pack/README.md`](../auto-capture-design-pack/README.md) | golden PNG・ログ・スクリーンショット |
| golden 数値 | [`../tools/stitch-golden/expectations.json`](../tools/stitch-golden/expectations.json) | scrollStartRatio 等の計測期待値 |
| スキルデータ更新 | [`../UPDATE_SKILLS.md`](../UPDATE_SKILLS.md) | skill_data 更新手順 |

※ Capture–Stitch の契約が REQ 内にあるのは歴史的経緯。永続化は [`REQ-stitch-scene-model`](tasks/REQ-stitch-scene-model.md) M2 以降で `docs/CAPTURE-STITCH.md` 新設予定。

### Cursor 自動ルール（`.cursor/rules/`）

エージェントが **毎チャット自動参照** する。人間は概要だけここで把握し、詳細は各 `.mdc` を開く。

| ルール | 内容 |
|--------|------|
| `git-commit.mdc` | 毎作業コミット必須 |
| `docs-management.mdc` | TODO / REQ / 日時形式・INDEX 更新 |
| `development.mdc` | プロジェクト構成・リリースビルド・触らない領域 |

---

## REQ は使い捨てか？

| | 説明 |
|---|------|
| **ファイル** | `done` 後も **削除しない**（決定ログ・監査用） |
| **日常の入口** | **使い捨てに近い** — 完了したら TODO / INDEX から外れ、普段は開かない |
| **役割** | その Phase を **完遂するためのチケット**（スコープ・完了条件・決定ログ） |
| **正本か？** | **いいえ** — 仕様の正本は③の永続 doc + コード。REQ は作業記録 |

**REQ 完了時の必須チェック**: Scene Spec や契約が REQ だけに残っていないか → 永続正本へ写してから `done`。

---

## 人間の作業フロー

```
1. docs/TODO.md を開く（進行中は最大1件）
2. 着手する Backlog 行の REQ リンクを開く
3. 実装なら CHAT_TEMPLATE の「実装チャット用」をコピー
4. 作業完了 → TODO 更新 → コミット
5. 実機確認後 → CHAT_TEMPLATE「実機検証クローズ報告用」
```

| やりたいこと | 開くファイル |
|-------------|-------------|
| 今日何をする？ | `TODO.md` |
| この機能の仕様は？ | 着手 REQ → 永続正本（上表） |
| 新チャットを起票 | `CHAT_TEMPLATE.md` |
| 全 REQ の状態 | `tasks/INDEX.md` |
| docs の全体像 | **本ファイル** |

---

## AI エージェントの作業フロー

### コード変更あり（Agent mode）

1. `@docs/TODO.md` を読む
2. 対象を **進行中** に移す（最大1件）。`最終更新:` を `Get-Date` で更新
3. `@docs/tasks/REQ-（対象）.md` を読む
4. ドメイン永続正本があれば `@`（例: キャプチャ結合 → `SCENE-CATALOG.md`）
5. 完了前にコミット。TODO 完了済み・REQ `done`・INDEX 更新

### チャット起票の `@` 目安

| 種別 | 典型 `@` 件数 | 添付 |
|------|-------------|------|
| 軽微な実装 | 2〜3 | `PROJECT` + `TODO` [+ REQ] |
| 通常実装 | 3〜5 | `TODO` + 着手 REQ 1本 |
| キャプチャ結合 | 3〜4 | `TODO` + REQ + `SCENE-CATALOG` |
| 設計（Ask） | 4〜8 | 上記 + 調査ファイル |

詳細: [`CHAT_TEMPLATE.md`](CHAT_TEMPLATE.md)「`@` ファイル添付の方針」

### 日時の書き方

`docs/` に日時を書く前に **必ず** シェルで取得:

```powershell
Get-Date -Format "yyyy-MM-dd HH:mm"
```

形式: `YYYY-MM-DD HH:mm`（日付のみは不可）。詳細: `.cursor/rules/docs-management.mdc`

---

## キャプチャ結合まわり（いま注力中の例）

複数 doc が絡む典型例。**脳内で全部覚えなくてよい** — この表だけ見る。

| 層 | ファイル | 覚える一言 |
|----|---------|-----------|
| 今やること | `TODO.md` | M1 シーンカタログ |
| 作業チケット | `REQ-stitch-scene-model.md` | Phase M0〜M6 |
| 作業チケット | `REQ-stitch-rewrite.md` | パイプライン実装 R0〜R5 |
| 永続 | `SCENE-CATALOG.md` | 画面バリエーション一覧 |
| 永続 | `expectations.json` | 数値 golden |
| 契約（暫定） | `REQ-stitch-rewrite` の Capture–Stitch 節 | wheel -3/-4 |

---

## 新しい docs を増やすときの判断

| 質問 | Yes なら |
|------|---------|
| 完了後も仕様として残る？ | **永続正本**（`docs/` または design-pack） |
| 1回きりの作業の手順・Phase？ | **REQ** |
| 今週やるかどうか？ | **TODO** Backlog |
| チャットの貼り付け型？ | **CHAT_TEMPLATE** に追記 |
| AI に毎回守らせたい短いルール？ | **`.cursor/rules/*.mdc`**（短く。詳細は doc へリンク） |

**避けること**: 同じ内容を PROJECT / REQ / README に3重コピーする。

---

## 関連リンク早見

| リンク | パス |
|--------|------|
| docs 入口 | `docs/README.md`（本ファイル） |
| 進捗 | `docs/TODO.md` |
| アプリ概要 | `docs/PROJECT.md` |
| チャット起票 | `docs/CHAT_TEMPLATE.md` |
| REQ 一覧 | `docs/tasks/INDEX.md` |
| リリース | `docs/RELEASE_BUILD.md` |
