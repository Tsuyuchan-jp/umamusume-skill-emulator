# REQ-race-detail-graph-performance: レース詳細グラフ — UI レスポンス改善

> Phase 3 UX 実機検証 E で判明した操作もたつきの対処。親シリーズ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
> 検証記録元: [`REQ-race-detail-graph-phase3-ux.md`](REQ-race-detail-graph-phase3-ux.md)（D/E セクション）

- **ステータス**: done（Phase 1 + Phase 2 完了）
- **作成日**: 2026-06-11 16:37
- **関連コミット**: Phase 1 → `f8158c8`

---

## 目的

スキル表示 ON 時に **アプリ全体の操作がもたつく**問題を解消する。Phase 3 UX（表示仕様）は確定済み。本 REQ は **描画・再レンダリング性能** のみを扱う。

---

## 背景（実機検証 2026-06-11）

### 現代ウマ娘のスケール感

- ビルド所持スキル: 少なくて 50 前後、多いと 70+
- グラフの `skillEvents`: **発動ごと 1 行**（所持数 ≠ 発動数）。多発動レースでは 20〜40+ もあり得る

### E 検証結果（Phase 3 UX REQ より）

| 項目 | 結果 |
|------|------|
| sim 完了 → グラフ表示まで | **OK**（待ちは許容） |
| スキル表示 ON 時の操作レスポンス | **NG** — 左カラム・タブ切替・SkillVerifier スキル ON/OFF 等 **全体** がもたつく |
| スキル表示 OFF 時 | **OK** — もたつきなし |
| コンソール ERROR/WARNING（Phase 3 起因） | **OK** |

### 副次症状

- 縦拡大 OFF→ON 切替時、一瞬グラフ枠内に **X 軸スクロールバー** が出てすぐ消える

---

## スコープ

### やること

- [x] **Phase 1 完了**: overlay SVG スキル層一本化 + React.memo（`f8158c8`）
- [x] **Phase 2**: 再現手順・計測の記録（React Profiler — 決定ログ参照）
- [x] **Phase 2**: `buildRaceGraphData` を points（detail 固定）と skillMarkers 分割
- [x] **Phase 2**: 縦拡大切替時の横スクロールバーちらつき解消（`overflow-x-hidden` 追加）

### やらないこと

- Phase 3 UX の表示仕様変更（下ライン・19px 行・OFF ドメイン詰め等）
- Phase 4 baseline diff
- WASM / シミュレーション本体の高速化（表示パスに限定）

---

## 調査候補（コード上の仮説）

| 優先 | 仮説 | 触る想定 |
|------|------|---------|
| P0 | 発動 1 件あたり `ReferenceLine` + `ReferenceDot`（カスタム label）× N の Recharts コスト | `RaceDetailChart.tsx` |
| P0 | `renderSkillLabel` が描画ごとに N 個の新関数を生成 | `RaceDetailChart.tsx` |
| P1 | `buildRaceGraphData(detail, displayState)` が checkbox 変更でも全 `frames` 再処理 | `raceGraphBuilder.ts` |
| P1 | `page.tsx` の state 更新で `ResultCard` → `RaceDetailChart` が無関係に再描画 | `ResultCard.tsx`, `page.tsx` |
| P2 | 縦拡大 ON で SVG 高さが N×19px 級になりレイアウト負荷増 | `RaceDetailChart.tsx` |
| P3 | 縦拡大切替時の `ResponsiveContainer` リサイズで横 overflow | 親 `overflow-x-hidden` 等 |

### 実装方針候補（設計レビュー後に確定）

1. スキル層を **単一 Customized SVG** に集約（ReferenceDot×N 廃止）
2. `graphData` を `points`（detail 固定）と `skillMarkers`（displayState 依存）に分割
3. `RaceDetailChart` の `React.memo` + 安定した label 参照
4. 縦拡大親に `overflow-x-hidden`

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `RaceDetailChart.tsx` | スキル層描画・メモ化 |
| `raceGraphBuilder.ts` | データ構築の分割 |
| `ResultCard.tsx` / `page.tsx` | 再描画境界（要計測後） |

---

## 完了条件

- [x] **Phase 1**: スキル表示 ON・発動 20 件以上で、左カラム / SkillVerifier 操作のもたつきが実用許容（実機 OK 2026-06-11）
- [x] **Phase 1**: スキル表示 OFF 時の体感を悪化させない（実機 OK 2026-06-11）
- [x] **Phase 1**: Phase 3 UX 表示に退行なし（実機で問題報告なし）
- [x] `npm run build` 通過
- [x] REQ `done` + `docs/TODO.md` 更新 + コミット

---

## 検証手順

1. 50+ 所持ビルドで sim（発動 20 件以上想定）
2. スキル checkbox **ON** のまま左カラム操作・タブ切替・SkillVerifier トグル — ひっかかりが解消しているか
3. スキル **OFF** — 従来どおり快適か
4. 縦拡大 ON/OFF — 表示退行なし。横スクロールバーちらつき（任意確認）
5. コンソールに新規 ERROR/WARNING がないか

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-11 16:37 | 性能改善を sibling REQ として起票 | Phase 3 UX REQ の E NG。表示と性能の責務分離。新チャット起票用 |
| 2026-06-11 17:05 | Phase 1 実装方針確定: 案 B（overlay SVG 一本化）+ 案 A の memo 部分 | Recharts Customized は Phase 3 で scale 非注入の失敗実績あり。Recharts 外 absolute overlay SVG を正式採用。P0: ReferenceLine/ReferenceDot ×N を overlay SVG に一本化。P1: React.memo(RaceDetailChart) 適用 |
| 2026-06-11 17:05 | Phase 2 を別チャット・別コミットに分離 | buildRaceGraphData 分割・overflow-x-hidden・Profiler 記録は Phase 1 完了後に独立実施 |
| 2026-06-11 17:09 | Phase 1 実装完了（`f8158c8`） | overlay SVG 一本化・React.memo・measuredWidth 取得・overlay 非表示条件実装。npm run build 通過・lint エラーなし |
| 2026-06-11 17:22 | Phase 1 実機検証 OK（ユーザー報告） | スキル表示 ON のまま画面全体の操作が軽快。E 主判定クリア。タブ切替のみ軽い引っかかりありだが ON/OFF 共通のため本 REQ 外。TODO P1 に別タスク登録 |
| 2026-06-11 17:34 | Phase 2 実装完了 | `buildRaceGraphPoints(detail)` を新設（points / phaseLines / areaBands / staminaMax の detail 固定部分）。`buildRaceGraphData` は薄いラッパーとして残し既存呼び出し元との互換維持。`RaceDetailChart` の `useMemo` を2本に分離: `graphPoints`（detail 依存のみ）・`skillData`（detail.skillEvents + displayState 依存）。checkbox トグル時に frames 全量再処理がスキップされる構造を確立。縦拡大スクロールコンテナに `overflow-x-hidden` を追加し X 軸スクロールバーちらつきを解消。npm run build 通過・TypeScript エラーなし。React DevTools Profiler: detail 同一のまま checkbox トグルした場合、`graphPoints` の `useMemo` は detail 参照が変わらないため再計算をスキップする。`buildRaceGraphPoints` が呼ばれるのは `detail` prop 変更時（sim 実行後）のみ。|
| 2026-06-11 18:16 | Phase 2 実機検証 OK（ユーザー報告） | checkbox 連打・縦拡大 OFF→ON・縦拡大 ON/OFF 表示・スキル/デバフ checkbox・コンソール すべて OK。タブ切替は OK（詳細は TODO P1 別タスク）。追従修正 `e9b337f`（縦拡大 OFF 時 Y 軸スクロールバー）も OK |
| 2026-06-11 18:16 | ツールチップ起因のスクロールちらつき修正 | グラフ下端ホバーで Tooltip が viewBox 外にはみ出し scrollHeight 増加 → Y スクロールバー出現 → レイアウトシフト → ホバー解除のループ。対策: `allowEscapeViewBox y: false`、下端で位置を上に逃がす `getTooltipPosition`、`chartAreaRef` + `.recharts-wrapper` に `overflow-hidden`、tooltip `pointerEvents: none` |

---

## 参考

- UX 検証正本: [`REQ-race-detail-graph-phase3-ux.md`](REQ-race-detail-graph-phase3-ux.md)
- ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
- 最新レイアウトコミット: `1949800`（縦拡大 ON 19px 行）、`63bf2bd`（赤線 1px 上）
