# 概念地図（CONCEPT-MAP）

> **用語の意味・構造の正本。** 表は **英語名 → 日本語 → 種別** の順。
> 進捗は [`TODO.md`](TODO.md)、作業手順は [`tasks/REQ-*.md`](tasks/REQ-TEMPLATE.md)、**「何を意味するか」は本ファイル**。
>
> 入口: [`DOCS-GUIDE.md`](DOCS-GUIDE.md)

最終更新: 2026-07-11 17:31

---

## 読み方

1. **全体の層**で位置を掴む（仕様 → 検出 → ポリシー）
2. **種別**で「これは概念か・ファイル名か・コードのキーか」を判別する
3. **用語カード**で日本語の意味と参照先を見る

---

## 種別の凡例

その用語が **何として現れるか** の分類。複合は最大2つ（`＋` 区切り）。

| 種別 | 意味 |
|------|------|
| **概念** | 設計・頭の中のもの。コードに1対1でないこともある |
| **画面領域** | 画面上の帯・部品の名前 |
| **データ項目** | JSON・設定のキー名 |
| **ファイル・ドキュメント** | 正本がファイル・フォルダそのもの |
| **処理・モジュール** | 測定・実行する仕組み（モジュール名） |
| **識別子・定数** | 列挙値・マジック値・ルール ID |

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
| 仕様 | シーンモデル | sceneSpec、SCENE-CATALOG、expectations |
| 検出 | 検出器 | tabDetect、partnerDetect、crop、regionsCore |
| ポリシー | キャプチャ方針 | wheel、shift、stitch rewrite |

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

| 英語 | 日本語 | 種別 | 一言 | どこで見る |
|------|--------|------|------|-----------|
| CONCEPT-MAP | 概念地図 | ファイル・ドキュメント | 用語の意味と構造の正本 | 本ファイル |
| TODO | 進捗正本 | ファイル・ドキュメント | 次に何をするか | `docs/TODO.md` |
| REQ | 作業チケット | ファイル・ドキュメント | 1作業のスコープ・完了条件 | `docs/tasks/REQ-*.md` |
| SCENE-CATALOG | シーンカタログ | ファイル・ドキュメント | 画面バリエーション一覧 | `auto-capture-design-pack/SCENE-CATALOG.md` |

### オートキャプチャ結合 — 仕様層

| 英語 | 日本語 | 種別 | 一言 | どこで見る |
|------|--------|------|------|-----------|
| sceneSpec | 画面仕様 | 概念＋データ項目 | あるべき帯の高さ・種類 | `tools/stitch-golden/expectations.json` の `sceneSpec` |
| partnerBand | パートナー帯 | 画面領域＋データ項目 | 登録・解除・なし | `sceneSpec.partnerBand` |
| tabRow | タブ行 | 画面領域＋データ項目 | スキル/継承タブの縦位置（比率帯） | `sceneSpec.tabRow` |
| scrollStart | スクロール開始 | 画面領域＋データ項目 | 固定部分とリストの境界 | `sceneSpec.scrollStart` |
| wheel | ホイール段 | 識別子・定数＋データ項目 | スクロール量 -3（狭帯）/ -4（広帯） | `sceneSpec.wheel` |
| expectations | 期待値 | ファイル・ドキュメント＋データ項目 | golden テストの数値正本 | `expectations.json` |
| golden | golden | ファイル・ドキュメント | 回帰用の実機キャプチャ PNG | `auto-capture-design-pack/golden/` |
| crop / CropRect | 切り取り領域 | 画面領域＋処理・モジュール | 緑タイトルバー基準の UI 矩形 | stitch コード・計測ログ |
| layout | レイアウト種別 | 識別子・定数＋データ項目 | L2（2タブ）/ L3 / L3+Btn | expectations `layout` |

### オートキャプチャ結合 — 検出・ポリシー層

| 英語 | 日本語 | 種別 | 一言 | どこで見る |
|------|--------|------|------|-----------|
| Scene Model | シーンモデル | 概念 | 仕様→検出→ポリシーの方法論 | `REQ-stitch-scene-model.md` |
| detector | 検出器 | 概念 | 画像から画面要素の位置・種類を測る部品 | REQ「検出器の目標責務分割」 |
| partnerDetectCore | パートナー帯検出 | 処理・モジュール | register 時は bandTop/bandBottom 幾何帯を返し tab 走査から除外（M6a） | `desktop-app/app/lib/stitch/partnerDetectCore.ts` |
| green detection | 緑判定 | 概念＋識別子 | タブ・タイトルバー・partner の緑ピクセル閾値 | `rgba.ts`・`constants.ts` 正本 |
| tabDetect | タブ検出 | 処理・モジュール | partnerDetect 結果を見てからタブ行を測る（INV-2） | `tabDetectCore.ts` 等 |
| regionsCore | 領域検出 | 処理・モジュール | scrollStart 等を測る | `regionsCore.ts` |
| deriveWheel | ホイール導出 | 処理・モジュール | scrollRegionH から -3 / -4 を決める（INV-3・M5 正本） | `wheelCore.ts` |
| capture-wheel IPC | キャプチャ・結合 IPC | 概念＋データ項目 | frame0 プレビュー → TS wheel → Rust セッション固定 | `capture_frame0_preview`・`useCapture.ts` |
| stitch rewrite | 結合リライト | 概念＋ファイル・ドキュメント | キャプチャ画像の縦結合パイプライン | `REQ-stitch-rewrite.md` |
| zero-shift skip | 無移動スキップ | 概念＋識別子・定数 | 最終ペアでスクロール0と見て append しない（びったし末端の二重結合対策） | `shiftEstimateCore` / `REQ-stitch-terminal-exact-bottom.md` |
| INV-1〜3 | 不変条件 | 概念＋識別子・定数 | 帯の幾何が矛盾したら棄却 | `REQ-stitch-scene-model.md` |

### 不変条件（INV）要約

| 英語 | 日本語 | 種別 | 一言 |
|------|--------|------|------|
| INV-1 | スクロール開始はタブ行より十分下 | 識別子・定数＋概念 | scrollStart > tabRow + margin |
| INV-2 | 登録帯とタブ行を混同しない | 識別子・定数＋概念 | partnerDetect を先に確定し tabRow 走査へ入力 |
| INV-3 | ホイール段は帯高さで固定 | 識別子・定数＋概念 | scrollRegionH → wheel -3 / -4 |

---

## 更新ルール（エージェント向け）

詳細・強制力: `.cursor/rules/concept-map.mdc`

- 新しいドメイン用語を REQ / 永続正本に **初出** したら、同一コミットでカードを追加または既存行を更新
- Phase / マイルストーン完了時は **CONCEPT-MAP を必ず検討**する。**追記・更新は 0 件可**（無理にカードを増やさない）
- 追記・更新する場合は **最大 3 件**（既存行の更新も 1 件として数える）
- 0 件のときは `最終更新:` を書き換えない。任意で REQ 決定ログに「用語追加なし」と 1 行残せる
- 重複カードは作らない。追記・更新したコミットでは `最終更新:` を `Get-Date -Format "yyyy-MM-dd HH:mm"` で更新
