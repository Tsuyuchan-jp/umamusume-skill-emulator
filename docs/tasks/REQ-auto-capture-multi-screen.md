# REQ-auto-capture-multi-screen: オートキャプチャの複数ゲーム画面対応

> 殿堂入り以外のステータス確認画面でも、オートキャプチャ→結合→OCR まで通す。
> **設計正本**: 本 REQ（Phase D1 完了: 2026-06-26）。検証データ: [`auto-capture-design-pack/`](../../auto-capture-design-pack/)（リポジトリ直下・git 未追跡可）。

- **ステータス**: draft（Phase 1 done・Phase 1b/3 待ち）
- **作成日**: 2026-06-25 07:25
- **設計レビュー完了**: 2026-06-26 06:03
- **関連コミット**: `700d0b3`（Phase 1）

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
| **TRN** | キャプチャ正常（4フレーム・末端目視 OK）。結合でスクロールバー隠しがタブより上から始まる等の欠陥 |

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
| **TrainingInfo** | 育成情報（戦績等） | Phase 1b: 別結合パス（S-6） |

**判定優先順（結合側）**:

1. タブ行セグメント数 → L2 or L3
2. 練習パートナー解除帯 → L3+Btn
3. 現在タブ（色・アクティブタブ位置）→ StitchTab
4. 判別不能 → L3 + StitchTab.Skill + コンソール warn

---

## 結合修正タスク（Phase 1 正本）

| ID | 内容 | 根拠 |
|----|------|------|
| **S-1** | `trueScrollStartY` を **タブ下端以下にクランプ** | TRN memo・目視 |
| **S-2** | スクロールバー隠しを **スクロール領域内・右端3%のみ** に限定 | 同上 |
| **S-3** | L2 は `headerHeight` 22%、L3 は 16% 維持 | 設計パックログ |
| **S-4** | `score<0.85` または `scrollAmount<=0` 時 **absdiff 縦シフトフォールバック** | FRD 低 score |
| **S-5** | `StitchTab.Inheritance` の緑帯クロップ（因子ヘッダー誤検出 Y≈504 回避） | FRD-factor ログ |
| **S-6** | `StitchTab.TrainingInfo` 別結合パス | FRD-info NG（Phase 1b） |

定数は `opencvStitcher.ts` 先頭に集約。マジックナンバーを経路名で散らさない。

---

## ログパターン（設計パック）

| 結果 | score | scrollAmount | 例 |
|------|-------|--------------|-----|
| OK | ≈0.95+ | ≈240 一定 | HOF skill, CMP skill |
| NG（TRN） | 0.72〜0.84 | 25/78/188（正だが小刻み） | バー隠し位置が主因 |
| NG（FRD） | 0.37〜0.80 | 不規則 | S-4 フォールバック対象 |

ウィンドウ HOF: Header 144 / Scroll 621 / Footer 135（H=900）。  
フルスクリーン HOF: Header 168 / Scroll 728 / Footer 157（H=1053）。比率はいずれも約 16%/69%/15%。

---

## Phase 表（改訂）

| Phase | 内容 | 状態 |
|-------|------|------|
| **D1** | 設計レビュー・設計パック | **done** |
| **1** | 結合修正 S-1〜S-5（`opencvStitcher.ts`） | **done** |
| **1b** | 育成情報タブ S-6 | draft |
| **2** | キャプチャ最小分岐（必要時のみ FactorScroll）・UI ヒント | draft |
| **3** | 実機検証・フルスクリーン最小・docs クローズ | draft |

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
- [ ] G-TRN: `golden/TRN/` + memo 合格条件（実機/GOLDEN 要確認）
- [ ] G-FRD-S / G-FRD-F: FRD skill・継承 NG 解消（実機/GOLDEN 要確認）
- [ ] G-HOF / G-CMP: ウィンドウ＋フルスクリーン HOF skill 回帰（実機要確認）
- [ ] Phase 1b: FRD-info（育成情報）結合
- [ ] 実機検証手順を本 REQ に追記（Phase 3）
- [ ] REQ `done`、TODO 完了済み、INDEX 更新

---

## 検証手順（正本）

**共通**: 対象タブを開く → オートキャプチャ → 結合プレビュー → 目視（＋任意 OCR）。

### GOLDEN（ウィンドウ・設計パック）

| ID | データ | 合格 |
|----|--------|------|
| G-TRN | `golden/TRN/` 4枚 + memo | スキル全行・タブ上右端非崩壊 |
| G-HOF-S | `golden/` または実機 skill | stitched-OK 同等 |
| G-HOF-F | HOF factor | 継承履歴手前・緑クロップ |
| G-FRD-S | `golden/FRD/skill/` | NG→OK |
| G-FRD-F | `golden/FRD/factor/` | 因子＋履歴 |
| G-FRD-I | `golden/FRD/info/` | 戦績末尾（Phase 1b） |
| G-CMP | CMP skill/factor/info OK 回帰 | 退行なし |

### フルスクリーン（最小）

| ID | 内容 |
|----|------|
| FS-HOF | `logs/fullscreen/HOF-skill-console.txt` + stitched 1枚 |
| FS-TRN | 同上 TRN（ユーザー準備中） |

---

## リスク・注意

| リスク | 対策 |
|--------|------|
| L2 header 22% がズレる | 設計パック TRN で再調整。定数1箇所 |
| TrainingInfo はレイアウトが別 | Phase 1b で S-6 を分離 |
| ウィンドウサイズ可変（F-5） | 比率ベース。ピクセル固定しない |
| `capture.rs` 無断変更 | Phase 1 では禁止 |

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-25 07:25 | REQ 起票 | ユーザー要望 |
| 2026-06-26 06:03 | **D1 完了・設計確定** | 設計パック分析。キャプチャ Generic 十分・結合が本丸 |
| 2026-06-26 06:03 | 4経路 CaptureProfile **不採用** | 全経路で Rust 末端到達を確認 |
| 2026-06-26 06:03 | StitchLayout + StitchTab 採用 | 経路名ではなくレイアウト/タブで分岐 |
| 2026-06-26 06:03 | F-3 結合先・F-4 汎用・F-2 継承タブ込み | ユーザー承認 |
| 2026-06-26 07:33 | **C1 TRN 根本原因修正** | D1 の L2=22% は誤推定。設計パック計測でタブ下端≈50%。緑プロファイル検出＋動的 header |
| 2026-06-26 07:13 | **C1 TRN 実機 NG → L2 判定修正** | L3+Btn 誤判定（成長率帯の明るさ）。L2 下段スキャン優先・L3+Btn 厳格化 |
| 2026-06-26 06:12 | **Phase 1 実装完了**（S-1〜S-5） | StitchLayout/StitchTab・absdiff フォールバック・継承緑帯 searchStartY 修正 |

---

## 実装チャット用プロンプト

Phase 1 用の完成プロンプトは **設計レビューチャット（D1 承認時）** に出力済み。Agent mode 新チャット先頭に貼って着手する。
