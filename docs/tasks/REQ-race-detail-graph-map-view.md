# REQ-race-detail-graph-map-view: Google Map 型グラフ UI（等倍ズーム + 2D パン）

> **レース詳細グラフ Phase 5 の最終ゴール正本。**
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
> 前提: Phase 4 baseline diff・スキル Tooltip・Phase 5-R1 / R1b の知見（下記「現行コードとの関係」）
>
> **本 REQ は [`REQ-race-detail-graph-time-window.md`](REQ-race-detail-graph-time-window.md)（R2）および [`REQ-race-detail-graph-pan-zoom.md`](REQ-race-detail-graph-pan-zoom.md)（R3）を統合・置換する。**

- **ステータス**: in-progress
- **作成日**: 2026-06-18 21:01
- **関連コミット**: `aca5f6f`（ステップ 1）

---

## 目的

レース詳細グラフを **Google Map 型の操作感** に統一する。

- **起動時**: レース全体を俯瞰（速度・体力・スキル発動の流れを一望）
- **ホイール**: カーソル中心で **XY 等倍ズーム**（画面上の形の比率は不変）
- **ドラッグ**: **2D パン**（時間軸・速度軸方向をまとめて移動）
- **分析**: ズームインした視野で、赤線左端＝速度折れ線上の発動地点を読み取れる

`expandSkillRows`（縦拡大）checkbox や **Y だけ 4 倍（K=4 固定）** といった暫定 UI は廃止し、操作と座標を一本化する。

---

## ユーザー意図（合意・変更不可）

| 項目 | 内容 |
|------|------|
| ズーム | X・Y **同じ倍率**（等倍スケール）。速度線の傾き・スキルと赤線の相対位置がズーム後も崩れない |
| パン | 横ドラッグだけでなく **縦横まとめて** 移動（Google Map と同型） |
| 俯瞰 | ズーム最小＝レース全体。スキルは重なり **概ね許容**、同時刻のみ軽い Y ずらし |
| 拡大 | ズームを上げるとスキル可読性が上がる。赤線↔速度線の整合は **全ズームレベルで維持** |
| 廃止 | 縦拡大 checkbox、K=4 固定トグル、Y だけ伸ばす縦スクロール分析、固定 px reserve の場当たり調整 |

---

## 背景：なぜ作り直すか

### 暫定方式の限界（Phase 5-R1〜R1b 以降）

現行の「縦拡大 ON」は **Y 方向だけ** キャンバスを `K=4` 倍し、X は常にレース全時間を表示する。Google Map 型ではない。

Recharts `LineChart` と overlay SVG の **二重座標** を、`LEGEND_RESERVE` / `XAXIS_RESERVE` 等の **固定 px** で近似しており、K や viewport が変わるとズレが増幅する（5-R1b ポリッシュで顕在化）。

### 段階分割（旧 R2 / R3）とのずれ

旧 R2（X だけ時間窓）+ 旧 R3（Y/K 連動）は、目的文では Google Map 型としていたが、仕様が **X 窓・Y スクロール・K しきい値 layout 切替** と混在していた。本 REQ で **等倍ズーム + 2D パン** を正本とする。

---

## スコープ

### やること

#### 1. ビュー状態（単一の正本）

```typescript
/** グラフの表示変換。scale=1, pan=0 がレース全体の初期俯瞰。 */
interface ChartViewState {
  /** 等倍ズーム倍率。1 = 俯瞰、>1 = 拡大 */
  scale: number;
  /** データ空間または画面空間のパン（実装時にどちらか一方に固定） */
  panX: number;
  panY: number;
}

/** scale=1 かつレース全体が viewport に収まる初期値を race から算出 */
function createInitialChartViewState(raceEnd: number, /* bounds */): ChartViewState;
```

- `scale` は **連続値**（固定 K=4 やしきい値での ON/OFF 切替はしない）
- ホイールは **カーソル位置中心** で `scale` を増減
- ドラッグは `panX` / `panY` を更新（2D）
- ダブルクリック or ボタンで **リセット**（`scale=1`、全体表示）
- 任意: **「終盤へ」** ショートカット（終盤中心にパン + 適度な scale。窓幅 30% 等は実装時に調整）

#### 2. 座標の正本（ChartPlotMetrics）

Recharts の cartesian 矩形と overlay を **同一変換** で結ぶ。

```typescript
interface ChartPlotMetrics {
  /** Recharts が折れ線を描く矩形（実測 or Customized offset） */
  cartesian: { left: number; top: number; width: number; height: number };
  /** 現在の viewState */
  view: ChartViewState;
  /** 表示中の時間範囲（秒） */
  timeMin: number;
  timeMax: number;
  /** 速度軸 domain（既定 [SPEED_MIN, SPEED_MAX]。拡大時は表示範囲が狭まってもよい） */
  speedMin: number;
  speedMax: number;
}

function timeToSvgX(time: number, m: ChartPlotMetrics): number;
function speedToSvgY(speed: number, m: ChartPlotMetrics): number;
function svgToTime(x: number, m: ChartPlotMetrics): number;
function svgToSpeed(y: number, m: ChartPlotMetrics): number;
```

- **固定 `LEGEND_RESERVE` / `XAXIS_RESERVE` への依存を廃止**（フォールバック初期値のみ可）
- `layoutSkillMarkers` / `skillMarkersToPx` / ドラッグヒット判定は **すべて ChartPlotMetrics 経由**
- 実装優先: Recharts `Customized` の `offset` または `useLayoutEffect` + `getBoundingClientRect`

#### 3. 描画アーキテクチャ

- **方式 A（推奨）**: LineChart + overlay SVG を **共通 transform 親** で包み、`scale` / `pan` を一括適用
- **方式 B**: domain 変更 + 同一 metrics 式（transform なし）。等倍ズームを厳密に保つなら A を優先検討
- 軸・Legend・checkbox 行は **ズームに乗せない**（UI chrome 固定）か、仕様で明示

#### 4. スキルレイアウト（全 scale で共通ロジック）

| ズーム | 赤線↔速度線 | 同時刻スタック | X 被り |
|--------|-------------|----------------|--------|
| 低（俯瞰） | **一致**（`markerLineY_px` 系） | **compact**（`COMPACT_STACK_STEP` 16px 程度） | 許容 |
| 高（拡大） | **一致** | compact + 必要なら full 段（`STAGGER_ROW × scale` 等は設計で決定） | 案3 維持（X 重なり時同一 stackLevel 不可） |

- **ON/OFF で layout パスを分けない**（`useDetailAnchorLayout` の expanded 分岐を廃止方向）
- フォント・hit box・赤線 gap は **px 固定**（scale で typography だけ巨大化しない）
- 5-R1b の知見を流用: 赤線左端＝速度線上、ラベルは赤線上、同時刻のみ `yStackOffset`

#### 5. UI 変更

- [ ] `GraphDisplayState` から `expandSkillRows` を削除
- [ ] checkbox 行の「縦拡大」を削除
- [ ] dev 用 `Y zoom: 4.00` 表示を削除
- [ ] `computeDetailYZoomFactor` / `DETAIL_ZOOM_FIXED` / Y だけの `contentChartHeight` 倍率を削除
- [ ] 必要なら最小ヒント（「ドラッグで移動・ホイールで拡大」）

#### 6. 退行防止

- [ ] Phase 4 baseline compare（破線）
- [ ] スキル hover Tooltip・ピル
- [ ] 区間帯・phase 線・表示 checkbox（速度/体力/レーン/スキル/デバフ）
- [ ] `npm run build` 通過

### やらないこと

- WASM `skillEvents` スキーマ変更
- OCR / パレット / `src-tauri/`
- ラベル X オフセット（発動時刻の横位置はずらさない）
- 2 層キャンバス（速度層と Gantt 完全分離）
- 旧 R2 単独（X だけ窓）の先行リリース

---

## 現行コードとの関係

| 既存 | 本 REQ での扱い |
|------|----------------|
| [`REQ-race-detail-graph-skill-layout-sync.md`](REQ-race-detail-graph-skill-layout-sync.md) | シリーズ文脈・決定ログは参照。**実装の正本は本 REQ へ移管** |
| [`REQ-race-detail-graph-analysis-revert.md`](REQ-race-detail-graph-analysis-revert.md) R1 | **完了・知見利用**。K=4 固定 UI は廃止 |
| [`REQ-race-detail-graph-same-time-stack-compact.md`](REQ-race-detail-graph-same-time-stack-compact.md) R1b | **完了・知見利用**。detail ON 専用分岐は統合 layout へ |
| `expandSkillRows` / `DETAIL_ZOOM_FIXED=4` | **廃止** |
| `SKILL_CHART_LEGEND_RESERVE` / `XAXIS_RESERVE` | **廃止方向**（metrics 実測へ） |
| 5-R1b ポリッシュ（`a8744ef` 等） | **暫定**。本 REQ 着手時に metrics 基準へ置換 |

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/components/RaceDetailChart.tsx` | viewState、ホイール/ドラッグ、transform 層、checkbox 削除、metrics 取得 |
| `desktop-app/app/lib/raceGraphBuilder.ts` | ChartPlotMetrics、座標変換一本化、layout 統合、旧 zoom 定数削除 |
| `docs/TODO.md` | Backlog / 完了 |
| `docs/tasks/REQ-race-detail-graph.md` | ロードマップ行更新 |

---

## 実装の推奨順（同一 REQ 内。別 REQ には分割しない）

1. **ChartPlotMetrics + scale=1** — 俯瞰で赤線↔速度線一致・同時刻 compact（旧 OFF 相当を正しく）
2. **ホイール等倍ズーム + 2D パン** — viewState 配線、transform or domain
3. **暫定 UI 削除** — 縦拡大 checkbox、K=4、dev 表示、固定 reserve
4. **実機検証** — 50+ スキル終盤、baseline compare、リセット

---

## 完了条件

- [ ] `docs/TODO.md` Backlog に本 REQ リンク（起票済み）
- [ ] 起動時にレース全体が俯瞰表示される（`scale=1`）
- [ ] ホイールでカーソル中心に **XY 等倍** ズームできる
- [ ] ドラッグで **2D パン** できる
- [ ] 全ズームレベルで赤線左端が速度折れ線上に乗る
- [ ] 同時刻スキルが compact 段で読める（俯瞰でも最低限）
- [ ] 縦拡大 checkbox がなく、操作だけで俯瞰→分析に遷移できる
- [ ] Phase 4 compare / Tooltip / 表示 checkbox に退行なし
- [ ] `npm run build` 通過
- [ ] ユーザー実機確認
- [ ] REQ `done` + コミット

---

## 検証手順

1. シミュ実行後、グラフがレース全体表示（checkbox 縦拡大なし）
2. 終盤へホイールアップ → スキル名・赤線が読める密度。速度線の傾きが不自然に横潰れ/縦伸びしない
3. ドラッグで終盤〜中盤を 2D に追える
4. 同時刻複数スキルで compact スタック。赤線が速度線から外れない
5. ダブルクリック or リセットで全体に戻る
6. baseline compare ON、スキル Tooltip、区間 checkbox
7. ウィンドウリサイズ後も赤線整合が維持されること

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-18 21:01 | **本 REQ を Phase 5 最終ゴール正本とする**。旧 R2/R3 を superseded | ユーザー合意: Google Map 型（等倍 XY ズーム + 2D パン）が意図。段階分割が実装を逸らした |
| 2026-06-18 21:01 | 座標正本は **ChartPlotMetrics**（cartesian 実測 + viewState）。固定 px reserve は廃止方向 | K=4・パンで破綻。OFF(scale=1) で揃えた変換式を scale/pan に拡張する |
| 2026-06-18 21:01 | スキル layout は **scale によらず同一ロジック**（赤線アンカー + 同時刻 compact） | ON/OFF 二重パスがズレの温床。5-R1b 知見は統合して流用 |
| 2026-06-18 21:01 | `expandSkillRows` / `DETAIL_ZOOM_FIXED` / Y 単独クローズアップを廃止 | 暫定 UI。最終操作はホイール+ドラッグのみ |
| 2026-06-18 21:22 | **ステップ 1 完了**: ChartPlotMetrics + Recharts Customized 実測、統合 layout（赤線アンカー + 同時刻 compact + 案3）、scale=1 固定 | 固定 LEGEND/XAXIS reserve を OFF 経路から除去。ステップ 2 で viewState 配線 |

---

## 設計レビュー起票プロンプト（Agent 着手時）

```
@docs/tasks/REQ-race-detail-graph-map-view.md
@desktop-app/app/components/RaceDetailChart.tsx
@desktop-app/app/lib/raceGraphBuilder.ts

Phase 5 最終: Google Map 型グラフ UI。
1) ChartPlotMetrics の取得方法（Customized vs DOM）
2) transform 親 vs domain ズームの選択
3) 実装順 1（scale=1 で赤線整合）から着手
```
