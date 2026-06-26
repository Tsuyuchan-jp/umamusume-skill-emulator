# REQ-stitch-rewrite: オートキャプチャ結合の全面リライト

> [`opencvStitcher.ts`](../../desktop-app/app/lib/opencvStitcher.ts) を **scrollStartY 正本** のパイプラインに置き換える。
> 親 REQ: [`REQ-auto-capture-multi-screen.md`](REQ-auto-capture-multi-screen.md)（Phase 1 パッチ完了・本 REQ で根本修正）。
> 設計パック: [`auto-capture-design-pack/`](../../auto-capture-design-pack/)（golden / screenshots / logs）。

- **ステータス**: in-progress（R1/R2 done・R3 待ち）
- **作成日**: 2026-06-26 08:13
- **関連コミット**: `1df1860`（R1）

---

## 目的

Phase 1 / 0887fcd は TRN（L2）を救ったが、HOF（L3）側は **旧 16% 固定 header が目視境界（≈40%）と乖離** したまま、`scrollMats[0]` 全貼り＋ absdiff 後追いで「偶然動く」構造になっている。

本 REQ では結合を **意味論（静的ヘッダー／スクロール境界）と実装を一致** させ、golden 回帰付きで今後の経路・タブ追加に耐える。

---

## 背景（監査結論・2026-06-26）

| 項目 | 旧理解 | 正本 |
|------|--------|------|
| HOF `Header: 144px` | ヘッダー下端 ≈16% | **scrollStart ≈ crop の 38–43%**（900px crop で 340–390px） |
| L3 タブ Y | 8–16% 走査帯 | **タブ上端 ≈ 33–42%**（crop 基準） |
| TRN タブ Y | 22% 誤推定 → 50% 修正済 | **≈47%**（G-TRN OK） |
| 16% 定数 | L3 正当値 | **レガシー crop 分割点**。L3 フォールバックとしてのみ暫定許容 |

---

## アーキテクチャ（正本）

### 座標系

```
Screen
  └─ CropRect（findCropBounds：緑タイトルバー検出）
       ├─ StaticHeader … crop 上端 〜 scrollStartY
       ├─ ScrollRegion … scrollStartY 〜 footerStartY
       └─ Footer … 下端 ≈15%
```

**すべて CropRect 基準の比率。** レイアウト名付きマジック（16% / 50%）は廃止。

### パイプライン

| モジュール | 責務 |
|-----------|------|
| `stitch/crop.ts` | findCropBounds |
| `stitch/regions.ts` | **scrollStartY 決定（主: frame0↔1 absdiff）** |
| `stitch/layout.ts` | L2 / L3 / L3+Btn 分類（regions から導出） |
| `stitch/tabDetect.ts` | StitchTab（Skill / Inheritance / TrainingInfo） |
| `stitch/scrollMatch.ts` | テンプレートマッチ + absdiff フォールバック |
| `stitch/compose.ts` | 縦合成（frame0 静止部 + 差分追記のみ） |
| `stitch/postProcess/*` | バー隠し・継承クロップ・余白トリム |
| `stitch/stitch.ts` | オーケストレータ |
| `stitch/index.ts` | 公開 API（`stitchWithOpenCV` 互換） |

### scrollStartY 決定（中核）

1. **主経路**: Frame0 と Frame1 の absdiff で静止/動的分界を検出（現 S-1 を昇格）
2. **副経路**: タブ行緑プロファイル（scrollStartY 近傍で検証・ログ）
3. **フォールバック**: レイアウト別比率（最終手段・confidence 低）

`headerHeight` 先決 → scroll 切り出し、の順序は **廃止**。

### 合成

```
出力 = StaticHeader(frame0, 0..scrollStartY)
     + ScrollStrip(frame0, scrollStartY..footerStart)
     + Σ append(frameN 下端 overlap)
     + Footer(frameLast)
```

`scrollMats[0]` を header 誤分割を埋める用途で全貼りする方式は廃止。

### 構造化ログ

```typescript
interface StitchReport {
  crop: { x, y, w, h };
  regions: { scrollStartY, ratio, method, confidence };
  layout: 'L2' | 'L3' | 'L3+Btn';
  tab: 'Skill' | 'Inheritance' | 'TrainingInfo';
  frames: Array<{ index, score, scrollAmount, method }>;
}
```

---

## Phase 表

| Phase | 内容 | 状態 |
|-------|------|------|
| **R0** | REQ・golden 期待値・計測 CLI（`tools/stitch-golden/`） | **done** |
| **R1** | `regions.ts`（absdiff 主経路）+ 旧 API 内部差替 | **done** |
| **R2** | layout / tabDetect 整理・走査帯魔術削除 + G-FRD-S scrollStart | **done** |
| **R3** | compose 簡素化・旧 scrollMats 全貼り廃止 | draft |
| **R4** | postProcess 分離・TrainingInfo 別パス（旧 S-6） | draft |
| **R5** | `opencvStitcher.ts` 削除・REQ done | draft |

**Phase 3 実機検証**（[`REQ-auto-capture-multi-screen.md`](REQ-auto-capture-multi-screen.md)）は **R1 完了後** に golden + 実機で再実施。旧「Header 144px」合格基準は **廃止**。

---

## Golden 期待値（scrollStartRatio・crop 基準）

| ID | 入力 | layout | scrollStartRatio | 備考 |
|----|------|--------|------------------|------|
| G-HOF-S | HOF skill S0 / golden | L3 | 0.36–0.46 | 計測 **0.445**（901 crop）。旧 16% delta **+257px** |
| G-HOF-F | HOF factor S0 | L3 | 0.36–0.51 | 計測 **0.495**（継承タブやや下） |
| G-TRN | golden/TRN 4枚 | L2 | 0.48–0.54 | 計測 **0.515**（877 crop）。実機 464/900≈0.516 と整合 |
| G-CMP-S | CMP skill S0 | L3 | 0.36–0.44 | |
| G-FRD-S | FRD skill golden | L3+Btn | 0.52–0.56 | f000+f001 absdiff LOW 走査。計測 **0.554**（目視≈0.55 整合） |
| G-FRD-F | FRD factor golden | L3+Btn | 0.46–0.52 | 練習パートナー解除帯 |

正本 JSON: [`tools/stitch-golden/expectations.json`](../../tools/stitch-golden/expectations.json)

---

## スコープ

### やること

- `desktop-app/app/lib/stitch/` 新設・段階リプレイス
- `tools/stitch-golden/` golden ハーネス（R0）
- [`REQ-auto-capture-multi-screen.md`](REQ-auto-capture-multi-screen.md) の S-3「L3 16%」記述を本 REQ 完了時に更新
- feature flag `USE_STITCH_V2`（R1〜、golden 合格まで旧コード並走）

### やらないこと

- `capture.rs` 経路別プロファイル（親 REQ Phase 2 待ち）
- `geminiOcr.ts` / WASM 変更
- opencv.js 以外への移行（Rust 結合再実装等）

---

## 触るファイル

| Phase | ファイル |
|-------|---------|
| R0 | `tools/stitch-golden/*`, `docs/tasks/REQ-stitch-rewrite.md`, `docs/TODO.md`, `docs/tasks/INDEX.md` |
| R1+ | `desktop-app/app/lib/stitch/**`（R2 残は `regionsCore.ts` 中心）, `opencvStitcher.ts`（re-export） |
| R1+ | `desktop-app/app/hooks/useCapture.ts`（StitchReport ログ任意） |

---

## 完了条件

- [x] R0: golden 期待値 JSON + 計測 CLI + Vitest スモーク
- [x] R1: G-TRN + G-HOF-S golden 合格（scrollStartRatio が期待帯内）
- [x] R2: G-CMP-S golden 合格（layout hard + tabRow + scrollStart）。G-FRD-S layout/tabRow 合格
- [x] R2 残: G-FRD-S scrollStartRatio 合格（absdiff 主経路・LOW 走査 + 小スクロール scan）
- [ ] R3: stitched-OK 退行なし（目視 + SSIM 任意）
- [ ] R4: TrainingInfo 別パス（G-FRD-I）
- [ ] R5: `opencvStitcher.ts` 削除、親 REQ Phase 3 検証クローズ、TODO/INDEX 更新

---

## 検証手順

### R0（計測のみ・挙動変更なし）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\stitch-golden\measure-regions.ps1
cd desktop-app
npm run stitch:golden
```

### R1 以降（結合）

1. 対象タブを手動で開く（F-1）
2. オートキャプチャ → 結合
3. `StitchReport` の `scrollStartRatio` が golden 帯内
4. score≥0.95、scrollAmount≈240（ウィンドウ）を維持
5. 目視: タブ上右端非崩壊・スキル/因子全行

---

## リスク

| リスク | 対策 |
|--------|------|
| absdiff 失敗（FRD 低 score） | テンプレート優先 + confidence 低時 abort |
| R1 で G-TRN 退行 | golden TRN を R1 ゲートに |
| 旧 16% 合格基準の混在 | 本 REQ で scrollStartRatio に統一 |

---

---

## R2 残: G-FRD-S scrollStart（調査メモ）

### 現象（R2 完了時点 `47d5755`）

| 項目 | 結果 |
|------|------|
| G-FRD-S layout | L3+Btn PASS |
| G-FRD-S tabRowRatio | PASS（partner 帯下タブ走査） |
| G-FRD-S scrollStartRatio | **FAIL** — method=`green-tab`、ratio≈**0.545** |
| absdiff 主経路 | golden `frame_000`+`frame_001` で静止境界未検出（scrollStartY=0 等） |
| `estimateScrollAmount` | golden 上 ≈26px（実機ログ frame0→1 は ≈133px） |

### ユーザー観察（2026-06-26）

- FRD スキル画面: スクロール開始境界は **モーダル上端から目測 ≈0.55**
- green-tab 副経路 ≈0.545 は **目視と整合**（副経路はおおむね成功）
- **問題は absdiff 主経路が動いていないこと** → 案A（regionsCore 改善）で対応承認

### 期待帯との関係

- `expectations.json` G-FRD-S: scrollStartRatio **0.46–0.52**（R0 計測由来）
- 目視 / green-tab: **≈0.55**
- 着手時に **absdiff 修正後の計測値**で期待帯を維持するか **0.52–0.56 付近へ更新**するかを決定（変更時は `expectations.json` + `measure-regions.ps1` 監査とセット）

### 承認済み方針（案A）

1. **フレーム選定は変更しない** — `golden/FRD/skill/frame_000.png` + `frame_001.png` 固定
2. **`regionsCore.ts`** — `estimateScrollAmount` 改善 and/or absdiff 前処理（本番 `opencvStitcher` S-4 absdiff scroll フォールバックと整合を検討）
3. **副経路（green-tab）** — 目視 OK のため主目的ではない。主経路修正後もフォールバックとして維持
4. **退行防止** — G-TRN / G-HOF-S scrollStart ゲート必須
5. **R2 成果物は維持** — `layout*` / `tabDetect*` / 走査帯定数は変更しない（scrollStart 決定に layout/tabRow を使わない不変条件も維持）

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-26 18:41 | **R2 残 完了** | `regionsCore`: S-4 scrollAmount + LOW streak 境界 + 小スクロール（<80px）/ 高 ratio 走査。G-FRD-S absdiff **0.554**、期待帯 **0.52–0.56** に更新（R0 単フレーム 0.46–0.52 は absdiff 計測と乖離） |
| 2026-06-26 18:19 | **R2 残: 案A 承認** | G-FRD-S scrollStart は green-tab≈0.545（目視≈0.55）で副経路は妥当。absdiff 主経路未動作が問題。`regionsCore` 改善で対応。f001 固定維持 |
| 2026-06-26 18:19 | **期待帯 0.46–0.52 vs 目視≈0.55** | 着手チャットで absdiff 修正後の計測を正本に期待帯を維持 or 更新を決定 |
| 2026-06-26 08:13 | **REQ 起票・R0 着手** | 監査で 16%≠目視境界を確認。パッチ積み上げ限界 |
| 2026-06-26 08:13 | **scrollStartY を absdiff 主経路に** | レイアウト非依存・HOF/TRN 共通 |
| 2026-06-26 18:07 | **R2 実装完了（layout/tabDetect）** | 走査帯 0.28–0.48/0.52/0.38–0.54 正本化・8–16% 廃止・G-CMP-S PASS。G-FRD-S: layout L3+Btn + tabRow PASS、scrollStart は golden f000/f001 で absdiff 静止境界未検出→green-tab 0.545（期待帯外）。regionsCore 変更は R2 スコープ外のため別途要承認 |
| 2026-06-26 18:07 | **R2 方針確定** | layout/tabDetect 分割、L3+Btn 補助 0.385、partner 帯タブ走査、G-CMP-S/G-FRD-S layout hard assert、USE_STITCH_V2 false 維持 |
| 2026-06-26 08:13 | **R0 完了** | golden 6件 PASS。HOF scrollStart≈0.44–0.50、legacy 16% delta +257〜302px |

---

## 実装チャット用プロンプト（新チャット先頭に貼る）

### R2 残: G-FRD-S scrollStart（regionsCore・案A）

```
@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-stitch-rewrite.md

## チャット種別
実装（Agent mode）

## 背景
REQ-stitch-rewrite **R2 残**。R2 layout/tabDetect は完了（`47d5755`）。
G-FRD-S: layout L3+Btn + tabRow PASS。**scrollStart のみ FAIL**。

## 承認済み方針（案A）
- `regionsCore.ts` で scrollAmount 推定 / absdiff 主経路を改善（FRD golden 向け）
- フレーム選定は変更しない: `golden/FRD/skill/frame_000.png` + `frame_001.png`
- layout / tabDetect（R2）は触らない。scrollStart 決定に layout/tabRow を使わない不変条件維持
- 副経路 green-tab ≈0.545 は目視≈0.55 と整合 → 主目的は absdiff 主経路の復活

## 調査済み事実
- absdiff: f000+f001 で静止境界未検出 → green-tab フォールバック
- `estimateScrollAmount` ≈26px（実機ログ ≈133px）
- golden 期待帯 scrollStartRatio: 0.46–0.52（expectations.json）
- ユーザー目視: 境界 ≈0.55 → 期待帯との差は実装後計測で維持 or 更新を決定ログに記録

## 着手時
- TODO Backlog「G-FRD-S scrollStart」→ 進行中（1件）、フォーカス・最終更新（Get-Date）
- 最初のコミットに TODO 含める

## スコープ
1. `stitch/regionsCore.ts` — estimateScrollAmount 改善、必要なら absdiff 前処理（opencvStitcher S-4 整合検討）
2. `golden.test.ts` — G-FRD-S scrollStart 合格
3. REQ 決定ログ・R2 残 Phase 完了更新

## 触らない
- `layout.ts` / `layoutCore.ts` / `tabDetect*` / `constants.ts` 走査帯
- `compose.ts` / `capture.rs` / `geminiOcr.ts`
- `USE_STITCH_V2`（false 維持）

## 完了条件
- [ ] G-FRD-S: scrollStartRatio∈[0.46,0.52]（または決定ログで更新した帯内）、method=absdiff 優先
- [ ] G-TRN / G-HOF-S scrollStart 退行なし
- [ ] G-FRD-S layout/tabRow 退行なし（R2 ゲート維持）
- [ ] `npm run stitch:golden` 全 PASS
- [ ] TODO 完了・REQ R2 残 done・コミット（push しない）

## 検証
cd desktop-app
npm run stitch:golden
powershell -NoProfile -ExecutionPolicy Bypass -File tools\stitch-golden\measure-regions.ps1 -CaseId G-FRD-S
```

### （参考・旧 R1 プロンプト）

```
## タスク
REQ-stitch-rewrite Phase R1: scrollStartY 正本パイプライン
…（R1 完了済み）
```
