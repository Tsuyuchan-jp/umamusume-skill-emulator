# REQ-stitch-terminal-exact-bottom: 最下部びったし到達時の二重結合

> 親文脈: [`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md) R3.5c-2（terminal 微探索 + NO_SCROLL skip）。
> 本 REQ は **既存ガードの穴**（最終ペアが「短シフト」と判定されないまま S* を採用する経路）を塞ぐ。

- **ステータス**: draft（設計レビュー中・コード未着手）
- **作成日**: 2026-07-11 17:31
- **関連コミット**: （完了後に記入）

---

## 目的

オートキャプチャでスキル一覧をスクロールし、**最下部が画面下端にちょうど収まる**タイミングでキャプチャが終わると、結合結果のスキル一覧最下部が **同じ数行だけ二重に続く**。OCR・目視ともに誤った長さになるため、末端ペアの無移動を確実に skip する。

---

## 再現条件（ユーザー報告・2026-07-11）

| 項目 | 内容 |
|------|------|
| 画面 | ウマ娘詳細・スキルタブ（長スキルリスト。例: オグリキャップ） |
| 条件 | ホイール段（-3/-4）による 1 ノッチ量が、リスト残量と **びったり一致** し、最下部がちょうど見える |
| 症状 | 結合画像で末尾スキル行（例: レースの真髄・速/体 → 賢/陽の加護 → 恩返し…）が **もう一度** 続く |
| 証拠 | 結合結果 PNG + 末尾付近フレーム（7〜9 枚目 / `frame_006`〜）。末尾近傍の 2 枚がほぼ同一の「最下部＋閉じる」 |

掃除キュー（タブ飛翔アニメ削除等）は **中断せずキューごと温存**。本バグを割り込み優先。

---

## 現状整理（コード根拠）

### データの流れ

```
Rust capture（ホイール → 差分で末端停止）
  → フレーム PNG 列
  → stitch: crop / scrollStart / shiftEstimate / compose
  → compose は overlaps[i]>0 のとき frame[i+1] の下端 scroll 行を append
```

### 既存の末端対策（R3.5c-2 拡張・クローズ済み）

[`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md)「R3.5c-2 拡張: terminal 微探索 + NO_SCROLL skip」:

1. 最終ペアで **coarse シフトが短い**（`< 0.85·S*`）と判定されたときだけ微探索
2. 微探索で ≈0 → `method=skip`・`overlap=0`（二重 append しない）
3. 正当な短シフト（例: TRN 119px）は維持

### 今回の穴（仮説・最有力）

びったし最下部のあと、もう 1 ノッチしてもリストは動かない（またはバウンド後に戻る）。その **無移動ペア** に対し:

1. スキル行が縦に周期的 → SSD（全重なり平均差分）が **S\* 付近に誤ピーク**を取りうる
2. coarse ≈ S\* のため `coarseIsTerminalShortScroll` が **false**
3. **微探索が走らず**、S\* のまま compose が末尾を再 append → 二重結合

既存修正は「coarse が短めの誤ピーク（例: 135 vs S\*=192）」を想定。今回は **誤ピーク自体が S\*** のためガードに入らない。

### キャプチャ側の補足

`capture.rs` は前後フレーム差分が閾値未満なら **そのフレームを push せず break**。ただしスクロールバー・バウンド・微小 UI 差で閾値を超えると、見た目ほぼ同一の最下部フレームが残る。防御は stitch 側が主、capture は任意の二次対策。

---

## スコープ

### やること

- 最終ペア（必要なら session 安定時）で **シフト 0（無移動）を coarse より先に評価**し、無移動なら `skip`（overlap=0）
- Vitest: 同一 strip / ほぼ同一 strip で coarse≈S\* でも skip になる合成ケース
- 既存 golden・TRN 正当 terminal（119px 等）・既存 NO_SCROLL 微探索の退行なし
- 実機: びったし最下部再現（長スキルリスト）で二重なし

### やらないこと

- wheel 段・scrollStart・layout / tabDetect の変更
- capture 停止閾値の本変更（二次案として記録のみ。承認時のみ最小触り可）
- golden PNG 差し替え（合成 Vitest で足りる想定。実機 NG 時のみ再検討）
- 掃除キューのタスク消化

---

## 設計レビュー（2026-07-11）

### 選択肢比較

| 案 | 内容 | メリット | デメリット | 適合度 |
|----|------|----------|------------|--------|
| **A. zero-shift 先判定（推奨）** | 最終ペア・session 安定時、`overlapAvgDiff(shift=0)` が閾値未満、または coarse より十分よければ **即 skip**。既存微探索は短シフト経路として維持 | 穴（coarse≈S\*）を直接塞ぐ。正当な最終スクロールは shift=0 の差分が大きく誤 skip しにくい | 閾値調整が必要。最終以外ペアは対象外（今回の症状は最終で足りる） | 高 |
| B. 最終ペアは常に微探索 | `coarseIsTerminalShortScroll` ガードを外し、常に [0, MICRO_MAX) を試す | 実装が単純に見える | coarse≈S\* かつ真値が 0 のとき、micro 範囲外の S\* を「採用」したまま残しうる。A の方が直接的 | 中 |
| C. capture のみ強化 | 差分閾値を厳しくし同一フレームを落とす | stitch を触らない | 微小差ですり抜け残る。根本の SSD 誤ピークは残る | 低（単独不可） |

### 推奨案

**案 A**。既存 R3.5c-2 微探索の **前段** に zero-shift ガードを足す（置き換えない）。

推奨アルゴリズム（最終ペア・`sessionStable` 時）:

1. `zeroDiff = overlapAvgDiff(prev, curr, 0, contentWidth)`
2. `zeroDiff ≤ ZERO_SHIFT_MAX`（新定数・初期案 2〜5 程度、実装時 Vitest で確定）→ `skip`
3. または `zeroDiff < coarseAvgDiff * WIN`（既存 MICRO_WIN 流用可）かつ zero が実質無移動 → `skip`
4. それ以外は現行どおり（短シフトなら微探索、正当 terminal / median 維持）

定数名案: `STITCH_SHIFT_TERMINAL_ZERO_DIFF_MAX`（要実装時確定）。

### 変更計画

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/lib/stitch/shiftEstimateCore.ts` | 最終ペア zero-shift 先判定 → skip |
| `desktop-app/app/lib/stitch/constants.ts` | zero-diff 閾値定数 1 件 |
| `desktop-app/app/lib/stitch/shiftEstimateCore.test.ts` | 同一/ほぼ同一 strip で coarse≈S\* → skip |
| 本 REQ / `TODO.md` / `INDEX.md` | 決定ログ・完了記録 |

触らない（原則）: `compose*`、`capture.rs`、`regionsCore`、`wheelCore`、OCR / UI。

### UI・UX

ユーザー向け文言変更なし（結合結果が正しくなるのみ）。

### リスク・未決事項

1. **ゼロ差分閾値**: バウンド残差で `zeroDiff` が数〜十数になりうるか → 実機ログで確認。必要なら「zeroDiff ≪ coarseAvgDiff」の相対条件を主にする
2. **最終以外の無移動ペア**: いまは最終のみ。中間で同一フレームが混入する報告が出たら拡張
3. **frame がメニュー等に遷移**: 添付の末尾近傍に別画面が混ざる場合は本バグと別件（シーン外れ）。本 REQ では「ほぼ同一の最下部」を主対象
4. **承認待ち**: コード修正はユーザー承認後

### 検証手順

1. `desktop-app` で `npm run stitch:golden`（退行なし）
2. `shiftEstimateCore` 関連 Vitest PASS（新規 skip ケース含む）
3. 実機: 長スキルリストで最下部がびったり見えるスクロール幅を狙い、結合末尾に同一スキル行の繰り返しが無いこと
4. 回帰: G-HOF-S / G-TRN / FRD 系で末端欠け・誤 skip が無いこと（既存実機クローズ相当の目視）

---

## 永続正本同期（エージェント必須）

| トリガー | 更新先 |
|----------|--------|
| 着手（本レビュー） | `TODO.md`（フォーカス・Backlog・進行中）、本 REQ、`INDEX.md` |
| 実装完了 | 本 REQ 決定ログ、`TODO.md` 完了済み |
| 実機 OK | 本 REQ・必要なら `SCENE-CATALOG.md` 該当メモ 1 行 |
| Phase / REQ 完了 | `CONCEPT-MAP.md`（新用語時のみ。zero-shift skip を追加済みなら追加更新不要） |

ドメイン: キャプチャ結合 → [`DOCS-GUIDE.md`](../DOCS-GUIDE.md) 同期表 capture 行。

---

## 完了条件

- [x] `docs/TODO.md` Backlog に起票と同時に1行追加（`draft` 起票時必須）
- [ ] 案 A 実装（ユーザー承認後）
- [ ] Vitest + `stitch:golden` 退行なし
- [ ] 実機: びったし最下部で二重結合なし
- [ ] REQ `done`・TODO 完了済み・INDEX 更新・コミット

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-07-11 17:31 | 掃除キューは温存し本バグを割り込み。docs + 設計レビューのみ先行。コードは承認後 | ユーザー指示 |
| 2026-07-11 17:31 | 原因仮説: 無移動最終ペアで SSD が S\* 誤ピーク → `coarseIsTerminalShortScroll` 不成立 → 微探索未実行 | R3.5c-2 拡張のガード条件と再現条件が一致 |
| 2026-07-11 17:31 | 推奨: 案 A（zero-shift 先判定 → skip）。案 B/C は非推奨または二次 | 穴を直接塞ぎ、正当 terminal を壊しにくい |
| 2026-07-11 17:31 | CONCEPT-MAP: `zero-shift skip` カード 1 件追加 | 会話で使う新ポリシー用語 |
