# REQ-auto-capture-multi-screen: オートキャプチャの複数ゲーム画面対応

> 殿堂入り以外のステータス確認画面でも、オートキャプチャ→結合→OCR まで通す。
> **設計正本**: 本 REQ（Phase D1 完了: 2026-06-26）。検証データ: [`auto-capture-design-pack/`](../../auto-capture-design-pack/)（リポジトリ直下・git 未追跡可）。

- **ステータス**: draft（Phase 1 done・Phase 1b/3 待ち）
- **作成日**: 2026-06-25 07:25
- **設計レビュー完了**: 2026-06-26 06:03
- **関連コミット**: `700d0b3`（Phase 1）/ `0887fcd`（C1 TRN 修正）

---

## 目的

育成中・育成完了・フレンド確認など、**ウマ娘詳細** を開ける複数経路で、オートキャプチャ→結合→OCR まで安定動作させる。殿堂入り経路は退行させない。

---

## Phase D1 結論（設計レビュー正本）

### 実機データからの確定事項

| 層 | 結論 |
|----|------|
| **キャプチャ（`capture.rs`）** | **Generic 1本で全経路カバー済み**（設計パック全 Rust ログで末端到達）。経路別4プロファイル分岐は **Phase 1 では不要** |
| **結合（`opencvStitcher.ts`）** | **本バグの所在**。TRN/FRD 等で NG。HOF/CMP は OK |
| **TRN** | キャプチャ正常。Phase 1 実機 OK（`0887fcd`・-5 旧）。**v2 + -4 実機 OK**（R3.5c `23ebab7`） |

### 方針決定（F-1〜F-5）

| ID | 決定 |
|----|------|
| F-1 | キャプチャ開始前に **対象タブを手動で開く**（スキル／継承／育成情報） |
| F-2 | **継承タブもスコープ内**（スキル＋継承＋育成情報。タブごとに1回キャプチャ） |
| F-3 | **結合先**（Phase 1 は `opencvStitcher.ts` のみ。`capture.rs` は触らない） |
| F-4 | 判別不能時は **汎用（安全側）**（キャプチャは現行 Generic 維持） |
| F-5 | **ウィンドウ＋フルスクリーン FHD**。フルスクリーン検証は HOF skill + TRN skill 各1回のみ |

---

## アーキテクチャ（4経路プロファイルは採用しない）

### 軸A: CaptureMode（Rust）— Phase 1 では変更なし

| モード | 内容 |
|--------|------|
| **GenericScroll** | 現行 `start_auto_scroll_capture_session` を維持（diff 末端終了） |
| **FactorScroll** | （Phase 2 任意）継承タブで history_bar 早期終了が必要なら最小分岐 |

### 軸B: StitchLayout + StitchTab（TS）— Phase 1 の主戦場

**StitchLayout**（初回フレームから画像判定）:

| ID | 条件 | header 比率（初期値） |
|----|------|----------------------|
| **L2** | タブ2つ（コンディション/スキル） | **≈50%**（タブ行から動的算出。旧 22% は誤推定・2026-06-26 計測修正） |
| **L3** | タブ3つ（スキル/継承/育成情報） | 16%（現行維持） |
| **L3+Btn** | L3 ＋「練習パートナー解除」帯 | **≈24%**（下段タブ＋動的算出。旧 18%） |

**StitchTab**（ユーザーが開いたタブ＝F-1）:

| ID | 内容 | 結合 |
|----|------|------|
| **Skill** | スキル一覧 | テンプレートマッチ縦結合（現行ベース） |
| **Inheritance** | 継承因子一覧 | スキル結合＋緑履歴バークロップ規則の整理 |
| **TrainingInfo** | 育成情報（戦績等） | S-6 配線（Skill 同型・[`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md) R4b **done**） |

**判定優先順（結合側）**:

1. 上段緑プロファイル → L3 / L3+Btn
2. 下段緑プロファイル（左右分割）→ L2
3. 現在タブ（色・アクティブタブ位置）→ StitchTab
4. 上段 L3 なし → L2（旧: L3 フォールバックは TRN で NG）

---

## 結合修正タスク（Phase 1 正本）

| ID | 内容 | 根拠 |
|----|------|------|
| **S-1** | `trueScrollStartY` を **タブ下端以下にクランプ** | TRN memo・目視 |
| **S-2** | スクロールバー隠しを **スクロール領域内・右端3%のみ** に限定 | 同上 |
| **S-3** | L2 はタブ行から動的 header（≈50%）、L3 は 16% 維持 | 設計パック計測・実機 G-TRN。**→ 監査後 [`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md) で scrollStartY 正本化（L3 16% 廃止予定）** |
| **S-4** | `score<0.85` または `scrollAmount<=0` 時 **absdiff 縦シフトフォールバック** | FRD 低 score |
| **S-5** | `StitchTab.Inheritance` の緑帯クロップ（因子ヘッダー誤検出 Y≈504 回避） | FRD-factor ログ |
| **S-6** | `StitchTab.TrainingInfo` S-6 配線（stitch オーケストレーション） | **done**（R4b `51c5a29`・G-FRD-I 実機クローズ 2026-06-28） |

定数は `opencvStitcher.ts` 先頭に集約。マジックナンバーを経路名で散らさない。

---

## ログパターン（設計パック）

| 結果 | score | scrollAmount | 例 |
|------|-------|--------------|-----|
| OK | ≈0.95+ | ≈240 一定 | HOF skill, CMP skill |
| NG（TRN・修正前） | 0.72〜0.84 | 25/78/188（正だが小刻み） | バー隠し位置が主因 |
| OK（TRN・G-TRN） | ≈0.95+ | ≈241 一定（末端 167） | L2・Header 464px・`green-l2` |
| NG（FRD） | 0.37〜0.80 | 不規則 | S-4 フォールバック対象 |

ウィンドウ HOF: Header 144 / Scroll 621 / Footer 135（H=900）。  
フルスクリーン HOF: Header 168 / Scroll 728 / Footer 157（H=1053）。比率はいずれも約 16%/69%/15%。

---

## Phase 表（改訂）

| Phase | 内容 | 状態 |
|-------|------|------|
| **D1** | 設計レビュー・設計パック | **done** |
| **1** | 結合修正 S-1〜S-5（`opencvStitcher.ts`） | **done** |
| **1b** | 育成情報タブ S-6 | **done**（R4b・G-FRD-I 実機クローズ 2026-06-28） |
| **2** | キャプチャ最小分岐（必要時のみ FactorScroll）・UI ヒント | draft |
| **3** | 実機検証・フルスクリーン最小・docs クローズ | draft — **stitch [`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md) R3.5d-5 で本 REQ Phase 3 をクローズ** |

---

## スコープ

### やること

- [`opencvStitcher.ts`](../../desktop-app/app/lib/opencvStitcher.ts) に StitchLayout / StitchTab 分岐と S-1〜S-6
- 既存 **殿堂入り・育成完了（CMP）** の結合 OK を回帰維持
- TRN / FRD の NG 解消
- GOLDEN: `auto-capture-design-pack/golden/` のフレームで結合のみ再現可能に（開発時デバッグ用・任意コマンド）
- 任意: `CapturePanel.tsx` に「キャプチャ前にタブを開いてください」ヒント

### やらないこと

- Phase 1 で `capture.rs` の経路別4プロファイル分岐
- `geminiOcr.ts` / `fuzzyMatcher.ts` / WASM 変更
- タブ自動切替・画面自動遷移
- 全経路×全タブのフルスクリーン複製検証

---

## 触るファイル

| Phase | ファイル |
|-------|---------|
| 1 | `desktop-app/app/lib/opencvStitcher.ts`（**主**） |
| 1 | `desktop-app/app/hooks/useCapture.ts`（レイアウト判定ログのみ・任意） |
| 1b | 同上 |
| 2 | `capture.rs`（FactorScroll が必要な場合のみ） |
| 2 | `CapturePanel.tsx`（任意） |
| 3 | 本 REQ、`docs/TODO.md`、`docs/tasks/INDEX.md` |

---

## 完了条件

- [x] 設計レビュー D1 完了（設計パック・方針 F-1〜F-5）
- [x] Phase 1: S-1〜S-5 実装
- [x] G-TRN: `golden/TRN/` + memo 合格条件（**実機検証クローズ** 2026-06-26 07:47）
- [ ] G-FRD-S / G-FRD-F: FRD skill・継承 NG 解消（実機/GOLDEN 要確認）
- [ ] G-HOF / G-CMP: ウィンドウ＋フルスクリーン HOF skill 回帰（実機要確認）
- [x] Phase 1b: FRD-info（育成情報）結合 — **実機クローズ**（G-FRD-I・退行ゲート 2026-06-28）
- [ ] 実機検証手順を本 REQ に追記（Phase 3）
- [ ] REQ `done`、TODO 完了済み、INDEX 更新

---

## 検証手順（正本）

> **Capture–Stitch 契約**（**広帯 -4 / 狭帯 -3**・shift 帯・実機 Step）は [`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md)「Capture–Stitch 契約」節が正本。本 REQ は経路別の合格イメージのみ。

**共通**: 対象タブを開く → オートキャプチャ → 結合プレビュー → 目視（＋任意 OCR）。

### GOLDEN（ウィンドウ・設計パック）

| ID | データ | 合格 | 状態 |
|----|--------|------|------|
| G-TRN | `golden/TRN/` 4枚 + memo | スキル全行・タブ上右端非崩壊 | **v2/-4 実機 OK**（2026-06-27） |
| G-HOF-S | `golden/` または実機 skill | stitched-OK 同等 | 未 |
| G-HOF-F | HOF factor | 継承履歴手前・緑クロップ | 未 |
| G-FRD-S | `golden/FRD/skill/` | NG→OK | 未 |
| G-FRD-F | `golden/FRD/factor/` | 因子＋履歴 | 未 |
| G-FRD-I | `golden/FRD/info/` | 戦績末尾・`StitchTab=TrainingInfo` | **実機 OK**（2026-06-28）。golden PNG 未収録 |
| G-CMP | CMP skill/factor/info OK 回帰 | 退行なし | 未 |

### フルスクリーン（最小）

| ID | 内容 |
|----|------|
| FS-HOF | `logs/fullscreen/HOF-skill-console.txt` + stitched 1枚 |
| FS-TRN | 同上 TRN | ウィンドウ G-TRN OK（2026-06-26）。フルスクリーンは未 |

---

## リスク・注意

| リスク | 対策 |
|--------|------|
| L2 header 比率のずれ | `tools/measure-stitch-layout.ps1` で計測・タブ行から動的算出 |
| TrainingInfo はレイアウトが別 | R4b S-6 で stitch 配線完了（実機 OK） |
| ウィンドウサイズ可変（F-5） | 比率ベース。ピクセル固定しない |
| ホイール回数 | **広帯 -4 / 狭帯 -3**（[`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md) R3.5d）。Phase 1 は -5 |
| `capture.rs` 変更 | R3.5d: frame0 帯推定・ホイール 2 段 |

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-28 03:16 | **Phase 1b 実機クローズ** — G-FRD-I `StitchTab=TrainingInfo`・S-6・退行ゲート全 OK。実装は [`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md) R4b | ユーザー再検証。golden PNG は別タスク |
| 2026-06-27 02:32 | **Phase 3 クローズは stitch R3.5d-5 に委譲** | HOF/TRN 実機 OK。FRD NG → 狭帯 -3（frame0 推定）。契約は stitch REQ に集約 |
| 2026-06-27 01:01 | **Phase 3 クローズは stitch R3.5c-5 に委譲** | Capture–Stitch 契約（ホイール -4 等）は [`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md) に集約 |
| 2026-06-25 07:25 | REQ 起票 | ユーザー要望 |
| 2026-06-26 06:03 | **D1 完了・設計確定** | 設計パック分析。キャプチャ Generic 十分・結合が本丸 |
| 2026-06-26 06:03 | 4経路 CaptureProfile **不採用** | 全経路で Rust 末端到達を確認 |
| 2026-06-26 06:03 | StitchLayout + StitchTab 採用 | 経路名ではなくレイアウト/タブで分岐 |
| 2026-06-26 06:03 | F-3 結合先・F-4 汎用・F-2 継承タブ込み | ユーザー承認 |
| 2026-06-26 07:47 | **G-TRN 実機検証クローズ（Phase 1）** | L2/green-l2・Header 464px・scroll≈241（**-5・旧パイプライン**）。目視 OK |
| 2026-06-26 07:33 | **C1 TRN 根本原因修正** | D1 の L2=22% は誤推定。設計パック計測でタブ下端≈50%。緑プロファイル検出＋動的 header |
| 2026-06-26 07:13 | **C1 TRN 実機 NG → L2 判定修正** | L3+Btn 誤判定（成長率帯の明るさ）。L2 下段スキャン優先・L3+Btn 厳格化 |
| 2026-06-26 06:12 | **Phase 1 実装完了**（S-1〜S-5） | StitchLayout/StitchTab・absdiff フォールバック・継承緑帯 searchStartY 修正 |

---

## 実装チャット用プロンプト

Phase 1 用の完成プロンプトは **設計レビューチャット（D1 承認時）** に出力済み。Agent mode 新チャット先頭に貼って着手する。
