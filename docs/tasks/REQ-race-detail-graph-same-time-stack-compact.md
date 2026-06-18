# REQ-race-detail-graph-same-time-stack-compact: 詳細表示レイアウト（赤線アンカー + 同時刻スタック圧縮）

> **レース詳細グラフ実装シリーズ** Phase 5-R1b（skill layout sync の続き）。
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
> 前提: [`REQ-race-detail-graph-analysis-revert.md`](REQ-race-detail-graph-analysis-revert.md) 完了後
> 関連: 後続実装は [`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md)（Phase 5 最終ゴール）へ統合

- **ステータス**: done（知見は map-view REQ へ移管。detail ON 専用コードは将来統合 layout で置換）
- **作成日**: 2026-06-14 11:15
- **関連コミット**: `782dabe`

---

## 目的

**詳細表示（縦拡大 ON / 将来はホイール拡大）** で、スキル発動地点を速度グラフ上で正確に読み取れるようにする。

1. **赤線の左端**を、発動時刻における **速度折れ線上の点**（横・縦一致）に配置する
2. **同時刻（X 完全重なり）** の複数スキルは、案3 を維持しつつ **hit box 基準のコンパクト段**（〜16px/段）で縦に並べる。**stack 0（一番上）** を発動地点の基準とする
3. 近接時刻（X 部分重なり + Y overlap）は従来どおり **広い段間隔**（`STAGGER_ROW × K`）を維持

---

## ユーザー要件（全体像）

| モード | スキル表示の意図 |
|--------|----------------|
| **全体表示** | 速度・体力が主役。スキルはざっくり位置・フェーズ感。重なり許容。**将来** 軽い縦ずらし（最大 2〜3 段）— 本 REQ 外（R3 以降） |
| **詳細表示** | 赤線左端＝速度線上の発動地点。拡大で被り解消。同時刻のみ軽い縦ずらし（上を基準に見る） |

---

## スコープ

### やること

- [x] detail ON 時: **赤線 Y = 発動時刻の speedY**（stack 0）。赤線左端が速度線上に乗る
- [x] detail ON 時: **ラベルは赤線の上**（`lineY` 基準でラベル配置）。実機で視認性を確認し、将来ラベル下への変更もあり得る
- [x] 同時刻スタック（案3 conflict のみ）: `SKILL_HIT_HEIGHT + COMPACT_GAP`（px 固定、K 非乗算）の **yStackOffset 累積**
- [x] 近接時刻（yOverlap あり）: `STAGGER_ROW × K` の **full 段**を維持（二段階ステップ）
- [x] **案3 維持** — X 重なり時は同一 `stackLevel` に置かない
- [x] `assignStackLevels` は stackLevel 付与ロジックを維持。Y 座標は `yStackOffset` 累積で計算
- [x] K=4.0 固定、overview OFF（stack 0・被り許容）は **変更なし**
- [x] `npm run build` 通過
- [ ] 実機確認（ユーザー）

### やらないこと

- ラベル X オフセット
- 案3 の廃止
- 全体表示時の軽い縦ずらし（→ R3 以降）
- X 時間窓・ドラッグ（→ [`REQ-race-detail-graph-time-window.md`](REQ-race-detail-graph-time-window.md)）
- ホイール・縦拡大 checkbox 削除（→ [`REQ-race-detail-graph-pan-zoom.md`](REQ-race-detail-graph-pan-zoom.md)）
- `computeSkillBandHeight` の更新（→ R3 で `yStackOffset` ベースにまとめて対応）
- WASM / OCR / src-tauri 変更

---

## 仕様

### 現状（問題）

| 項目 | 値 |
|------|-----|
| ラベル baseY | `speedY + 12px`（速度線より下） |
| 赤線 Y | ラベル直下（R1 一体レイアウト）→ **速度線上ではない** |
| 段間隔（detail ON） | `STAGGER_ROW × K` = **56px/段** |
| 同時刻6件時の最下段オフセット | 5 × 56 = **280px** |

### 目標（detail ON）

| 項目 | 方針 |
|------|------|
| stack 0 赤線 Y | `speedY`（+ debuff offset は kind 次第。要実装時確認） |
| stack 0 ラベル | 赤線の上（`labelBottom = lineY - gap` 等） |
| 同時刻スタック（sameLevelOnly） | `COMPACT_STACK_STEP = SKILL_HIT_HEIGHT + COMPACT_GAP`（**16px**、gap=2） |
| 近接 yOverlap | `FULL_STACK_STEP = STAGGER_ROW × K`（**56px**） |
| 発動地点の参照 | **同時刻グループの stack 0（一番上）** の赤線左端 |

### 段ステップの判定

- `startTime` 完全一致は要求しない
- 段上げ理由が **案3 のみ**（`capped === p.stackLevel`、yOverlap なし）→ **compact**
- **yOverlap** が絡む → **full**

### レイアウト計算（承認済み）

1. `assignStackLevels` — 案3 のまま stackLevel 付与。`placed` に `yStackOffset` を追加
2. 採用時: blocker から `yStackOffset = blocker.yStackOffset + stepForReason(...)` を累積
3. `layoutSkillMarkers`:
   - `lineY_px = speedY + yStackOffset`（+ kind offset 方針は実装時に整合）
   - `labelTopPx = lineY_px - lineOffsetPx - labelHeight`（ラベルは赤線上）
4. `markerStackedLabelTopY`（衝突判定）も `yStackOffset` ベースに統一

### overview OFF

- 現状維持: stack 0、K=1、被り許容（変更なし）

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/lib/raceGraphBuilder.ts` | 赤線アンカー、二段階 stagger、`yStackOffset`、`layoutSkillMarkers` |
| `desktop-app/app/components/RaceDetailChart.tsx` | 必要なら overlay 描画の baseline 整合 |
| `docs/TODO.md` | ライフサイクル |

---

## 完了条件

- [x] `docs/TODO.md` Backlog 起票済み（本 REQ 起票時）
- [x] detail ON: stack 0 の **赤線左端**が速度折れ線上の発動点と横・縦一致
- [x] detail ON: ラベルは赤線の上
- [x] 同時刻6件程度で縦スタックが **〜80px 前後**（現状 ~280px から大幅圧縮）— ロジック上 5×16=80px
- [x] ラベル縦被りなし（assignStackLevels 衝突判定維持）
- [x] 近接時刻の full stagger に退行なし（yOverlap 時 full 56px）
- [x] 縦拡大 OFF、baseline compare、Tooltip 退行なし（overview パス未変更）
- [x] `npm run build` 通過
- [ ] ユーザー実機確認
- [x] REQ `done` + コミット

---

## 検証手順

1. 50+ スキル・同時多発レースで縦拡大 ON
2. 単独スキル: 赤線左端が速度線上の発動点に乗ること
3. 同時刻スタック（Peerless Heroine 付近等）: 一番上が速度線上、下は軽い間隔で読めること
4. 終盤の近接時刻スキルで full stagger が効くこと
5. 縦拡大 OFF、baseline compare、Tooltip
6. dev 表示 `Y zoom: 4.00 (fixed)` 維持

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-14 11:15 | draft 起票。同時刻スタックを hit box 基準に圧縮、案3・K=4.0 維持 | 実機: 同時発動が 56px/段で過剰スライド |
| 2026-06-18 18:15 | **設計レビュー承認**。スコープ拡大: 赤線左端を速度線上にアンカー + 二段階 yStackOffset + ラベルは赤線上 | ユーザー要件: 詳細表示で発動地点を速度線上で正確に把握。R1 一体レイアウトからの見直し |
| 2026-06-18 18:15 | COMPACT_GAP=2px（16px/段）。同時刻判定は sameLevelOnly 基準（startTime 完全一致不要） | 被りなし最小。フレーム境界ずれも compact 対象 |
| 2026-06-18 18:15 | 全体表示の軽い縦ずらし（2〜3 段）は R3 以降。`computeSkillBandHeight` は R1b では触らない | 本 REQ は detail ON のみ |
| 2026-06-18 18:23 | 実装完了。`assignStackLevels` に yStackOffset 累積、`layoutSkillMarkers` で赤線アンカー + ラベル上配置 | build 通過。実機検証はユーザー |
| 2026-06-18 18:55 | 実機指摘対応: ラベル描画を `SKILL_LINE_GAP + FONT_SIZE`、速度スナップを linear 補間 + Recharts `type="linear"` | 力業等の赤線ずれ・ラベル隙間 |
| 2026-06-18 19:11 | 赤線は常に speedY（yStackOffset はラベルのみ）。スタックは 1 フレーム以内の同時刻のみ | 長ラベル誤スタックで速度線から離れすぎる問題 |
| 2026-06-18 19:25 | **案1撤回**。同時刻 stack 0 のみ速度線＝赤線。下段は X 揃え・ラベル＋赤線 compact 一体ずらし。赤線重なり禁止 | 分析上、同時刻の赤線完全重なりは不可 |
| 2026-06-18 21:01 | 後続は [`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md) へ。detail ON 専用分岐は統合 layout で置換予定 | Google Map 型が Phase 5 最終ゴールに確定 |
