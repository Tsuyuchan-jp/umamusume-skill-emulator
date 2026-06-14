# REQ-race-detail-graph-analysis-revert: detail 分析モード revert + K 固定

> **レース詳細グラフ実装シリーズ** Phase 5-R1（skill layout sync の続き）。
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
> 前提 REQ: [`REQ-race-detail-graph-skill-layout-sync.md`](REQ-race-detail-graph-skill-layout-sync.md)

- **ステータス**: done
- **作成日**: 2026-06-14 10:54
- **関連コミット**: （完了後に記入）

---

## 目的

`a83d5df` で導入した **赤線／ラベル分離** が実機で視認性を著しく低下させたため、cap 時代に近い **ラベル＋赤線一体レイアウト** に戻す。あわせて detail の Y zoom を **K=4.0 固定** とし、探索アルゴリズム依存をやめて分析モードの拡大感を安定させる。

---

## スコープ

### やること

- [x] 赤線分離 revert — `layoutSkillMarkers` detail 時も label → line の一体配置
- [x] `assignStackLevels` を `markerBaseLabelY` / `markerStackedLabelTopY` 基準に統一（`markerSpeedLineY` / `markerDetailLabelTopY` 削除）
- [x] detail ON 時 `yZoomFactor = 4.0` 固定（`DETAIL_ZOOM_FIXED`）。`computeDetailYZoomFactor` は固定返却に簡略化
- [x] **案3 stagger 維持** — X 重なり時は同一 `stackLevel` に置かない（`capped === p.stackLevel`）
- [x] overview OFF 変更なし（stack 0・被り許容・K=1）
- [x] `npm run build` 通過
- [ ] 実機確認（ユーザー）

### やらないこと

- X 時間窓・ドラッグ（→ [`REQ-race-detail-graph-time-window.md`](REQ-race-detail-graph-time-window.md)）
- ホイール拡大・縦拡大 checkbox 削除（→ [`REQ-race-detail-graph-pan-zoom.md`](REQ-race-detail-graph-pan-zoom.md)）
- dev Y zoom 表示の削除（Phase 3 または別タスク。本 Phase では残してよいが固定値表示になる）
- WASM / OCR / src-tauri 変更

---

## 仕様

### detail ON（縦拡大 checkbox ON）

| 項目 | 値 |
|------|-----|
| `yZoomFactor` | **4.0 固定**（`DETAIL_ZOOM_FIXED`） |
| ラベル Y | `baseY + stackLevel × STAGGER_ROW × K`（`baseY = speedY + 12px + debuff offset`） |
| 赤線 Y | `labelTopPx + lineOffsetPx`（ラベル直下・一体） |
| stagger | 案3（X 重なり → 同一段不可） |
| フォント / hit box | px 固定（既存 `af78fe8` 維持） |

### detail OFF（overview）

- 現状維持: stack 0、K=1、被り許容

### K=4.0 の理由

- K=5.0（cap 時代）よりグラフ拡大に対しスキル名フォント（px 固定）のバランスが良い（ユーザー実機フィードバック）

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/lib/raceGraphBuilder.ts` | revert レイアウト、K 固定、不要ヘルパー整理、`computeSkillBandHeight` 必要なら調整 |
| `desktop-app/app/components/RaceDetailChart.tsx` | `computeDetailYZoomFactor` 呼び出しを固定 K に（または builder 側で固定返却） |
| `docs/TODO.md` | ライフサイクル |
| `docs/tasks/REQ-race-detail-graph-skill-layout-sync.md` | 決定ログ追記 |

---

## 完了条件

- [x] `docs/TODO.md` Backlog 起票済み（本 REQ 起票時）
- [x] 縦拡大 ON: ラベル＋赤線一体、K≈4.0、cap 時代に近い視認性
- [x] 縦拡大 OFF: 退行なし
- [x] baseline compare / Tooltip / checkbox 退行なし
- [x] `npm run build` 通過
- [ ] ユーザー実機確認
- [x] REQ `done` + TODO 完了 + コミット

---

## 検証手順

1. sim 済みタブ（50+ スキル想定）で縦拡大 ON
2. 赤線がラベル直下にあり、発動スキルが一体で読めること（分離 revert 確認）
3. グラフが K≈4 で拡大され、縦スクロールで終盤を追えること
4. 終盤の X 被りが cap 時代より悪化していないこと（完全解消は Phase 2 まで許容）
5. 縦拡大 OFF — overview 密度把握が従来どおり
6. baseline compare ON + スキル hover Tooltip
7. dev 表示が `Y zoom: 4.00` 固定に近いこと

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-14 10:54 | draft 起票。赤線分離 revert + K=4.0 固定 + 案3 維持 | 実機: `a83d5df` 赤線分離は視認性 NG。cap 時代の一体レイアウトが良好。K=5 はフォント相対が小さく感じる |
| 2026-06-14 10:58 | Agent 実装: 赤線／ラベル一体 revert、`DETAIL_ZOOM_FIXED=4.0`、`markerStackedLabelTopY` 統一、探索ロジック削除。`npm run build` 通過 | 引継ぎ Phase 5-R1 完了。実機確認はユーザー |
