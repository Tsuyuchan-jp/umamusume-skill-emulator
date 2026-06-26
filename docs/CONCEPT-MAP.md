# 概念地図（CONCEPT-MAP）

> **用語の意味・構造の正本。** 日本語を主タイトル、英語は括弧。
> 進捗は [`TODO.md`](TODO.md)、作業手順は [`tasks/REQ-*.md`](tasks/REQ-TEMPLATE.md)、**「何を意味するか」は本ファイル**。
>
> 入口: [`DOCS-GUIDE.md`](DOCS-GUIDE.md)

最終更新: 2026-06-27 06:40

---

## 読み方

1. **全体の層**で位置を掴む（仕様 → 検出 → ポリシー）
2. **用語カード**で詳細を見る
3. 英語名はカードの2列目だけ覚えればよい（コード・JSON のラベル）

---

## 全体の層（オートキャプチャ結合）

オートキャプチャ周りの会話は、だいたい次の3層に分けられる。

```
仕様（あるべき姿）  … 画面に何があり、どこにあるべきか
    ↓
検出（測定）        … 画像から今どこだと判定したか
    ↓
ポリシー（動き）    … wheel 何段・どうスクロール・どう合成するか
```

| 層 | 日本語 | 典型用語 |
|----|--------|----------|
| 仕様 | シーンモデル | 画面仕様、シーンカタログ、期待値 |
| 検出 | 検出器 | タブ検出、スクロール開始検出、crop |
| ポリシー | キャプチャ方針 | ホイール段、shift、結合 |

---

## 画面の帯（crop 内の意味構造）

ゲーム UI を **crop**（緑タイトルバーで切り取った領域）の中で、上から下へ帯として考える。

```
crop 内（上→下）
├─ タイトルバー
├─ パートナー帯     … 登録ボタン / 解除ボタン / なし
├─ タブ行           … スキル・継承などのタブ
├─ 固定ヘッダー     … タブ下〜スクロール開始まで（動かない）
├─ スクロール領域   … リストが流れる部分
└─ フッター         … 下端 約15%
```

正本の図解・不変条件: [`tasks/REQ-stitch-scene-model.md`](tasks/REQ-stitch-scene-model.md)「Scene Spec」節。

---

## 用語カード

### 運用・docs

| 日本語 | 英語 | 一言 | どこで見る | 隣の概念 |
|--------|------|------|-----------|----------|
| 概念地図 | CONCEPT-MAP | 用語の意味と構造の正本 | 本ファイル | DOCS-GUIDE |
| 進捗正本 | TODO | 次に何をするか | `docs/TODO.md` | REQ |
| 作業チケット | REQ | 1作業のスコープ・完了条件 | `docs/tasks/REQ-*.md` | TODO |
| シーンカタログ | SCENE-CATALOG | 画面バリエーション一覧 | `auto-capture-design-pack/SCENE-CATALOG.md` | golden、期待値 |

### オートキャプチャ結合 — 仕様層

| 日本語 | 英語 | 一言 | どこで見る | 隣の概念 |
|--------|------|------|-----------|----------|
| 画面仕様 | sceneSpec | あるべき帯の高さ・種類 | `tools/stitch-golden/expectations.json` の `sceneSpec` | シーンカタログ |
| パートナー帯 | partnerBand | 登録・解除・なし | `sceneSpec.partnerBand` | タブ行 |
| タブ行 | tabRow | スキル/継承タブの縦位置（比率帯） | `sceneSpec.tabRow` | スクロール開始 |
| スクロール開始 | scrollStart | 固定部分とリストの境界 | `sceneSpec.scrollStart` | スクロール領域 |
| ホイール段 | wheel | スクロール量 -3（狭帯）/ -4（広帯） | `sceneSpec.wheel` | ポリシー |
| 期待値 | expectations | golden テストの数値正本 | `expectations.json` | 画面仕様 |
| golden | golden | 回帰用の実機キャプチャ PNG | `auto-capture-design-pack/golden/` | expectations |
| 切り取り領域 | crop / CropRect | 緑タイトルバー基準の UI 矩形 | stitch コード・計測ログ | 画面の帯 |
| レイアウト種別 | layout | L2（2タブ）/ L3 / L3+Btn | expectations `layout` | タブ行 |

### オートキャプチャ結合 — 検出・ポリシー層

| 日本語 | 英語 | 一言 | どこで見る | 隣の概念 |
|--------|------|------|-----------|----------|
| シーンモデル | Scene Model | 仕様→検出→ポリシーの方法論 | `REQ-stitch-scene-model.md` | 画面仕様 |
| タブ検出 | tabDetect | 画像からタブ行を測る | `tabDetectCore.ts` 等 | タブ行 |
| 領域検出 | regionsCore | scrollStart 等を測る | `regionsCore.ts` | スクロール開始 |
| 結合リライト | stitch rewrite | キャプチャ画像の縦結合パイプライン | `REQ-stitch-rewrite.md` | golden |
| 不変条件 | INV-1〜3 | 帯の幾何が矛盾したら棄却 | `REQ-stitch-scene-model.md` | 画面仕様 |

### 不変条件（INV）要約

| ID | 日本語の意味 |
|----|-------------|
| INV-1 | スクロール開始はタブ行より十分下にある |
| INV-2 | 登録ボタン帯とタブ行を混同しない |
| INV-3 | ホイール段は帯の高さから決め、1セッション固定 |

---

## 更新ルール（エージェント向け）

詳細・強制力: `.cursor/rules/concept-map.mdc`

- 新しいドメイン用語を REQ / 永続正本に **初出** したら、同一コミットで本ファイルにカードを1行追加または既存行を更新
- Phase / マイルストーン完了時、その作業で登場した用語を **1〜3件** カード化
- 重複カードは作らない。`最終更新:` を `Get-Date -Format "yyyy-MM-dd HH:mm"` で更新
