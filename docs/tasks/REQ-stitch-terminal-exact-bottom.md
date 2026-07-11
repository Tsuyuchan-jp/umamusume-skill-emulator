# REQ-stitch-terminal-exact-bottom: 最下部びったし到達時の二重結合

> 親文脈: [`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md) R3.5c-2（terminal 微探索 + NO_SCROLL skip）。
> 本 REQ は **既存ガードの穴**（最終ペアが「短シフト」と判定されないまま S* を採用する経路）を塞ぐ。

- **ステータス**: done（実装完了・実機はユーザー）
- **作成日**: 2026-07-11 17:31
- **関連コミット**: `24f624f`

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
| DevTools（2026-07-11） | 下記「実機ログ」 |

掃除キュー（タブ飛翔アニメ削除等）は **中断せずキューごと温存**。本バグを割り込み優先。

### 実機ログ（DevTools・再現時）

```
StitchLayout=L3, StitchTab=Skill, scrollStartY=397px(0.441), scrollRegion=369px
shiftEstimate: S*=192
Frame 0..5 → 次: scrollAmount≈192 method=ssd score≈0.97
Frame 6 -> 7: shift raw=300→final=192 method=ssd-refined score=0.971
Frame 7 -> 8: shift raw=60→final=167 method=ssd-refined score=0.925
```

数値の意味:

| 値 | 意味 |
|----|------|
| S\*=192 | セッション代表シフト（広帯 -4 相当） |
| 0.85·S\* ≈ 163.2 | terminal「短シフト」判定の上限 |
| Frame 7→8 raw=60 | 全範囲 SSD では短いずれを検出できている |
| final=167 | **S\* 近傍への refine** が raw を上書き。167 ≰ 163.2 のため terminal / 微探索に入らない |
| append 167px | ほぼ同一の最下部フレームから下端 167px を再結合 → 二重 |

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

### 今回の穴（ログで確定・2026-07-11 17:36 更新）

初回仮説「coarse がいきなり S\*」は **半分だけ正しい**。実ログでは:

1. 最終ペア Frame 7→8 の **raw=60**（短シフト候補として正しい方向）
2. セッションに外れ値（Frame 6→7 raw=300 等）があり `shouldRefineAroundAnchor` が true
3. refine が **[S\*-τ, S\*+τ] = [152, 232]** だけ再探索し、周期的スキル行で **167** を採用（`ssd-refined`）
4. terminal 判定は **refined 後の coarse（167）** を見る → `167 < 0.85·192` が **偽**（163.2 をわずかに超える）
5. 微探索も skip も走らず **167px append** → 二重結合

つまり穴の本体は「無移動なのに S\* を直採用」より、**短 raw を S\* 近傍 refine が潰して terminal ゲートをすり抜ける**こと。

### キャプチャ側の補足

`capture.rs` は前後フレーム差分が閾値未満なら **そのフレームを push せず break**。ただしスクロールバー・バウンド・微小 UI 差で閾値を超えると、見た目ほぼ同一の最下部フレームが残る。防御は stitch 側が主、capture は任意の二次対策。

---

## スコープ

### やること

- 最終ペアで **短 raw を S\* 近傍 refine から守る**（または terminal ゲートを raw 基準にする）→ 既存微探索 / NO_SCROLL skip に乗せる
- （任意・二次）zero-shift 先判定を安全網として追加するかは承認時に決定
- Vitest: raw 短・refine が S\* 近傍に引き上がる合成ケース → skip または短 terminal
- 既存 golden・TRN 正当 terminal（119px 等）・既存 NO_SCROLL 微探索の退行なし
- 実機: びったし最下部再現（長スキルリスト）で二重なし。ログで最終ペアが skip / terminal になること

### やらないこと

- wheel 段・scrollStart・layout / tabDetect の変更
- capture 停止閾値の本変更（二次案として記録のみ。承認時のみ最小触り可）
- golden PNG 差し替え（合成 Vitest で足りる想定。実機 NG 時のみ再検討）
- 掃除キューのタスク消化

---

## 設計レビュー（2026-07-11 / ログ反映で改訂）

### 選択肢比較

| 案 | 内容 | メリット | デメリット | 適合度 |
|----|------|----------|------------|--------|
| **A′. 最終ペアの短 raw を refine から除外（推奨）** | 最終ペアかつ `raw < 0.85·S*`（または anchor）のとき **refine しない**。既存 terminal / 微探索 / skip にそのまま乗せる | 本ログ（raw=60→167）を直接説明・修正。新閾値を増やしにくい | raw が誤って中〜長のときだけ別途必要 | **高** |
| A″. terminal ゲートを raw 基準に | 最終ペアの短判定を `min(raw, refined)` または raw で行う | refine 後でも微探索に入れる | refined=167 を coarse に残すと微探索の比較基準が歪む。A′の方がきれい | 高（A′と併用可） |
| A. zero-shift 先判定 | shift=0 の一致がよければ即 skip | refine 経路を問わない安全網 | 本ログの主因は refine。単独だと対症療法寄り | 中（**二次推奨**） |
| B. 最終ペアは常に微探索 | 短判定ガード撤廃 | 単純 | 範囲外の S\* 誤採用は残る | 低〜中 |
| C. capture のみ強化 | 同一フレームを落とす | stitch 非接触 | すり抜け残る | 低（単独不可） |

### 推奨案（ログ反映後）

**案 A′ を主修正。** 初回推奨の案 A（zero-shift）は **必須ではない二次安全網**（承認者が欲しければ追加）。

推奨アルゴリズム:

1. `refinedPairs` 生成時: **最終ペア**かつ `raw.scrollAmount > 0` かつ `raw.scrollAmount < terminalRatio * anchor` なら **refine せず raw を採用**
2. 既存どおり: session 安定 + 短 coarse → 微探索 → micro≈0 なら skip
3. （任意）その前に zero-shift 即 skip

本ログへの適用予想: Frame 7→8 は raw=60 のまま → `60 < 163` で terminal → 微探索で ≈0 → **skip** → 二重なし。

### 変更計画

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/lib/stitch/shiftEstimateCore.ts` | 最終ペア・短 raw 時は refine スキップ（案 A′）。任意で zero-shift |
| `desktop-app/app/lib/stitch/shiftEstimateCore.test.ts` | raw 短→refine 引き上がり再現 → skip/terminal 維持 |
| `constants.ts` | 新定数は原則不要（既存 `TERMINAL_RATIO` 流用）。zero-shift 採用時のみ追加 |
| 本 REQ / `TODO.md` | 決定ログ・完了記録 |

触らない（原則）: `compose*`、`capture.rs`、`regionsCore`、`wheelCore`、OCR / UI。

### UI・UX

ユーザー向け文言変更なし（結合結果が正しくなるのみ）。

### リスク・未決事項

1. **ユーザー確認待ち（方針変更）**: 初回案 A 単独承認は保留。案 A′ 主でよいか
2. **zero-shift を同時に入れるか**: 安全網として入れる / 入れない
3. **最終以外**: Frame 6→7 の raw=300→192 は中間の正当 refine。触らない
4. **raw が誤って ≥0.85·S\* の無移動**: 今回ログでは非該当。出たら案 A を追加

### 検証手順

1. `desktop-app` で `npm run stitch:golden`（退行なし）
2. `shiftEstimateCore` 関連 Vitest PASS（raw=短・refine 帯に周期ピークがある合成 → skip）
3. 実機: びったし最下部。期待ログ例: `Frame 7 -> 8: ... skip` または terminal 短／micro skip。二重なし
4. 回帰: G-HOF-S / G-TRN / FRD 末端

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
- [x] 案 A′ 実装（最終ペア短 raw の偽 refine 抑制）
- [x] Vitest + `stitch:golden` 退行なし
- [ ] 実機: びったし最下部で二重結合なし（**ユーザー実施**）
- [x] REQ `done`・TODO 完了済み・INDEX 更新・コミット

### 実機確認チェックリスト（ユーザー実施）

1. 長スキルリスト（例: オグリキャップ）でスキル一覧を最下部までスクロールし、下端にびったし収まるタイミングでオートキャプチャ
2. 結合画像の末尾スキル行が二重になっていないこと（目視 + OCR 長さ）
3. DevTools で最終ペアログを確認: `method=skip` または `method=terminal`（短シフト）。`ssd-refined` で S\* 近傍（例: 167px）append されていないこと
4. 回帰: G-HOF-S / G-TRN / FRD 末端で従来どおり結合できること

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-07-11 17:31 | 掃除キューは温存し本バグを割り込み。docs + 設計レビューのみ先行。コードは承認後 | ユーザー指示 |
| 2026-07-11 17:31 | 初回仮説: 無移動最終ペアで SSD が S\* 誤ピーク → terminal 不成立 | 画像症状からの推定 |
| 2026-07-11 17:31 | 初回推奨: 案 A（zero-shift）。**ログ後に改訂** | — |
| 2026-07-11 17:31 | CONCEPT-MAP: `zero-shift skip` カード 1 件追加 | 会話用語（二次案でも有効） |
| 2026-07-11 17:36 | DevTools: Frame7→8 raw=60→final=167 ssd-refined。S\*=192。167 が 0.85·S\* をわずかに超え terminal 未入 | ユーザー提供ログ |
| 2026-07-11 17:36 | **推奨を案 A′ に変更**（最終ペアの短 raw は refine しない）。案 A は二次。初回案 A 単独承認は保留しユーザー確認 | ログが refine 破壊を直接示す |
| 2026-07-11 18:04 | **案 A′ 実装完了**。最終ペア短 raw で (1) 閾値〜anchor 偽 refine 帯は raw 維持 (2) anchor〜anchor+τ の正当 refine は維持（FRD golden 退行回避）(3) その他短 raw は refine スキップ。Vitest 5/5・golden 29/29 PASS | FRD release 最終 raw=59→166 は正当 refine のため例外必要 |
| 2026-07-11 18:04 | CONCEPT-MAP: 追記 0 件（`zero-shift skip` 既存カードで十分） | Phase 完了時検討 |
