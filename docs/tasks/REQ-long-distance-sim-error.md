# REQ-long-distance-sim-error: 長距離レース（中山3600m）エミュレートエラー

> 中山芝3600m など超長距離での連続シミュレーション失敗を、Worker 実エラー伝播と失敗走スキップ（本家 umasim RaceOperation 相当）で解消する。
> WASM（`race.js` / `.wasm`）フォークはしない。Step2a/2b は再導入しない。

- **ステータス**: done
- **作成日**: 2026-07-11 19:50
- **関連コミット**: `cdd8f4d`（着手 `03d491f`）

---

## 目的

育成途中個体 × 中山芝3600m × 連続試行（100〜1000回）でシミュレーションが落ち、ユーザーには意味不明な失敗（内部 `"null"`）しか見えない問題を直す。失敗走はスキップして続行し、成功分で集計。全滅時は日本語 ERROR のみ（結果タブなし）。

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

切り分け: トリガーはスタミナ不足×3600×消費大作戦。本家 Console 無ログは「同一例外の高頻度握りつぶし」の証明には使わない。

---

## スコープ

### やること

1. **Step 1 診断（維持）**: Worker 実エラーを `toSimulationError` 経由で伝播、`"null"`/空を長距離向け日本語へ、`console.timeEnd` を `finally` で必ず実行
2. **失敗走スキップ＋完走数表示**（本家 `RaceOperation` の `runCatching` 相当）:
   - Worker `SIMULATE` ループを走ごと try/catch。成功のみ results に push。失敗は `failedCount` 増＋`console.error`
   - Adapter は成功配列＋`failedCount` を受け取り、`SimResultDump` に `iterations`（指定回数のまま）・`completedCount`・`failedCount` を載せる
   - 集計は成功走のみ。rate / スパート率の分母は成功回数（`completedCount`）
   - `completedCount === 0` なら reject（ERROR トーストのみ・結果タブなし）
   - 成功 ≥1 なら従来どおり `raceDetail` 取得。失敗時は既存 `raceDetailFetchFailed` トースト
   - 比較検証（`SimTabPanel`）も同じスキップ方針（`runMultipleSimulations` 一本化）
   - UI: 完了トースト分岐＋ ResultCard に「完走 completedCount / iterations」最小表示
3. 各段階の結果を本 REQ 決定ログに記録
4. 実機検証（逃げ×3600m×100 / 追込×100 / 短中距離1000 退行なし / 全滅時 ERROR のみ）

### やらないこと

- stitch / オートキャプチャ結合
- `geminiOcr.ts` / `fuzzyMatcher.ts` / `capture.rs`
- Phase 2 FactorScroll・CapturePanel ヒント
- スキルデータ fetch フォールバック再設計
- 長距離以外の sim 性能改善・グラフ UI の大幅変更（完走数表示に必要な最小変更のみ）
- WASM（`race.js` / `.wasm`）フォーク改修
- ステータスの勝手な数値補正（スタミナ自動補正）
- Step2a/2b 再導入（毎走 `initializeEngine` / 超長距離での Worker 再生成）
- 本家 umasim 本体への PR 実装

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/public/umaemu/worker.js` | 走ごと try/catch・`failedCount`・PROGRESS は試行インデックス基準 |
| `desktop-app/app/lib/engine/umaemuAdapter.ts` | 成功分集計・完走数・全滅 reject・raceDetail は成功≥1 |
| `desktop-app/app/lib/types.ts` | `SimResultDump` に `completedCount` / `failedCount` |
| `desktop-app/app/lib/engine/simulationErrors.ts` | 全滅時 null 向け日本語維持・コメント更新 |
| `desktop-app/app/lib/engine/simulationErrors.test.ts` | 文言・正規化テスト |
| `SimulationLauncher.tsx` / `ResultCard.tsx` / `SimTabPanel.tsx` | 完走数トースト・最小表示 |

---

## 永続正本同期（エージェント必須）

| トリガー | 更新先 |
|----------|--------|
| 着手 | `TODO.md` 進行中、本 REQ `in-progress`、`INDEX.md` |
| 実装完了 | 本 REQ `done`、`TODO.md` 完了済み、`INDEX.md` |
| Phase / REQ 完了 | `CONCEPT-MAP.md`（新用語時のみ。今回は既存カードで足りれば 0 件可） |

---

## 完了条件

- [x] TODO 着手更新（Backlog→進行中）が最初のコミットに含まれる
- [x] Worker 実エラーが伝播し、`"null"` でもユーザー向け日本語になる（Step1 維持）
- [x] 1走例外でバッチ全体 ERROR にならない（成功≥1なら結果を返す）
- [x] UI に指定回数のうち完走数が分かる
- [x] 全滅時は Step1 の日本語 ERROR・結果タブなし
- [x] rate 分母は成功回数（`completedCount`）。`iterations` 意味は指定回数のまま
- [x] 比較検証も同じスキップ方針
- [x] 追込×100回・短中距離1000回の退行なし想定を満たす実装
- [x] 連続失敗後に Timer already exists が出ない（`console.timeEnd` finally 維持）
- [x] `npm test` 通過（62件）
- [x] REQ 決定ログに「部分成功集計しない」撤回が残る
- [x] REQ done・TODO 完了済み・コミット済み

---

## 検証手順

1. CHAT_TEMPLATE「検証コマンド（共通）」の desktop-app 単体テスト
2. 実機: 逃げ×中山3600×低スタミナ×100で完走数表示
3. 実機: 追込×100・短中距離×1000の退行なし
4. 実機: スタミナ3000×3600は失敗0
5. 実機: 全滅時は ERROR のみ・タブなし
6. 実機: 連続失敗後に DevTools で Timer already exists が出ないこと

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-07-11 19:50 | 起票・着手。失敗時は全滅＋日本語理由でよい（部分成功集計しない）。WASM フォークしない。対策順は a→b→c | 設計合意・再現ログ・ユーザー承認済み |
| 2026-07-11 19:54 | **Step 1 実装**: Adapter が Worker 実エラーを `toSimulationError` 経由で伝播。`"null"`/空→`SIMULATION_NULL_ERROR_MESSAGE`（超長距離向け日本語）。`console.timeEnd` を `finally` 化 | 再現ログで実メッセージが捨てられていた／連続失敗で Timer 警告 |
| 2026-07-11 19:54 | **Step 2a 実装**: `worker.js` で毎走前に `initializeEngine(skillData)`（SIMULATE_DETAIL も同様） | 連続 `runSimulation` の状態汚染仮説への第一対策 |
| 2026-07-11 19:54 | **Step 2b 実装**: コース距離 ≥3000m は **1走ごとに Worker を terminate→新規作成**。短中距離は従来どおり単一 Worker（2a のみ） | 2a だけでは WASM ヒープ汚染が残る可能性。再現条件（超長距離）に限定して速度影響を抑える |
| 2026-07-11 19:54 | **Step 2c 未実施**（実機で 2a+2b が不十分なときのみ）。部分成功集計・ステータス補正・WASM フォークは実装しない | 完了条件どおり。実機検証待ち |
| 2026-07-11 19:54 | `npm test` 60件 PASS | 単体テスト通過 |
| 2026-07-11 20:11 | **Step 2a/2b 撤去**: 実機で逃げ/先行/差し×3600m は依然 NG、追込 OK、中距離1000 OK。2a+2b は効果なし＋速度低下（特に2b）のため削除。Step1（実エラー伝播・日本語・Timer finally）は維持 | ユーザー実機検証フィードバック |
| 2026-07-18 21:18 | **v1.2.0 スコープ外・次回バージョン優先** — ユーザー承認。v1.2.0 リリースは stitch/UI 改善のみ。本 REQ は Backlog P0 で継続 | v1.2.0 リリース判断 |
| 2026-07-23 03:22 | **2026-07-11 19:50 の『部分成功集計しない』を撤回。** 本家 RaceOperation の失敗走スキップに合わせ、成功分で集計し完走数を UI 表示する。Step2a/2b は再導入しない。全滅時は ERROR のみ・結果タブなし。rate 分母は指定回数（iterations） | 設計レビュー承認（2026-07-11）・実装着手 |
| 2026-07-23 03:26 | **実装完了**: Worker 走ごと try/catch・Adapter 成功分集計＋全滅 reject・UI 完走数表示。`npm test` 62件 PASS。CONCEPT-MAP: 今回の用語追加なし（既存カードで十分） | 完了条件充足。実機確認はユーザー側 |
| 2026-07-23 03:32 | **rate 分母の訂正**: 指定回数（iterations）ではなく成功回数（completedCount）。Adapter の `rate` と ResultCard のスパート率のみ変更 | 指示誤り訂正。他箇所（完走数表示・トースト・全滅判定）は据え置き |
| 2026-07-23 03:50 | **完走 UI 移設（案 A′）**: RaceInfoLabel の〇走削除。完走表示はヘッダー右（ステータス条件左）へ。文言は『n/N走』、ツールチップは『シミュ完走〇走 失敗〇走』。失敗0控えめ・失敗あり琥珀。ResultCard スパート下の完走表示は削除 | スパート率との混同回避・設計レビュー承認 |
