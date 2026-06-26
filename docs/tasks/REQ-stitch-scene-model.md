# REQ-stitch-scene-model: キャプチャ結合 — シーンモデル正本化ロードマップ

> **親シリーズ**: [`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md)（パイプライン実装）の **方法論・持続可能性** レイヤ。
> 場当たり的ヒューリスティックの積み上げを止め、**画面の意味構造（Scene Spec）** を先に固定してから検出・ポリシーを実装する。
>
> **作業ロードマップ**（完了後はアーカイブ）。永続仕様は [`DOCS-GUIDE.md`](../DOCS-GUIDE.md) の永続正本一覧・[`SCENE-CATALOG.md`](../../auto-capture-design-pack/SCENE-CATALOG.md) を参照。

- **ステータス**: in-progress（M1 着手）
- **作成日**: 2026-06-27 04:11
- **関連コミット**: （M0 完了後に記入）

---

## 目的

オートキャプチャ結合で、検出失敗のたびに ratio・閾値・除外帯を足す **Antigravity 型の破綻** を繰り返さない。

- **シーンモデル**（何があるか）→ **検出器**（どこにあるか）→ **ポリシー**（wheel / 合成）の順を REQ でゲートする
- AI エージェント・人間が **ワーキングメモリに頼らず**、Scene Catalog + golden 計測を正本として進める

---

## 背景（なぜ場当たりに見えるか）

| 層 | あるべき責務 | 現状の問題 |
|----|-------------|-----------|
| **1. シーンモデル** | 画面要素の名前と関係（tabRow, partnerBand, scrollStart） | 暗黙・断片化。ratio 定数が仕様の主語になっている |
| **2. 検出器** | 各要素を画像から測る | 緑判定が Rust HSV / TS RGB / TS HSV の **3系統**。capture と stitch が別々に緑走査 |
| **3. ポリシー** | 測定値から wheel・合成範囲を決める | 失敗ケースごとにガード追加（除外帯・scan 再走査） |

典型例（2026-06-27 実機）:

- **登録ボタン FRD**: golden 未収録シーン。Rust が ratio≈0.44 をタブと誤認 → wheel=-4
- **アーモンドアイ FRD**: wheel=-3 は正しいが stitch absdiff が scrollStartY=257 を誤検出
- golden 18/18 PASS でも実機 NG — **シーンカタログの欠落**

---

## Scene Spec（意味論の正本）

座標はすべて **CropRect 基準の比率**。レイアウト名マジック（16% / 50%）は使わない。

```
Screen
  └─ CropRect（findCropBounds：緑タイトルバー）
       ├─ titleBar       … crop 上端付近
       ├─ partnerBand    … variant: register | release | absent
       ├─ tabRow         … 2 or 3 タブ。activeTab は別検出
       ├─ staticHeader   … crop 上端 〜 scrollStartY
       ├─ scrollRegion   … scrollStartY 〜 footerStartY
       └─ footer         … 下端 ≈15%
```

### 幾何学的不変条件（全シーン共通・ポリシー以前）

| ID | 条件 | 違反時 |
|----|------|--------|
| INV-1 | `scrollStartY > tabRow.bottom + margin` | absdiff / green-tab 結果を棄却し副経路へ |
| INV-2 | `partnerBand.register` の Y 帯は `tabRow` と混同しない | partner 検出を先に確定し tab 走査へ入力 |
| INV-3 | `scrollRegionH` の wheel 段は **1セッション固定**（帯高さ 2 段。layout 名では決めない） | [`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md) R3.5d 正本 |

---

## 検出器の目標責務分割（M4 完了形）

| 検出器 | モジュール（目標） | 入力 | 出力 |
|--------|-------------------|------|------|
| `detectCrop` | `cropCore` | frame RGBA | CropRect |
| `detectPartnerBand` | `partnerDetectCore`（新設） | crop 画像 | `register \| release \| absent` + bandY |
| `detectTabRow` | `tabDetectCore` | crop + partner 結果 | tabY, tabCount, method |
| `detectScrollStart` | `regionsCore` | frame0, frame1, tabRow | scrollStartY, method, confidence |
| `deriveWheel` | `capture.rs` または IPC 受信 | scrollRegionH | wheel=-3 \| -4 |

**暫定（R3.5d）**: `capture.rs` が独自に緑タブ走査 — **M5 で廃止**し stitch 正本の scrollRegionH を IPC 渡しに統一。

---

## Phase 表（ロードマップ）

| Phase | 内容 | 主な成果物 | 状態 |
|-------|------|-----------|------|
| **M0** | ロードマップ・運用ルール起票 | 本 REQ、`SCENE-CATALOG.md`、TODO/INDEX | **done** |
| **M1** | シーン欠落洗い出し | Catalog 全行・欠落シーンの PNG/ログ収集リスト | **in-progress** |
| **M2** | Scene Spec 具体化 | シーン別期待領域表・不変条件の golden 化 | 待ち |
| **M3** | 計測パイプライン強化 | expectations に partner/tab/scroll/wheel 中間値。シーン別 Vitest | 待ち |
| **M4** | 検出器統一 | 緑判定 1 系統（Rust/TS 同期）。partnerDetect 分離 | 待ち |
| **M5** | capture–stitch 責務分離 | wheel 用の二重緑走査廃止・IPC 契約 | 待ち |
| **M6** | 既知バグを Spec 準拠で修正 | 登録ボタン・absdiff 257。R3.5d-5 実機クローズ | 待ち |

**依存**: M0 → M1 → M2 → M3 が並行可能な部分あり。M4 は M2+M3 推奨。M6 は M4 以降が安全だが **M1 完了後**なら登録ボタン用 PNG 追加と並行可。

**REQ-stitch-rewrite との関係**:

| stitch REQ | scene-model |
|------------|-------------|
| R3.5d 実装（帯推定・wheel 2段） | M6 で Spec 準拠に吸収。暫定パッチは M4 まで増やさない方針 |
| R4〜R5 postProcess / opencv 削除 | M5 完了後に着手（TODO 既存） |

---

## AI エージェント・チャット運用（本 REQ からの追加ルール）

| チャット種別 | 許可 | 禁止 |
|-------------|------|------|
| **設計（Ask）** | Scene Spec・責務分割・不変条件 | コード変更 |
| **計測（Agent）** | golden 追加、`measure-regions.ps1`、Catalog 更新 | アルゴリズム変更 |
| **実装（Agent）** | **1 Phase 内の 1 検出器 or 1 不変条件** | ついで修正・複数 Phase 横断 |
| **検証** | 実機 Step 表チェック・ログ収集 | 設計変更 |

### 画像検出を触る REQ の着手条件

1. 対象シーンが [`SCENE-CATALOG.md`](../../auto-capture-design-pack/SCENE-CATALOG.md) に **1 行以上** 存在する
2. 欠落シーンは **M1 計測 Phase を先**（PNG + 構造化ログを design-pack へ）
3. 新しい ratio 定数を増やす前に、**Scene Spec のどの領域か**を決定ログに書く

### パッチ禁止リスト（エージェント・人間共通）

- 同じ判定（緑ピクセル等）を Rust と TS で別実装したまま閉じない
- 実機 1 ケース直しの `if (layout === 'FRD')` 分岐を増やさない
- 検出失敗時にフォールバックを足す前に、**前段検出結果と INV-1〜3** を疑う
- golden 全体 PASS のみで「実機 OK」としない（**シーン別**アサート必須）

---

## 触るファイル（Phase 別）

| Phase | ファイル |
|-------|---------|
| M0 | 本 REQ、`auto-capture-design-pack/SCENE-CATALOG.md`、`docs/TODO.md`、`docs/tasks/INDEX.md` |
| M1 | `SCENE-CATALOG.md`、`auto-capture-design-pack/golden/**`、logs |
| M2 | 本 REQ Scene Spec 節、`expectations.json` |
| M3 | `tools/stitch-golden/*`、`golden.test.ts`、`expectations.json` |
| M4 | `rgba.ts`、`capture.rs`、`tabDetectCore.ts`、`regionsCore.ts`、`constants.ts` |
| M5 | `capture.rs`、`useCapture.ts`、`stitch.ts`、契約 docs |
| M6 | M4/M5 成果 + `regionsCore.ts`（INV-1）等 |

---

## 完了条件（シリーズ全体）

- [ ] M0〜M1: Catalog が全実機 Step をカバー（欠落行なし）
- [ ] M2: 各シーンに期待領域 ratio 帯が Scene Spec 名付きで記載
- [ ] M3: シーン別 golden（partner / tabY / scrollStart / wheel）が Vitest で PASS
- [ ] M4: 緑判定実装が **1 系統**（grep で HSV/RGB 重複なし）
- [ ] M5: capture が stitch と矛盾する scroll 推定をしない
- [ ] M6: R3.5d-5 実機 Step 4/6 + HOF/TRN 退行なし
- [ ] REQ-stitch-rewrite R3.5d-5 / 親 REQ Phase 3 クローズ
- [ ] TODO・INDEX・決定ログ更新

---

## 検証手順

### 各 Phase 共通

```powershell
cd desktop-app
npm run stitch:golden
```

### M1 計測

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\stitch-golden\measure-regions.ps1
```

### 実機（M6）

[`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md)「実機検証 Step」表 — Catalog の各行と 1:1 対応。

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-27 04:11 | **REQ-stitch-scene-model 起票**（M0） | 場当たり修正の構造原因を Phase 化。ワーキングメモリ外の正本が必要 |
| 2026-06-27 04:11 | stitch 実装と **方法論 REQ を sibling 分離** | R3.5d を止めず、Catalog/検出器統一を並行ロードマップ化 |
| 2026-06-27 04:11 | 着手条件: Catalog 未登録シーンは計測 Phase 先行 | golden 18/18 でも実機 NG（登録ボタン）の再発防止 |
| 2026-06-27 04:11 | M0 完了 — REQ・SCENE-CATALOG・TODO/INDEX 同期 | ロードマップ正本をリポジトリに固定 |

---

## 作業チャット起票テンプレ（コピー用）

```
@docs/TODO.md
@docs/tasks/REQ-stitch-scene-model.md
@auto-capture-design-pack/SCENE-CATALOG.md

## チャット種別
（設計 Ask / 計測 Agent / 実装 Agent / 検証）

## 対象 Phase
M? のみ（他 Phase に触らない）

## 完了条件
本 REQ の当該 Phase 行 + 検証コマンド
```
