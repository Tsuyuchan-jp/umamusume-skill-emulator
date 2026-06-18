# REQ-race-detail-graph-time-window: X 時間窓 + ドラッグパン

> **レース詳細グラフ実装シリーズ** Phase 5-R2。
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
> 前提: [`REQ-race-detail-graph-analysis-revert.md`](REQ-race-detail-graph-analysis-revert.md) 完了後
>
> **⚠ superseded** — 2026-06-18: X だけ時間窓 + Y 固定の段階実装はユーザー意図（Google Map 型・等倍 XY ズーム + 2D パン）とずれた。**実装正本は [`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md)**。本ファイルは決定ログ・経緯の参照用に残す。

- **ステータス**: superseded
- **作成日**: 2026-06-14 10:54
- **関連コミット**: （完了後に記入）

---

## 目的

終盤密集区間の **X 方向テキスト被り** を、フル XY パンより軽量な **時間窓（domain 絞り込み）+ 横ドラッグ** で解消する。Y zoom（K 固定）は Phase 5-R1 を維持しつつ、表示秒数あたりのピクセルを増やす。

---

## スコープ

### やること

- [ ] グラフ表示状態に `timeStart` / `timeEnd`（秒）を導入
- [ ] Recharts `XAxis` `domain={[timeStart, timeEnd]}` と overlay SVG の X 座標を同期
- [ ] **「終盤へ」** ボタン（または同等 UI）— 窓幅 = レース時間の **30%**（暫定。% は今後調整可）
- [ ] **ドラッグで時間窓を横移動** — 当たり判定は **plot 全域**
- [ ] `layoutSkillMarkers` / hit 判定の `maxTime` を窓幅 `(timeEnd - timeStart)` に整合
- [ ] リセット（レース全体表示）操作
- [ ] 縦拡大 checkbox は **本 Phase では維持**（Phase 5-R3 で削除予定）
- [ ] 実機確認

### やらないこと

- ホイールによる Y/X 同時ズーム（→ [`REQ-race-detail-graph-pan-zoom.md`](REQ-race-detail-graph-pan-zoom.md)）
- 縦拡大 checkbox 削除
- ラベル X オフセット（ユーザー方針: ずらさない）
- WASM / OCR / src-tauri 変更

---

## 仕様（草案）

### 状態モデル

```typescript
viewState: {
  timeStart: number;  // 秒
  timeEnd: number;    // 秒。raceEnd 以下
}
```

### 「終盤へ」

- `timeEnd = raceEnd`
- `timeStart = raceEnd × (1 - 0.30)`（レース時間の最後 30%）
- detail ON（K=4.0）と併用可

### ドラッグ

- pointerdown → pointermove on plot 全域
- Δpx → Δtime（窓幅固定で `timeStart` / `timeEnd` をシフト、0〜raceEnd でクランプ）

### overlay X

- `startX = ((time - timeStart) / (timeEnd - timeStart)) * plotWidth + marginLeft`
- 窓外のスキルは非表示またはクリップ

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/components/RaceDetailChart.tsx` | viewState、domain、ドラッグ、終盤ボタン、overlay 同期 |
| `desktop-app/app/lib/raceGraphBuilder.ts` | 窓幅に応じた layout / hit 判定 |
| `docs/TODO.md` | ライフサイクル |

---

## 完了条件

- [ ] `docs/TODO.md` Backlog 起票済み
- [ ] 「終盤へ」で終盤 30% が表示され、X 被りが overview / R1 単体より改善
- [ ] ドラッグで時間窓を横移動できる（plot 全域）
- [ ] 折れ線・区間帯・phase 線・スキル overlay・Tooltip が窓と同期
- [ ] baseline compare 退行なし
- [ ] `npm run build` 通過
- [ ] ユーザー実機確認
- [ ] REQ `done` + コミット

---

## 検証手順

1. 50+ スキルレースで「終盤へ」→ 終盤区間が 30% 窓で表示
2. ドラッグで中盤〜終盤を追えること
3. スキル名の X 被りが R1 単体より減っていること
4. リセットでレース全体に戻ること
5. 縦拡大 ON/OFF、baseline compare、Tooltip

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-14 10:54 | draft 起票。窓幅 30%・ドラッグ plot 全域 | フル Google Map パンより実装軽量。X 被りの主因は秒あたり px 不足 |
| 2026-06-18 18:15 | R1b 完了後に着手。layout は visibleTimeSpan / timeOffset を渡す方針（Y は R1b yStackOffset を維持） | 設計レビュー合意 |
| 2026-06-18 21:01 | **superseded** → [`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md) | Google Map 型（等倍 XY + 2D パン）を最終ゴールに統合。X 単独窓は採用しない |
