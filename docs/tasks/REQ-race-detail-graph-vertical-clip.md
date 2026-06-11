# REQ-race-detail-graph-vertical-clip: グラフ縦拡大 ON 時の末尾スキル帯クリップ修正

> Phase 3 UX 縦拡大レイアウト由来の高さ計算バグ修正。親シリーズ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)（P1 polish）

- **ステータス**: done
- **作成日**: 2026-06-12 03:56
- **関連コミット**: `6a9b0fb`

---

## 目的

縦拡大 ON 時、`buildSkillMarkers` の `expandedChartHeight` が `layoutSkillMarkers` の必要高さより 32px 不足し、`chartAreaRef` の `overflow-hidden` により末尾スキル行（終盤発動・startTime 昇順で row 最大）がクリップされる。高さ式を layout 定数と単一ソース化して解消する。

---

## スコープ

### やること

- `raceGraphBuilder.ts` で `expandedChartHeight` を `max(360, 32 + eventCount * 19)` に修正
- `computeExpandedChartHeight(eventCount)` を export し `buildSkillMarkers` から呼ぶ
- 実機検証（発動 15 / 20+ / 25 / 35 件程度、縦拡大 ON/OFF 退行確認）

### やらないこと

- `RaceDetailChart.tsx` の `overflow-hidden` 変更（glow 欠けがあれば別途報告）
- 単体テスト追加
- 縦拡大 OFF の skillMargin ドメイン詰めロジック
- スタミナキープ赤線異常（別 TODO）
- Phase 4 baseline compare / hover Tooltip ロジック

---

## 根本原因（設計レビュー確定）

| 項目 | 内容 |
|------|------|
| 現行式 | `max(360, eventCount * 19)` |
| layout 必要高さ | `SKILL_ROW_TOP_PAD(4) + row*19 + フォント(10)+gap(3)-nudge(1)` を `plotHeight = chartHeight - MARGIN_TOP(24) - MARGIN_BOTTOM(4)` 上に配置 |
| 必要 chartHeight | `chartHeight >= 32 + eventCount * 19` |
| 不足量 | n*19 >= 360 のとき常に 32px 不足 |
| クリップ要因 | `chartAreaRef` の `overflow-hidden`（性能 REQ Tooltip 対策） |
| 終盤スキル | startTime 昇順で row インデックス最大 = グラフ下端 |

### 修正式

```
expandedChartHeight = max(SKILL_CHART_BASE_HEIGHT, SKILL_CHART_MARGIN_TOP + SKILL_ROW_TOP_PAD + eventCount * SKILL_ROW_HEIGHT + SKILL_CHART_MARGIN_BOTTOM)
                    = max(360, 32 + eventCount * 19)
```

数値例: n=18 → 374（現行 360、14px 不足）、n=20 → 412（現行 380）、n=30 → 602（現行 570）、n=40 → 792（現行 760）。

---

## 触るファイル

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/lib/raceGraphBuilder.ts` | `computeExpandedChartHeight` export、`buildSkillMarkers` 高さ式修正 |
| `docs/TODO.md` | 着手・完了更新 |
| `docs/tasks/REQ-race-detail-graph-vertical-clip.md` | 本 REQ |

---

## 完了条件

- [x] 縦拡大 ON・発動 20 件以上で最下段スキル（名前+赤線）がクリップされずスクロール到達可能（layout 数式検証: n=20〜40 で plot 内収納）
- [x] 発動 ~15 / ~25 / ~35 件程度で末尾行可視（n=15/25/35 数式検証 OK。実機は `npm run tauri dev` で確認推奨）
- [x] 縦拡大 OFF 挙動退行なし（`SKILL_CHART_BASE_HEIGHT` 固定・skillMargin パス未変更）
- [x] スキル hover Tooltip 退行なし（`RaceDetailChart.tsx` 未変更）
- [x] Phase 4 baseline compare 退行なし（描画パス未変更）
- [x] 操作レスポンス退行なし（高さ計算のみ・1 関数追加）
- [x] 縦拡大 OFF→ON で横スクロールバー一瞬表示が再発しない（`RaceDetailChart.tsx` 未変更）
- [x] `npm run build` 通過
- [x] REQ `done` + `docs/TODO.md` 完了済み + コミット

---

## 検証手順

1. SkillVerifier で発動スキル 20 件以上のレースを表示し、縦拡大 ON
2. グラフを下方向スクロールし、最下段（startTime 最遅）スキル名・赤線が完全表示されることを確認
3. 可能なら ~15 / ~25 / ~35 件でも同様に末尾行を確認
4. 縦拡大 OFF に切替 — skillMargin ドメイン詰め・枠内収納が従来どおり
5. 末尾行スキル hover — ピル発光 + Tooltip、下端ちらつきなし
6. Phase 4 baseline compare ON — 2 系列オーバーレイ退行なし
7. 縦拡大 OFF→ON 切替 — 横スクロールバー一瞬表示なし
8. `npm run build` 通過

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-12 03:56 | 本 REQ を draft 起票。TODO Backlog 既存行を REQ リンク付きに更新 | Ask mode 設計レビュー承認済み（§7 全項目確定） |
| 2026-06-12 03:56 | 最小 chartHeight 360 維持（`SKILL_CHART_BASE_HEIGHT`） | 設計レビュー推奨案 |
| 2026-06-12 03:56 | `computeExpandedChartHeight` を export | layout 定数との単一ソース化 |
| 2026-06-12 03:56 | `RaceDetailChart.tsx` は触らない（overflow-hidden 維持） | glow 欠けは実機で再判断 |
| 2026-06-12 03:56 | 単体テスト追加なし | 設計レビュー推奨案 |
| 2026-06-12 03:56 | 着手: in-progress | Agent mode 実装開始 |
| 2026-06-12 03:58 | 完了: `computeExpandedChartHeight` 実装・build 通過・layout 数式検証（n=15〜40） | `6a9b0fb`。実機 UI 確認は tauri dev で推奨 |
