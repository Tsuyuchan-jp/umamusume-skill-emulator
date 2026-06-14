# REQ-race-detail-graph-same-time-stack-compact: 同時刻スキル縦スタック圧縮

> **レース詳細グラフ実装シリーズ** Phase 5 派生（skill layout sync の続き）。
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
> 前提: [`REQ-race-detail-graph-analysis-revert.md`](REQ-race-detail-graph-analysis-revert.md) 完了後
> 関連: Phase 5-R2 着手前の実施を推奨（layout / hit 判定と絡む）

- **ステータス**: draft
- **作成日**: 2026-06-14 11:15
- **関連コミット**: （完了後に記入）

---

## 目的

同一タイミング（X 完全重なり）で発動する複数スキルが、案3 stagger の段間隔 `STAGGER_ROW × K`（現状 56px/段）により **必要以上に縦に離れて表示される** 問題を解消する。ラベルが縦に被らない **最小間隔** まで詰め、速度線付近の視認性を改善する。

---

## スコープ

### やること

- [ ] 同時刻（X 重なり・案3 のみ conflict）スタックの段間隔を **hit box 基準のコンパクトステップ** に変更
- [ ] 近接時刻（X 部分重なり + Y overlap あり）の既存 `STAGGER_ROW × K` stagger は維持（二段階ステップ）
- [ ] **案3 維持** — X 重なり時は同一 `stackLevel` に置かない
- [ ] 速度スナップ（`+12px`）、赤線一体レイアウト、K=4.0 固定は維持
- [ ] `npm run build` 通過
- [ ] 実機確認（ユーザー）

### やらないこと

- ラベル X オフセット（ユーザー方針: ずらさない）
- 案3 の廃止（同一段への複数スキル配置）
- X 時間窓・ドラッグ（→ [`REQ-race-detail-graph-time-window.md`](REQ-race-detail-graph-time-window.md)）
- ホイール・縦拡大 checkbox 削除（→ [`REQ-race-detail-graph-pan-zoom.md`](REQ-race-detail-graph-pan-zoom.md)）
- WASM / OCR / src-tauri 変更

---

## 仕様

### 現状（問題）

| 項目 | 値 |
|------|-----|
| 段間隔（detail ON） | `STAGGER_ROW × K` = 14 × 4.0 = **56px** |
| hit box 高さ | `SKILL_HIT_HEIGHT` = **14px** |
| 同時刻6件時の最下段オフセット | 5 × 56 = **280px**（先頭ラベル上端比） |

実機例: Peerless Heroine〜中距離コーナー◎ 付近で同時発動スキルが過剰に縦スライド。

### 目標

| 項目 | 方針 |
|------|------|
| 同時刻スタック | `SKILL_HIT_HEIGHT + gap`（px 固定、**K 非乗算**）を段ステップとする |
| gap | 2〜4px 程度（被りなし最小。実装時に調整） |
| stack 0 | 現行どおり `markerBaseLabelY`（速度スナップ +12px） |
| 近接 X 被り（Y overlap あり） | 現行 `STAGGER_ROW × K` を維持 |

### 実装方針（案）

1. `assignStackLevels` で conflict 理由を区別（`yOverlap` 由来 vs `capped === p.stackLevel` のみ）
2. `layoutSkillMarkers` / `markerStackedLabelTopY` で **コンパクト段** と **通常段** の累積 Y を計算
3. `computeSkillMaxStack` / `computeSkillBandHeight` が新ステップと整合するよう必要なら調整

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/lib/raceGraphBuilder.ts` | 二段階 stagger、`assignStackLevels` / layout Y 計算 |
| `desktop-app/app/components/RaceDetailChart.tsx` | 必要なら dev 表示・高さ見積もり |
| `docs/TODO.md` | ライフサイクル |

---

## 完了条件

- [ ] `docs/TODO.md` Backlog 起票済み（本 REQ 起票時）
- [ ] 同時刻6件程度のレースで、縦スタックが **〜80px 前後** に収まる（現状 ~280px から大幅圧縮）
- [ ] ラベル縦被りなし
- [ ] 近接時刻の X+Y stagger に退行なし
- [ ] 縦拡大 ON/OFF、baseline compare、Tooltip 退行なし
- [ ] `npm run build` 通過
- [ ] ユーザー実機確認
- [ ] REQ `done` + コミット

---

## 検証手順

1. 50+ スキル・同時多発レースで縦拡大 ON
2. 同時刻スタック（Peerless Heroine 付近等）が詰まって読めること
3. 終盤の近接時刻スキルで従来どおり stagger が効くこと
4. 縦拡大 OFF、baseline compare、Tooltip
5. dev 表示 `Y zoom: 4.00 (fixed)` 維持

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-14 11:15 | draft 起票。同時刻スタックを hit box 基準に圧縮、案3・K=4.0 維持 | 実機: 同時発動が 56px/段で過剰スライド。R2/R3 では Y stagger 方針は変わらない |
