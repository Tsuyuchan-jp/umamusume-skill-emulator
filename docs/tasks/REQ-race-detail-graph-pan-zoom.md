# REQ-race-detail-graph-pan-zoom: ホイール拡大 + ドラッグパン + 縦拡大削除

> **レース詳細グラフ実装シリーズ** Phase 5-R3。
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
> 前提: [`REQ-race-detail-graph-time-window.md`](REQ-race-detail-graph-time-window.md) 完了後（または並行検討可）

- **ステータス**: draft
- **作成日**: 2026-06-14 10:54
- **関連コミット**: （完了後に記入）

---

## 目的

**俯瞰（レース全体）から操作だけで分析モードへシームレスに遷移** できる Google Map 型 UX を実現する。`expandSkillRows`（縦拡大）checkbox を廃止し、ホイール＝拡大率・ドラッグ＝表示範囲移動に統一する。

---

## スコープ

### やること

- [ ] **ホイール**: 拡大率（時間窓の幅縮小 + Y/K 連動・連続変化）
- [ ] **ドラッグ**: 表示範囲移動（Phase 5-R2 の延長・2D パンへ発展可）
- [ ] **`expandSkillRows` checkbox 削除** — `GraphDisplayState` から除去または常時分析可能に
- [ ] ズームレベルに応じた layout 自動切替（低: overview 相当 / 高: detail stagger + K）
- [ ] **overview（低ズーム）**: 軽い縦ずらし（最大 2〜3 段）— ユーザー要件。速度・体力主役・重なり概ね許容
- [ ] リセット操作（ダブルクリック or ボタンで全体表示）
- [ ] dev Y zoom / cap / need 表示の **削除**（本番前クリーンアップ）
- [ ] `hasSkillLabelOverlaps` / `computeDetailYZoomFactor` 探索ロジックの削除または大幅簡略化
- [ ] 実機確認

### やらないこと

- WASM スキーマ変更
- OCR / パレット / TabBar
- 2 層キャンバス（速度層 + Gantt 完全分離）— 本 REQ 外
- ラベル X オフセット

---

## 仕様（草案）

### 操作

| 操作 | 挙動 |
|------|------|
| ホイール | 拡大 / 縮小（**カーソル位置中心**、K は **連続変化**） |
| ドラッグ | パン（時間軸 ± 必要なら縦スクロール） |
| リセット | レース全体・K≈1・overview layout |

### モード統合

- 最小ズーム: 現行 OFF 相当（全体・被り許容）
- 分析ズーム: 現行 ON 相当（K 4〜5、stagger 展開）を **ズームしきい値** で自動適用

### UI

- checkbox 行から「縦拡大」を削除
- 必要ならズームヒント（「ドラッグで移動・ホイールで拡大」）を最小表示

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/components/RaceDetailChart.tsx` | ホイール、パン state、checkbox 削除、transform 層 |
| `desktop-app/app/lib/raceGraphBuilder.ts` | zoom 探索削除、layout 閾値 |
| `docs/TODO.md` | ライフサイクル |
| `docs/tasks/REQ-race-detail-graph-skill-layout-sync.md` | シリーズ完了の整理 |

---

## 完了条件

- [ ] `docs/TODO.md` Backlog 起票済み
- [ ] 縦拡大 checkbox なしで俯瞰→分析が操作のみで可能
- [ ] ホイール拡大 + ドラッグパンが直感的に動作
- [ ] dev 検証 UI 削除
- [ ] Phase 4 compare / Tooltip / checkbox 残り項目に退行なし
- [ ] `npm run build` 通過
- [ ] ユーザー実機確認
- [ ] REQ `done` + コミット

---

## 検証手順

1. 起動時はレース全体が見える（俯瞰）
2. 終盤へホイールアップ → スキルが読める密度
3. ドラッグで時間窓移動
4. リセットで全体に戻る
5. baseline compare、Tooltip、区間帯
6. dev 表示が消えていること

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-14 10:54 | draft 起票。ホイール=拡大・ドラッグ=移動・縦拡大 checkbox 削除 | ユーザー方針: 俯瞰からシームレスに分析。K 探索はパン世界では不要 |
| 2026-06-18 18:15 | パン設計メモ: ホイール=カーソル中心・K 連続。overview 軽い縦ずらし（2〜3 段）は R3 で実装。checkbox 廃止は R1b 実機後に判断 | 設計レビュー合意（5-R1b 承認チャット） |
