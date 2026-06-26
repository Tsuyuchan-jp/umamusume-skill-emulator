# Scene Catalog — オートキャプチャ結合シーン正本

> **ロードマップ**: [`docs/tasks/REQ-stitch-scene-model.md`](../docs/tasks/REQ-stitch-scene-model.md)
> **計測 CLI**: `tools/stitch-golden/measure-regions.ps1`
> **golden 期待値**: `tools/stitch-golden/expectations.json`

画面バリエーションごとに **1 行**。画像検出の REQ 着手前に、対象シーンがここに存在すること。

**凡例**

| 列 | 意味 |
|----|------|
| goldenPath | `auto-capture-design-pack/` からの相対パス（目標）。未収録は `—` |
| expectations | `yes`（case あり）/ `no`（未登録）/ `R4`（スコープ外） |
| 実機 Step | [`REQ-stitch-rewrite.md`](../docs/tasks/REQ-stitch-rewrite.md) 検証 Step |
| 状態 | `ok` / `ng` / `欠落`（PNG 未収録）/ `要再検証` |

---

## シーン一覧

| シーン ID | 経路 | タブ | partnerBand | layout 期待 | goldenPath | expectations | 実機 Step | 状態 | 備考 |
|-----------|------|------|-------------|-------------|------------|--------------|-----------|------|------|
| G-HOF-S | HOF | Skill | absent | L3 | `golden/HOF/skill/frame_000.png` | yes | 1 | ok | scrollStart≈0.44 |
| G-HOF-F | HOF | 因子/継承 | absent | L3 | `golden/HOF/factor/frame_000.png` | yes | 5 | ok | |
| G-TRN | TRN | Skill | absent | L2 | `golden/TRN/frame_000.png` | yes | 3 | ok | tabY≈0.47 |
| G-CMP-S | CMP | Skill | absent | L3 | `golden/CMP/skill/frame_000.png` | yes | 2 skip | ok | |
| G-FRD-S-release | FRD | Skill | **release**（灰・解除） | L3+Btn | `golden/FRD/skill-release/frame_000.png` | yes | 4 | **ng** | アーモンドアイ: absdiff scrollStart≈0.29 誤検出。アストンマーチャン: ok |
| G-FRD-S-register | FRD | Skill | **register**（緑・登録） | L3+Btn | `golden/FRD/skill-register/frame_000.png` | no | 4 | **欠落** | キタサンブラック等。Rust wheel=-4, tabY≈0.44 誤検出。**PNG 未収録が主因** |
| G-FRD-F | FRD | 因子 | release/absent | L3+Btn | `golden/FRD/factor/frame_000.png` | yes | 6 | 要再検証 | R3.5d 狭帯 -3 後 |
| G-FRD-I | FRD | 育成情報 | — | — | — | R4 | — | 欠落 | R4 スコープ・golden 不要 |

---

## expectations ↔ Catalog 対応

`tools/stitch-golden/expectations.json` の `cases[].id` と Catalog 行の対応。パスはいずれも **designPackRoot 相対**。

| Catalog シーン ID | expectations `cases[].id` | goldenPath | 整合 |
|-------------------|---------------------------|------------|------|
| G-HOF-S | G-HOF-S | `golden/HOF/skill/frame_000.png` | 一致 |
| G-HOF-F | G-HOF-F | `golden/HOF/factor/frame_000.png` | 一致 |
| G-TRN | G-TRN | `golden/TRN/frame_000.png` | 一致 |
| G-CMP-S | G-CMP-S | `golden/CMP/skill/frame_000.png` | 一致 |
| G-FRD-S-release | G-FRD-S-release | `golden/FRD/skill-release/frame_000.png` | 一致 |
| G-FRD-S-register | （なし） | — | Phase C で case 追加予定 |
| G-FRD-F | G-FRD-F | `golden/FRD/factor/frame_000.png` | 一致 |
| G-FRD-I | — | — | R4 スコープ外 |

---

## G-FRD-S-register 収集手順（ユーザー / 検証チャット）

1. FRD スキル画面で **緑の「登録」ボタン**が見える状態（キタサンブラック等）
2. 手動でスキルタブを開いた状態でオートキャプチャ 1 回
3. チャットに `[Capture]` 行と `StitchLayout=...` 行を貼る（NG 時）
4. `frame_000` を `golden/FRD/skill-register/` に commit

---

## NG サブケース期待値メモ（expectations 未登録分のみ）

比率は **crop 基準**。登録済みシーンの数値帯は → [`expectations.json`](../tools/stitch-golden/expectations.json) 参照。M2 で Scene Spec 名付き帯へ移行。

| シーン ID | 事象 | tabRowRatio | scrollStartRatio | wheel |
|-----------|------|-------------|------------------|-------|
| G-FRD-S-register | キタサンブラック等（期待） | 0.46–0.48（**0.44 は NG**） | 0.52–0.56 | **-3**（**-4 は NG**） |
| G-FRD-S-release | アーモンドアイ absdiff 誤検出 | ≈0.47 | **0.29 は NG**（期待 0.52–0.56） | -3 |

---

## Phase 境界

| Phase | 内容 | 状態 |
|-------|------|------|
| **A** | Catalog 正本化 — goldenPath・expectations 列、節統合 | 完了 |
| **B** | `G-FRD-S` → `G-FRD-S-release` リネーム、`golden/FRD/skill-release/` 移行 | **完了** |
| **C** | `G-FRD-S-register` の PNG 収録 + expectations case 追加 | 未着手 |

---

## 更新ルール

1. 実機 NG を発見したら **新規シーン行を追加**（既存行の上書きだけにしない）
2. `measure-regions.ps1` 出力で ratio を更新したら **日時**を決定ログ（REQ-stitch-scene-model）へ
3. golden PNG を追加したら `goldenPath` を実パスに更新し、`状態` を `ok` / `ng` / `要再検証` へ

最終更新: 2026-06-27 05:28
