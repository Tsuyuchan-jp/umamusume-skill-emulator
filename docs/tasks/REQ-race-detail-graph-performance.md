# REQ-race-detail-graph-performance: レース詳細グラフ — UI レスポンス改善

> Phase 3 UX 実機検証 E で判明した操作もたつきの対処。親シリーズ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
> 検証記録元: [`REQ-race-detail-graph-phase3-ux.md`](REQ-race-detail-graph-phase3-ux.md)（D/E セクション）

- **ステータス**: draft
- **作成日**: 2026-06-11 16:37
- **関連コミット**: （完了後に記入）

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

- [ ] 再現手順・計測の記録（React Profiler 等）
- [ ] スキル表示 ON 時の不要な Recharts / 親ツリー再描画の削減
- [ ] 発動多数（20〜40+ イベント）でも checkbox・他 UI 操作が許容できる体感へ
- [ ] （任意）縦拡大切替時の横スクロールバーちらつき解消

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

- [ ] スキル表示 ON・発動 20 件以上で、左カラム / タブ / SkillVerifier 操作のもたつきが実用許容
- [ ] スキル表示 OFF 時の体感を悪化させない
- [ ] Phase 3 UX 表示（下ライン・左端揃え）に退行なし
- [ ] `npm run build` 通過
- [ ] REQ `done` + `docs/TODO.md` 更新 + コミット

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

---

## 参考

- UX 検証正本: [`REQ-race-detail-graph-phase3-ux.md`](REQ-race-detail-graph-phase3-ux.md)
- ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
- 最新レイアウトコミット: `1949800`（縦拡大 ON 19px 行）、`63bf2bd`（赤線 1px 上）
