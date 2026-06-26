# REQ-stitch-rewrite: オートキャプチャ結合の全面リライト

> [`opencvStitcher.ts`](../../desktop-app/app/lib/opencvStitcher.ts) を **scrollStartY 正本** のパイプラインに置き換える。
> 親 REQ: [`REQ-auto-capture-multi-screen.md`](REQ-auto-capture-multi-screen.md)（Phase 1 パッチ完了・本 REQ で根本修正）。
> 設計パック: [`auto-capture-design-pack/`](../../auto-capture-design-pack/)（golden / screenshots / logs）。

- **ステータス**: in-progress（R0–R3 done・**R3.5 設計レビュー待ち**・R4 待ち）
- **作成日**: 2026-06-26 08:13
- **関連コミット**: `b01ceb3`（R2 残 scrollStart）、`47d5755`（R2 layout）、`1df1860`（R1）

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
| **R3** | compose 簡素化・旧 scrollMats 全貼り廃止・V2 配線 | **done** |
| **R3.5a** | `shiftEstimate`（全重なり SSD + セッション median）— scrollMatch 置換 | **draft**（設計レビュー待ち） |
| **R3.5b** | layout L2 優先・tabDetect 2タブガード（TRN） | draft |
| **R3.5c** | golden / 実機再検証クローズ（FRD/TRN） | draft |
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
| R1+ | `desktop-app/app/lib/stitch/**`（R3: `compose.ts` / `scrollMatch.ts` / `stitch.ts`）, `opencvStitcher.ts`（段階委譲） |
| R3.5 | `shiftEstimateCore.ts` / `shiftEstimate.ts`（`scrollMatch*` 置換またはラッパー差替）, `layoutCore.ts`（R3.5b）, golden 拡張 |
| R1+ | `desktop-app/app/hooks/useCapture.ts`（StitchReport ログ任意） |

---

## 完了条件

- [x] R0: golden 期待値 JSON + 計測 CLI + Vitest スモーク
- [x] R1: G-TRN + G-HOF-S golden 合格（scrollStartRatio が期待帯内）
- [x] R2: G-CMP-S golden 合格（layout hard + tabRow + scrollStart）。G-FRD-S layout/tabRow 合格
- [x] R2 残: G-FRD-S scrollStartRatio 合格（absdiff 主経路・LOW 走査 + 小スクロール scan）
- [x] R3: stitched-OK 退行なし（HOF 実機 OK・golden compose スモーク）
- [ ] R3.5a: shiftEstimate 実装・HOF 退行なし・FRD scrollAmount 安定化
- [ ] R3.5b: G-TRN layout=L2 実機・tabDetect 退行なし
- [ ] R3.5c: 実機 Step 3–4–6 再検証クローズ
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

---

## R3: compose 簡素化（設計レビュー対象）

### 背景（R2 完了時点）

| 領域 | 状態 |
|------|------|
| scrollStart 決定（golden） | `regionsCore.ts` — absdiff LOW 走査。G-FRD-S **0.554**（`b01ceb3`） |
| layout / tabDetect | R2 完了（`47d5755`） |
| **本番結合** | `USE_STITCH_V2=false` — 旧 `opencvStitcher` 経路 |
| headerHeight（本番） | タブ行から算出（**scrollStartY 未使用**） |
| 合成 | `scrollMats[0]` 全貼り + S-1 後追い absdiff（スクロールバー隠しのみ） |

### R3 で解く問題

旧パイプラインは **headerHeight（≈16% やタブ行）と scrollStartY（≈40–55%）が不一致** のまま、`scrollMats[0]` 全貼りで誤差を吸収している。REQ 正本の合成式:

```
出力 = StaticHeader(frame0, 0..scrollStartY)
     + ScrollStrip(frame0, scrollStartY..footerStart)
     + Σ append(frameN 下端 overlap)
     + Footer(frameLast)
```

### 設計レビューで決めること

1. **`USE_STITCH_V2` を R3 で ON にするか** — ON なら `regions.ts` を `regionsCore` と同期必須
2. **`compose.ts` / `scrollMatch.ts` の切り出し方** — `opencvStitcher.ts` から何を移すか
3. **段階移行** — 旧経路を feature flag で残す期間、ログ（StitchReport）の粒度
4. **検証** — 設計パック `stitched-OK` / `stitched-NG` との照合、golden scrollStart 退行ゲート
5. **R4 との境界** — スクロールバー隠し・継承クロップ・余白トリムを R3 に含めるか

### R3 スコープ案（draft）

**やること**

- `stitch/compose.ts` — 正本合成式の実装
- `stitch/scrollMatch.ts` — テンプレート + S-4 absdiff（`opencvStitcher` から抽出）
- `stitch/stitch.ts` — オーケストレータ（crop → regions → layout → scrollMatch → compose）
- `opencvStitcher.ts` — 薄いラッパーへ段階縮小（R5 で削除）

**やらないこと（R3）**

- `capture.rs` / `geminiOcr.ts`
- TrainingInfo 別パス（R4）
- Phase 3 実機検証クローズ（R5 後）

### 完了条件（R3）

- [x] HOF/CMP/TRN の stitched-OK 相当が目視退行なし（設計パック参照・下記決定ログ）
- [x] `npm run stitch:golden` 全 PASS（scrollStart ゲート維持・12件）
- [x] REQ 合成式どおり scrollMats[0] 全貼り廃止・S-1 後追い absdiff 廃止
- [x] `USE_STITCH_V2=true`・ログは scrollStartY 基準
- [x] compose golden スモーク（G-TRN + G-HOF-S）PASS
- [x] S-5・trimBottomWhitespace が R3 で動作（compose / stitch オーケストレータ）

---

## R3.5: shiftEstimate 再設計（scrollMatch ゼロベース）

> **正本**: 2026-06-26 実機検証 + 当チャットでのゼロベース設計レビュー。R4 着手前の **必須ゲート**。

### R3 実機検証サマリ（2026-06-26 夕方）

| Step | 経路 | 結果 | ログ上の特徴 |
|------|------|------|-------------|
| 1 | G-HOF-S | **OK** | scrollStart≈0.448、scrollAmount **240 前後で安定**、出力 Y≈2168 |
| 2 | G-CMP-S | スキップ | — |
| 3 | G-TRN | **NG** | **L3+Btn 誤判定**、`StitchTab=Inheritance`、scrollAmount **187/26/26/167** と乱れる |
| 4 | G-FRD-S | **NG** | layout OK、scrollStart≈0.554 OK、scrollAmount **26 多発**、出力短い |
| 5 | G-HOF-F | **OK** | 継承 S-5・scroll≈240 安定 |
| 6 | G-FRD-F | **NG** | scrollAmount ばらつき・結合位置ずれ |
| 7 | FS | スキップ | R3.5 後 |

**結論**: REQ 合成式 + scrollStartY + compose は **HOF で実証済み**。FRD/TRN の NG は主に **`scrollMatch`（NCC 下端テンプレート）の誤推定**。キャプチャは毎回ホイール -5 固定であり、**同一セッション内の scrollAmount はほぼ一定であるべき**（最終フレームのみ短くてよい）。

### 根本原因（技術）

| 現象 | 原因 |
|------|------|
| HOF のみ scrollAmount≈240 で安定 | scrollRegion が広く、NCC が真のずれを拾えている **条件付き成功** |
| FRD の scrollAmount=26 @ score 0.96+ | 下端 20% テンプレート NCC が **スキル1行分（≈26px）** の誤ピークを高信頼で採用。absdiff フォールバック未発動 |
| 同一セッション内で 26/133/187 が交互 | フレームごとに **独立した誤マッチ**（ゲームのスクロールが毎回変わったわけではない） |
| TRN の L3+Btn + Inheritance | `tabY≈0.47` が L3+Btn 閾値に抵触 + `l3Row` が `l2Row` より先に評価。3タブ分割で中央＝継承と誤判定 |

**捨てる**: NCC 下端テンプレート主経路、フレーム独立推定、layout 依存の狭 ROI マッチ  
**維持**: crop、regionsCore（scrollStartY）、REQ 合成式、compose、S-2/S-5/trim

### 問題モデル（ゼロベース）

連続フレームは crop 内で **リスト部分だけが剛体で上方向に平行移動**した画像。未知量はペアごとの縦シフト `S_k`（= overlap / scrollAmount）のみ。

**前提（実機直感・capture 固定入力）**:

- 同一セッション内 `S_0 ≈ S_1 ≈ … ≈ S*`（代表値）
- 最終ペアのみ `S_last < S*` 可（リスト末端）

### アルゴリズム正本

#### Step A — 幾何（現行維持）

- CropRect、`scrollStartY`（frame0↔1 absdiff LOW streak）、`footerStartY`（15%）
- layout / tab は **合成・postProcess・ログ用**。scroll 推定 ROI を layout で狭めない

#### Step B — ペアワイズ縦シフト（新: shiftEstimate）

スクロール帯 `rows [scrollStartY, footerStartY)` について、隣接フレーム `prev` / `curr` ごとに:

```
score(S) = mean | prev[scrollStartY + S + y, x] - curr[scrollStartY + y, x] |
           （y: 重なり全体、x: 内容列・例: 左80%・スクロールバー列除外）
採用 S = argmin score(S)   （全重なり SSD / absdiff。NCC 主経路は廃止）
探索: S ∈ [S_min, S_max]  例 S_min=40, S_max=H_strip-40
```

**現行 scrollMatch との差**: 下端 20% テンプレートではなく **重なり全体**で整合。`regionsCore` の scrollStart 決定と **同族の shift+diff**。

#### Step C — セッション一貫性

1. `S* = median(S_k)` をセッション代表とする  
2. `|S_k - S*| > τ`（例 40px）→ 外れ値：代表近傍で Step B 再探索、または `S_k ← S*`  
3. 最終ペアのみ: `S_last < 0.85·S*` かつ score 不良 → 末端打ち切り（HOF の 203px パターン）  
4. 再探索後も score 不良 → bound（以降フレーム破棄）

#### Step D〜F — 合成・後処理（R3 維持）

- compose: REQ 正本合成式  
- S-2 / S-5 / trimBottomWhitespace

### モジュール対応

| 現行 | R3.5 後 |
|------|---------|
| `scrollMatchCore.ts`（NCC） | **`shiftEstimateCore.ts`**（SSD + median） |
| `scrollMatch.ts` | `shiftEstimate.ts` 薄ラッパー、または `scrollMatch` を内部委譲 |
| `layoutCore.ts` | R3.5b: L2 優先・2タブガード |
| `compose*` / `regions*` / `stitch.ts` | 基本維持（shift 入力元のみ差替） |

### Phase 分割

| Phase | 内容 | ゲート |
|-------|------|--------|
| **R3.5a** | shiftEstimateCore + stitch 配線。NCC 主経路廃止 | golden 退行なし、HOF 実機 scroll 安定、FRD 設計パックフレームで `std(S_k)` 低下 |
| **R3.5b** | layout L2 優先、tabDetect 2タブ時は 3 分割しない | G-TRN layout hard、実機 Step 3 |
| **R3.5c** | 実機 Step 3–4–6 再検証、Phase 3 残クローズ | 親 REQ 検証表更新 |

**R4（postProcess / TrainingInfo）は R3.5c 完了後。**

### R3.5a 完了条件（draft）

- [ ] `scrollMatchCore` NCC 主経路を SSD 主経路に置換（または `shiftEstimateCore` 新設）
- [ ] セッション median + 外れ値処理（Step C）実装
- [ ] `npm run stitch:golden` 全 PASS（scrollStart/layout 退行なし）
- [ ] compose スモーク: FRD フレーム列で overlap 合計・`std(S_k)` 閾値
- [ ] HOF 実機: scrollAmount 240 前後維持、出力退行なし
- [ ] ログ: `method=ssd`（または同等）、`S*` 代表値を出力

### R3.5b 完了条件（draft）

- [ ] G-TRN: `StitchLayout=L2`（golden + 実機）
- [ ] `StitchTab` が 2タブ画面で Inheritance にならない
- [ ] scrollStart / HOF / FRD 退行なし

### 非エンジニア向け要約（Step B/C）

- **Step B**: 2枚の写真を「透明シート」のようにずらし、**全体が一番きれいに重なる距離**を測る（一部だけ合わせない）  
- **Step C**: 全ペアの距離は **だいたい同じはず**。26px のような明らかにおかしい値は **測り間違いとして直す**

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-26 22:19 | **R3.5 ゼロベース設計** | R3 実機: HOF OK・FRD/TRN NG。scrollMatch NCC は HOF で偶然成功。正本は **全重なり SSD（Step B）+ median 一貫性（Step C）**。Phase: R3.5a shiftEstimate → R3.5b layout TRN → R3.5c 実機クローズ。R4 は R3.5 後 |
| 2026-06-26 22:19 | **R3 実機検証記録** | Step1/5 OK。Step3 TRN: L3+Btn+Inheritance 誤判定。Step4/6 FRD: scrollAmount 26 多発。Step2/7 スキップ |
| 2026-06-26 19:41 | **R3 完了** | A1+B2+C1 承認どおり compose/scrollMatch/stitch・`USE_STITCH_V2=true`。golden 12/12 PASS。FRD/TRN 実機 NG は scrollMatch が主因 → R3.5 へ |
| 2026-06-26 19:37 | **R3 実装着手** | 設計レビュー承認（A1+B2+C1）。正本合成式・S-2 scrollStartY 基準・S-5/trim R3 含有 |
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

### R3: compose 簡素化 — 設計レビュー起票（Ask mode）

```
@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-stitch-rewrite.md
@desktop-app/app/lib/opencvStitcher.ts
@desktop-app/app/lib/stitch/regionsCore.ts
@desktop-app/app/lib/stitch/README.md
@auto-capture-design-pack/README.md

## チャット種別
設計レビュー（Ask mode）

## 進め方（重要）
- このチャットでは **コード変更・ファイル編集・コミットを一切しない**
- 現状整理 → 方針提案 → 変更範囲 → リスク → 検証手順 まで提示する
- 私が「承認」「修正」「見送り」のいずれかを返すまで、実装に進まない

## 背景
REQ-stitch-rewrite **R0–R2 完了**（`b01ceb3`）。scrollStart / layout / tabDetect は golden 10/10 PASS。
**次は R3**: 結合（compose）を REQ 正本の合成式に合わせ、旧 scrollMats[0] 全貼りを廃止する。

## 現状のギャップ（調査済み）
- 本番 `USE_STITCH_V2=false` → headerHeight はタブ行算出。scrollStartY（regionsCore）は **golden 計測のみ**
- `regionsCore.ts`（LOW streak + 小スクロール scan）と `regions.ts`（OpenCV・旧 HIGH streak）**未同期**
- `compose.ts` / `scrollMatch.ts` は **未作成**。合成ロジックは `opencvStitcher.ts` に残存
- 設計パック: HOF/CMP は stitched-OK、FRD/TRN は stitched-NG あり（R3 の改善対象）

## 今回決めたいこと
1. R3 の **推奨アーキテクチャ**（compose / scrollMatch / stitch オーケストレータ分割）
2. **`USE_STITCH_V2` を R3 で ON にするか**、段階移行の手順
3. **`regions.ts` を regionsCore と同期するタイミング**（R3 必須か R3.5 か）
4. **R3 と R4（postProcess）の境界** — スクロールバー隠し・継承クロップをどこまで含めるか
5. **検証計画** — golden + 設計パック stitched 目視 + 退行ゲート

## 確認してほしいファイル
- desktop-app/app/lib/opencvStitcher.ts（合成・scrollMatch・S-1 後追い）
- desktop-app/app/lib/stitch/regionsCore.ts / regions.ts / flags.ts
- desktop-app/app/lib/stitch/golden.test.ts
- tools/stitch-golden/expectations.json
- auto-capture-design-pack/screenshots/**/stitched-*.png
- docs/tasks/REQ-auto-capture-multi-screen.md（Phase 1 S-1〜S-5）

## 触らないこと（設計上も変更提案に含めない）
- capture.rs / geminiOcr.ts / WASM
- layout.ts / tabDetect.ts / constants.ts 走査帯（R2 正本維持）

## 報告形式（CHAT_TEMPLATE.md 準拠）
1. 現状整理 — データの流れ（crop → header → scrollMats → 合成）
2. 選択肢比較 — 2〜3案（V2 ON タイミング、compose 切り出し粒度）
3. 推奨案（1つ）
4. 変更計画 — 触る/触らないファイル
5. 移行・互換 — USE_STITCH_V2 / 旧ログ Header 144px 廃止
6. UI・UX — ユーザー向け変更（あれば）
7. リスク・未決事項 — 質問形式
8. 検証手順 — golden + 設計パック + 実機（任意）
9. 実装チャット用完成プロンプト — Agent mode 1ブロック（▼ここからコピー / ▲ここまで）

## 完了条件（設計レビュー）
- R3 スコープ・V2 方針・regions 同期タイミングが文書化されている
- Agent mode 実装プロンプトがそのまま貼れる
```

### R2 残: G-FRD-S scrollStart（完了・参考）

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

### R3.5a: shiftEstimate — 設計レビュー起票（Ask mode）【次チャット推奨】

```
@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-stitch-rewrite.md
@desktop-app/app/lib/stitch/scrollMatchCore.ts
@desktop-app/app/lib/stitch/scrollMatch.ts
@desktop-app/app/lib/stitch/stitch.ts
@desktop-app/app/lib/stitch/regionsCore.ts
@desktop-app/app/lib/stitch/composeCore.ts
@auto-capture-design-pack/logs/FRD-skill-console.txt
@auto-capture-design-pack/logs/TRN-console.txt

## チャット種別
設計レビュー（Ask mode）

## 進め方（重要）
- このチャットでは **コード変更・ファイル編集・コミットを一切しない**
- REQ R3.5 節を正本とし、現状整理 → 詳細設計 → 定数・閾値 → リスク → 検証 → Agent 用プロンプト まで提示
- 私が「承認」「修正」「見送り」のいずれかを返すまで、実装に進まない

## 背景
REQ-stitch-rewrite **R3 完了**（`7fbf8b5`）。golden 12/12 PASS だが **実機 NG**:
- G-HOF-S / G-HOF-F: OK（scrollAmount≈240 安定）
- G-FRD-S / G-FRD-F: NG（scrollAmount=26 多発・結合位置ずれ）
- G-TRN: NG（L3+Btn 誤判定は R3.5b。本 Phase は scrollMatch のみ）

**ゼロベース結論（REQ R3.5 節）**: 現行 `scrollMatchCore` の NCC 下端テンプレートを廃止し、
**Step B** 全重なり SSD 縦シフト + **Step C** セッション median 一貫性 に置換する。

## 今回決めたいこと（R3.5a スコープ）
1. `shiftEstimateCore.ts` API（入力: スクロール帯 RGBA 列、出力: overlaps[] + S* + per-frame metadata）
2. SSD 探索範囲 `S_min` / `S_max`、内容列マスク（スクロールバー除外 80% 等）
3. Step C: median `S*`、外れ値閾値 τ、末端フレーム例外、bound 判定
4. `scrollMatch.ts` との統合（置換 vs 内部委譲・ログ互換）
5. golden 拡張案（FRD 連番フレームで `std(S_k)` / 26px 連発 NG）
6. HOF 退行防止（240 前後維持のゲート）

## 触らないこと（R3.5a）
- `layoutCore.ts` / `tabDetect*`（→ R3.5b）
- `compose*` / `regionsCore` scrollStart ロジック
- `capture.rs` / `geminiOcr.ts`

## 実機参考ログ（R3・ウィンドウ）
- HOF OK: scrollStart≈0.448、scrollAmount 240×5 + 203
- FRD NG: scrollStart≈0.554 OK、scrollAmount 26 多発、Y≈1248（旧設計パック≈1409）
- TRN NG: scrollAmount 187/26/26/167（layout 修正は R3.5b）

## 報告形式
1. 現状 scrollMatch の失敗モード整理
2. shiftEstimate 詳細アルゴリズム（疑似コード可）
3. 定数表（初期値 + 調整方針）
4. モジュール構成・ファイル一覧
5. golden / 実機検証計画
6. リスク（HOF 退行・性能・フルスクリーン）
7. 実装チャット用完成プロンプト（Agent mode 1ブロック）

## 完了条件（設計レビュー）
- R3.5a の API・閾値・テストゲートが文書化されている
- Agent mode 実装プロンプトがそのまま貼れる
```

### R3.5a: shiftEstimate — 実装起票（Agent mode・設計レビュー承認後）

```
@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-stitch-rewrite.md
@desktop-app/app/lib/stitch/scrollMatchCore.ts
@desktop-app/app/lib/stitch/scrollMatch.ts
@desktop-app/app/lib/stitch/stitch.ts
@desktop-app/app/lib/stitch/golden.test.ts
@desktop-app/app/lib/stitch/goldenMeasure.ts

## チャット種別
実装（Agent mode）

## 背景
REQ R3.5a（設計レビュー承認済み）。scrollMatch NCC → shiftEstimate（SSD + median）。

## 着手時
- TODO Backlog「R3.5a shiftEstimate」→ 進行中、`最終更新:` Get-Date
- 最初のコミットに TODO 含める

## 実装
（設計レビューで確定した API・閾値に従う。REQ R3.5 節 Step B/C 正本）

## 完了条件
- [ ] REQ R3.5a チェックリスト全項目
- [ ] npm run stitch:golden 全 PASS
- [ ] TODO 完了・コミット（push しない）

## 検証
cd desktop-app
npm run stitch:golden
実機: G-HOF-S 退行なし → G-FRD-S
```
