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
| G-HOF-S | HOF | Skill | absent | L3 | `golden/HOF/skill/frame_000.png` | yes | 1 | ok | R4a postProcess 退行なし（2026-06-28）。terminal 微探索・wheel=-4 |
| G-HOF-F | HOF | 因子/継承 | absent | L3 | `golden/HOF/factor/frame_000.png` | yes | 5 | ok | R4a postProcess 退行なし（2026-06-28） |
| G-TRN | TRN | Skill | absent | L2 | `golden/TRN/frame_000.png` | yes | 3 | ok | R4a postProcess 退行なし（2026-06-28）。wheel=-4 |
| G-CMP-S | CMP | Skill | absent | L3 | `golden/CMP/skill/frame_000.png` | yes | 2 skip | ok | |
| G-FRD-S-release | FRD | Skill | **release**（灰・解除） | L3+Btn | `golden/FRD/skill-release/frame_000.png` | yes | 4 | **ok** | R4a postProcess 退行なし（2026-06-28）。wheel=-3 |
| G-FRD-S-register | FRD | Skill | **register**（緑・登録） | L3+Btn | `golden/FRD/skill-register/frame_000.png` | yes | 4 | **ok** | R4a postProcess 退行なし（2026-06-28）。wheel=-3 |
| G-FRD-F | FRD | 因子/継承 | release/absent | L3+Btn | `golden/FRD/factor/frame_000.png` | yes | 6 | **ok** | R4a postProcess 退行なし（2026-06-28）— S-5 継承履歴カット OK。wheel=-3 |
| G-FRD-I | FRD | 育成情報 | **register**（緑・登録） | L3+Btn | `golden/FRD/info/frame_000.png` | yes | 7（Phase 1b） | **ok** | **golden 登録完了**（2026-06-28）— `StitchTab=TrainingInfo`・S-6・wheel=-3 |
| G-CMT-TWK-P3 | CMT | 月刊トゥインクル増刊号・3面 | —（ウマ娘柱） | L2 fallback 観測 | — | no | — | **ok** | 3面のみ（1面/2面はスクロール無し）。実機クローズ 2026-07-30: Frame4→5=97・Frame5→6 terminal micro skip（coarse=167）・9位欠けなし・二重なし。タブ緑未検出→L2・scrollStart=layout-ratio confidence=low・wheel=stitch_fallback は観測のみ。[`REQ-stitch-twinkle-extra-page3.md`](../docs/tasks/REQ-stitch-twinkle-extra-page3.md)。golden / expectations なし |

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
| G-FRD-S-register | G-FRD-S-register | `golden/FRD/skill-register/frame_000.png` | 一致 |
| G-FRD-F | G-FRD-F | `golden/FRD/factor/frame_000.png` | 一致 |
| G-FRD-I | G-FRD-I | `golden/FRD/info/frame_000.png` | 一致 |

---

## G-FRD-S-register 収集手順（ユーザー / 検証チャット）

1. FRD スキル画面で **緑の「登録」ボタン**が見える状態（キタサンブラック等）
2. 手動でスキルタブを開いた状態でオートキャプチャ 1 回
3. チャットに `[Capture]` 行と `StitchLayout=...` 行を貼る（NG 時）
4. `frame_000` を `golden/FRD/skill-register/` に commit（`frame_001` 以降は scrollStart テスト用に推奨）

---

## G-FRD-I 収集手順（ユーザー / 検証チャット）

1. FRD 画面で **育成情報タブ**を手動で開く（戦績一覧が見える状態）
2. リスト末尾（最下部の戦績行）まで届くようオートキャプチャ 1 回
3. チャットに `[Capture]` 行と `StitchLayout=...` / `StitchTab=TrainingInfo` 行を貼る（NG 時）
4. 結合画像を目視 — 戦績末尾まで欠けなく、OCR 可能なこと
5. `frame_000` を `golden/FRD/info/` に commit（`frame_001` 以降は scrollStart テスト用に推奨）
6. PNG 追加後: `measure-regions.ps1 -CaseId G-FRD-I` → `expectations.json` case 追加 → `golden.test.ts` に `tab=TrainingInfo` assert

**退行ゲート**（実機）: G-HOF-S / G-TRN / G-FRD-S-release・register / G-HOF-F / G-FRD-F

---

## Scene Spec 期待サマリー（M2 正本）

比率は **crop 基準**。数値帯の正本は [`expectations.json`](../tools/stitch-golden/expectations.json) の `cases[].sceneSpec`。`scrollStartRatio` / `tabRowRatio` は移行期互換。

| シーン ID | partnerBand | tabRow | scrollStart | wheel |
|-----------|-------------|--------|-------------|-------|
| G-HOF-S | absent | 0.33–0.43 | 0.36–0.46 | -4 |
| G-HOF-F | absent | 0.33–0.46 | 0.36–0.51 | -4 |
| G-TRN | absent | 0.44–0.50 | 0.48–0.54 | -4 |
| G-CMP-S | absent | 0.33–0.43 | 0.36–0.46 | -4 |
| G-FRD-S-release | release | 0.39–0.47 | 0.52–0.56 | -3 |
| G-FRD-S-register | register | 0.46–0.48 | 0.52–0.56 | -3 |
| G-FRD-F | release | 0.39–0.47 | 0.46–0.52 | -3 |
| G-FRD-I | register | 0.46–0.48 | 0.52–0.56 | -3 |

INV 対応・計測メモ: [`REQ-stitch-scene-model.md`](../docs/tasks/REQ-stitch-scene-model.md)「シーン別期待領域表」。

---

## NG サブケース（実機・未 golden 化）

→ **Scene Spec 期待は上表および `expectations.json` の `sceneSpec` を参照。** 以下は既知 NG の要約のみ。

| シーン ID | 事象 | 備考 |
|-----------|------|------|
| ~~G-FRD-I StitchTab ログ誤検出~~ | 育成情報タブ選択中に `StitchTab=Inheritance` | **実機クローズ**（`b8963da` 修正後 `TrainingInfo` 確認・2026-06-28） |

~~G-FRD-S-register StitchTab 誤検出~~ — **StitchTab 修正で解消**（`4c6029e`・M6c Step 6 実機 OK）。
~~G-FRD-F 継承履歴未カット~~ — **同上**（2026-06-27）。

~~G-FRD-S-release scrollStart≈0.29~~ — **M6b/M6c 4a で実機解消**（2026-06-27）。

アーモンドアイ用 **別 golden 行**（PNG 未収録）は M2 設計メモのみ。収録は別タスク。

---

## Phase 境界

| Phase | 内容 | 状態 |
|-------|------|------|
| **A** | Catalog 正本化 — goldenPath・expectations 列、節統合 | 完了 |
| **B** | `G-FRD-S` → `G-FRD-S-release` リネーム、`golden/FRD/skill-release/` 移行 | 完了 |
| **C** | `G-FRD-S-register` の PNG 収録 + expectations case 追加 | 完了 |
| **M2** | Scene Spec 期待構造化 — `sceneSpec` フィールド・Catalog/REQ 同期 | **完了** |
| **M6** | M6a/M6b/M6c 完了・実機 Step 4/6 + HOF/TRN 退行なし | **完了**（2026-06-27 Step 6 OK） |

---

## 更新ルール

1. 実機 NG を発見したら **新規シーン行を追加**（既存行の上書きだけにしない）
2. `measure-regions.ps1` 出力で ratio を更新したら **日時**を決定ログ（REQ-stitch-scene-model）へ
3. golden PNG を追加したら `goldenPath` を実パスに更新し、`状態` を `ok` / `ng` / `要再検証` へ
4. **実機 Step を docs に記録したら** 該当行を **同一コミットで** 更新する（全 Step 完了を待たない）。手順の正本: [`DOCS-GUIDE.md`](../docs/DOCS-GUIDE.md)「永続正本同期表」capture 行

最終更新: 2026-06-28 03:34
