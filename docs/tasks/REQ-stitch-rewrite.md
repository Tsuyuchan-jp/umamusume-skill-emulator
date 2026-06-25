# REQ-stitch-rewrite: オートキャプチャ結合の全面リライト

> [`opencvStitcher.ts`](../../desktop-app/app/lib/opencvStitcher.ts) を **scrollStartY 正本** のパイプラインに置き換える。
> 親 REQ: [`REQ-auto-capture-multi-screen.md`](REQ-auto-capture-multi-screen.md)（Phase 1 パッチ完了・本 REQ で根本修正）。
> 設計パック: [`auto-capture-design-pack/`](../../auto-capture-design-pack/)（golden / screenshots / logs）。

- **ステータス**: draft（R0 着手）
- **作成日**: 2026-06-26 08:13
- **関連コミット**: （完了後に記入）

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
| **R1** | `regions.ts`（absdiff 主経路）+ 旧 API 内部差替 | draft |
| **R2** | layout / tabDetect 整理・走査帯魔術削除 | draft |
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
| G-FRD-S | FRD skill golden | L3+Btn | 0.22–0.30 | 下段タブ |
| G-FRD-F | FRD factor golden | L3+Btn | 0.22–0.30 | 練習パートナー解除帯 |

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
| R1+ | `desktop-app/app/lib/stitch/**`, `desktop-app/app/lib/opencvStitcher.ts`（薄い re-export → 削除） |
| R1+ | `desktop-app/app/hooks/useCapture.ts`（StitchReport ログ任意） |

---

## 完了条件

- [x] R0: golden 期待値 JSON + 計測 CLI + Vitest スモーク
- [ ] R1: G-TRN + G-HOF-S golden 合格（scrollStartRatio が期待帯内）
- [ ] R2: G-CMP + G-FRD-S golden 合格
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

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-26 08:13 | **REQ 起票・R0 着手** | 監査で 16%≠目視境界を確認。パッチ積み上げ限界 |
| 2026-06-26 08:13 | **scrollStartY を absdiff 主経路に** | レイアウト非依存・HOF/TRN 共通 |
| 2026-06-26 08:13 | **R0 完了** | golden 6件 PASS。HOF scrollStart≈0.44–0.50、legacy 16% delta +257〜302px |

---

## 実装チャット用プロンプト（新チャット先頭に貼る）

```
## タスク
REQ-stitch-rewrite Phase R1: scrollStartY 正本パイプライン

## 正本
- docs/tasks/REQ-stitch-rewrite.md
- docs/TODO.md Backlog（R1 次チャット）
- tools/stitch-golden/expectations.json

## 前提（監査済み）
- HOF scrollStart ≈ crop 38–43%（旧 Header 144px/16% は目視境界ではない）
- TRN scrollStart ≈ 48–54%（G-TRN OK / 0887fcd）
- 現 opencvStitcher.ts は scrollMats[0] 全貼りで HOF が偶然動いている

## R1 スコープ
1. desktop-app/app/lib/stitch/regions.ts — frame0↔1 absdiff で scrollStartY
2. stitch/stitch.ts オーケストレータ（compose は旧ロジック暫定流用可）
3. opencvStitcher.ts から re-export（USE_STITCH_V2 flag 任意）
4. tools/stitch-golden + npm run stitch:golden で G-TRN / G-HOF-S 期待帯確認

## 触らない
- capture.rs, geminiOcr.ts

## 完了
- G-TRN golden scrollStartRatio 合格
- G-HOF-S golden scrollStartRatio 合格（0.36–0.44）
- TODO / REQ 決定ログ更新 + コミット
```
