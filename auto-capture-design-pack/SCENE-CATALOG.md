# Scene Catalog — オートキャプチャ結合シーン正本

> **ロードマップ**: [`docs/tasks/REQ-stitch-scene-model.md`](../docs/tasks/REQ-stitch-scene-model.md)
> **計測 CLI**: `tools/stitch-golden/measure-regions.ps1`
> **golden 期待値**: `tools/stitch-golden/expectations.json`

画面バリエーションごとに **1 行**。画像検出の REQ 着手前に、対象シーンがここに存在すること。

**凡例**

| 列 | 意味 |
|----|------|
| golden | `auto-capture-design-pack/golden/` にフレーム PNG あり |
| 実機 Step | [`REQ-stitch-rewrite.md`](../docs/tasks/REQ-stitch-rewrite.md) 検証 Step |
| 状態 | `ok` / `ng` / `欠落`（PNG 未収録）/ `要再検証` |

---

## シーン一覧

| シーン ID | 経路 | タブ | partnerBand | layout 期待 | golden | 実機 Step | 状態 | 備考 |
|-----------|------|------|-------------|-------------|--------|-----------|------|------|
| G-HOF-S | HOF | Skill | absent | L3 | yes | 1 | ok | scrollStart≈0.44 |
| G-HOF-F | HOF | 因子/継承 | absent | L3 | yes | 5 | ok | `golden/HOF/factor/frame_000.png` |
| G-TRN | TRN | Skill | absent | L2 | yes | 3 | ok | tabY≈0.47 |
| G-CMP-S | CMP | Skill | absent | L3 | yes | 2 skip | ok | `golden/CMP/skill/frame_000.png` |
| G-FRD-S-release | FRD | Skill | **release**（灰・解除） | L3+Btn | yes | 4 | **ng** | アーモンドアイ: absdiff scrollStart≈0.29 誤検出。アストンマーチャン: ok |
| G-FRD-S-register | FRD | Skill | **register**（緑・登録） | L3+Btn | **no** | 4 | **ng** | キタサンブラック等。Rust wheel=-4, tabY≈0.44 誤検出。**Catalog 欠落が主因** |
| G-FRD-F | FRD | 因子 | release/absent | L3+Btn | yes | 6 | 要再検証 | R3.5d 狭帯 -3 後 |
| G-FRD-I | FRD | 育成情報 | — | — | no | — | 欠落 | R4 スコープ |

---

## 欠落シーン（M1 収集タスク）

優先度順。**golden PNG** を追加してから expectations 化する。実機ログはチャット報告（[`PACK-GUIDE.md`](PACK-GUIDE.md)）。

| 優先 | シーン ID | 収集物 | 担当 Phase |
|------|-----------|--------|-----------|
| P0 | **G-FRD-S-register** | `golden/FRD/skill-register/frame_000.png` | M1 → M3 |
| P1 | G-FRD-S-release（アーモンドアイ NG 再現） | f000+f001 を golden へ | M1 → M3 |
| P2 | G-FRD-I | R4 着手時 | — |

### G-FRD-S-register 収集手順（ユーザー / 検証チャット）

1. FRD スキル画面で **緑の「登録」ボタン**が見える状態（キタサンブラック等）
2. 手動でスキルタブを開いた状態でオートキャプチャ 1 回
3. チャットに `[Capture]` 行と `StitchLayout=...` 行を貼る（NG 時）
4. `frame_000` を `golden/FRD/skill-register/` に commit

---

## シーン別期待値メモ（M2 で expectations に移行）

比率は **crop 基準**。帯は Scene Spec 名で管理（閾値は計測で更新）。

| シーン ID | tabRowRatio | scrollStartRatio | scrollRegionH | wheel |
|-----------|-------------|------------------|---------------|-------|
| G-FRD-S-release（ok 例） | 0.46–0.48 | 0.52–0.56 | ≈275 | -3 |
| G-FRD-S-register（期待） | 0.46–0.48（**0.44 は NG**） | 0.52–0.56 | ≈275 | -3 |
| G-FRD-S-release（アーモンドアイ NG） | ≈0.47 | **0.29 は NG** | ≈275 | -3 |
| G-HOF-S / G-TRN | 各 golden 参照 | 各 golden 参照 | ≥280 | -4 |

---

## 更新ルール

1. 実機 NG を発見したら **新規シーン行を追加**（既存行の上書きだけにしない）
2. `measure-regions.ps1` 出力で ratio を更新したら **日時**を決定ログ（REQ-stitch-scene-model）へ
3. golden PNG を追加したら「golden」列を `yes` に

最終更新: 2026-06-27 05:12
