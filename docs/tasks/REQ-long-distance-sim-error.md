# REQ-long-distance-sim-error: 長距離レース（中山3600m）エミュレートエラー

> 中山芝3600m など超長距離での連続シミュレーション失敗を、Worker 実エラー伝播と WASM 連続実行対策で解消する。
> WASM（`race.js` / `.wasm`）フォークはしない。

- **ステータス**: in-progress
- **作成日**: 2026-07-11 19:50
- **関連コミット**: （完了後に記入）

---

## 目的

育成途中個体 × 中山芝3600m × 連続試行（100〜1000回）でシミュレーションが落ち、ユーザーには意味不明な失敗（内部 `"null"`）しか見えない問題を直す。失敗時は全滅でよいが、**理由が分かる日本語**を出す。

---

## 背景（再現メモ 2026-07-11）

| 項目 | 内容 |
|------|------|
| 個体 | スタミナ 1442 / スキル 33 |
| 条件 | 中山・芝3600m・良・9人 |
| 再現性 | 1回は大体通る / 2〜3回でほぼ落ちる / 100回は確実 / 1000回も即落ち |
| 対照 | 同個体・短中距離は 1000回 OK |
| 作戦 | 逃げ・先行・差しは同様に失敗 / **追込のみ 100回通った** |
| ログ | Worker simulation error = `"null"` / race.js Phase 0〜3 出力後に失敗 |
| その他 | スキルデータフォールバックトーストなし |

設計合意: 主因はスタミナ単独ではなく、**WASM エンジンの連続 `runSimulation` 時の状態汚染**（作戦×超長距離で顕在化）の可能性が高い。

---

## スコープ

### やること

1. **Step 1 診断**: Worker 実エラーを `toSimulationError` 経由で伝播、`"null"`/空を長距離向け日本語へ、`console.timeEnd` を `finally` で必ず実行
2. **Step 2 連続実行対策**（この順。WASM フォークはしない）:
   - **a.** 各 `runSimulation` の前後でエンジン再初期化（`initializeEngine(skillData)` を毎走 or 毎N走）
   - **b.** a で不十分なら走ごと or バッチごとに Worker を作り直す
   - **c.** b でも不十分なら外部依存（umasim 制限）として、超長距離×特定作戦時の試行回数上限＋明確な日本語案内
3. 各段階の結果を本 REQ 決定ログに記録
4. 実機検証（逃げ×3600m×100 / 追込×100 / 短中距離1000 退行なし）

### やらないこと

- stitch / オートキャプチャ結合
- `geminiOcr.ts` / `fuzzyMatcher.ts` / `capture.rs`
- Phase 2 FactorScroll・CapturePanel ヒント
- スキルデータ fetch フォールバック再設計
- 長距離以外の sim 性能改善・グラフ UI 変更
- WASM（`race.js` / `.wasm`）フォーク改修
- ステータスの勝手な数値補正
- 部分成功集計（失敗走をスキップして成功分だけ返す方式）

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/public/umaemu/worker.js` | 毎走 `initializeEngine`、エラー文字列の安全化 |
| `desktop-app/app/lib/engine/umaemuAdapter.ts` | 実エラー伝播・`timeEnd` finally・必要なら Worker 再生成 |
| `desktop-app/app/lib/engine/simulationErrors.ts` | `"null"`/空 → 長距離向け日本語 |
| `desktop-app/app/lib/engine/simulationErrors.test.ts` | 文言・正規化テスト |
| `SimulationLauncher.tsx` / `SimTabPanel.tsx` | 必要なら（文言表示経路） |

---

## 永続正本同期（エージェント必須）

| トリガー | 更新先 |
|----------|--------|
| 着手 | `TODO.md` 進行中、本 REQ `in-progress`、`INDEX.md` |
| Step 2 各段階 | 本 REQ 決定ログ |
| 実装完了 | 本 REQ `done`、`TODO.md` 完了済み、`INDEX.md` |
| Phase / REQ 完了 | `CONCEPT-MAP.md`（新用語時のみ。今回は既存カードで足りれば 0 件可） |

---

## 完了条件

- [ ] TODO 着手更新（保留→進行中）が最初のコミットに含まれる
- [ ] Worker 実エラーが伝播し、`"null"` でもユーザー向け日本語になる
- [ ] 連続実行対策 a→b→c の試行結果が決定ログに記録されている
- [ ] 再現個体・逃げ×中山3600m×100回が通る、または全滅時に明確な日本語理由（試行上限案内含む）
- [ ] 追込×100回・短中距離1000回の退行なし
- [ ] 連続失敗後に Timer already exists が出ない
- [ ] `npm test` 通過
- [ ] REQ done・TODO 完了済み・コミット済み

---

## 検証手順

1. CHAT_TEMPLATE「検証コマンド（共通）」の desktop-app 単体テスト
2. 実機: 育成途中 × 中山3600m（逃げ100回・追込100回）
3. 実機: 短中距離1000回の退行なし
4. 実機: 連続失敗後に DevTools で Timer already exists が出ないこと

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-07-11 19:50 | 起票・着手。失敗時は全滅＋日本語理由でよい（部分成功集計しない）。WASM フォークしない。対策順は a→b→c | 設計合意・再現ログ・ユーザー承認済み |
