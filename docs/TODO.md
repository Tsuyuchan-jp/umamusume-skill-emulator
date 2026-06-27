# Todo / 進捗管理

> **プロジェクト進捗の唯一の正本。** Backlog・進行中・完了・保留・既知の問題はすべてここを見る。
> Cursor 作業チャット起票時は `@docs/TODO.md` を **最初に** 参照する。
> **着手時と完了時の両方** で必ず更新し、コミットに含める（詳細は下記「更新ルール」「エージェント必須手順」）。

最終更新: 2026-06-28 03:34

---

## docs 入口

運用・永続正本・REQ の地図: `[DOCS-GUIDE.md](DOCS-GUIDE.md)`

---

## 現在のフォーカス

**P1** — **オートキャプチャ結合 R5**（`opencvStitcher.ts` 削除・次 Backlog）

---

## 進行中

（なし）

## 次にやること（Backlog）

優先度順。作業チャット起票時は **P0 から1件** 取る。

### P0 — v1.1.0 リリース

（完了 — 下記「完了済み」参照）

### P1 — 重要

- [ ] **オートキャプチャ結合リライト R5**（`opencvStitcher.ts` 削除）
  - 前提: **R4b 完了後**
  - REQ: `[REQ-stitch-rewrite.md](tasks/REQ-stitch-rewrite.md)` R5

- [ ] **REQ-skill-data-fetch-fallback 実機検証クローズ（手順 3〜7）**
  - 背景: 実装・docs 完了済み（`a5c04a0`）。**手順 1〜2 は OK**（オンライン sim・オフライン AppData フォールバック＋警告トースト）。**手順 3〜7 は未実施** — 後日実施
  - 手順: `[REQ-skill-data-fetch-fallback.md](tasks/REQ-skill-data-fetch-fallback.md)`「検証手順（改訂版）」3〜7（同梱フォールバック・fetch 全滅・Worker 文言区別・Launcher/SimTabPanel 回帰・raceDetail トースト）
  - 注意: 手順 3/4 前に **アプリ終了** + AppData `skill_data` 削除必須。同一セッション 2 回目 sim はメモリキャッシュ再利用
  - 完了時: REQ 完了条件の実機確認チェック、決定事項ログ、TODO 完了済み行に「実機検証クローズ」追記
  - 触る想定: docs のみ（不具合時のみ `umaemuAdapter.ts` 等）

- [ ] **OCR 解析の中止（停止）機能**
  - 症状: Gemini OCR がエラーを返さず不自然に長時間かかることがある。現状は `page.tsx` で `analyzeStitchedImage` を await するだけで、ユーザーが途中で止められない
  - 目標: 解析中に停止できる UI を追加し、中止後に再度 OCR を実行できるようにする
  - 触る想定: `geminiOcr.ts`（`AbortController` / fetch 中断）、`page.tsx`（解析中 state・停止ボタン・トースト）、必要なら `CapturePanel.tsx`
  - 注意: 停止後は「OCR解析中...」トーストの解除と `isAnalyzing` 相当 state のリセットが必要

- [ ] **Settings スキルデータ接続チェック UI**（任意）
  - 背景: `[REQ-skill-data-fetch-fallback.md](tasks/REQ-skill-data-fetch-fallback.md)` Phase 3 見送り。フォールバックトーストで代替済み
  - 目標: 「スキルデータ取得テスト」ボタン → 成功/失敗/使用ソースを日本語表示
  - 触る想定: `SettingsPanel.tsx`, `umaemuAdapter.ts`

- [ ] **Worker 大量試行時の断続失敗対策**（調査・別タスク）
  - 背景: ユーザーレポートで 1,000 回 sim の途中失敗など fetch 単独では説明しきれないパターンあり（`[REQ-skill-data-fetch-fallback.md](tasks/REQ-skill-data-fetch-fallback.md)` スコープ外）
  - 目標: OOM / チャンク化等の恒久対策を検討
  - 触る想定: `umaemuAdapter.ts`, `worker.js`（要調査）

（Phase 5 完了。上記ほか P1 候補は Backlog 追加時にここへ）

### P2 — 改善・アイデア

- [x] **FRD アクティブタブ誤検出（StitchTab）— 4b / 6 実機 NG 要因**（コード修正済み・**Step 6 実機再 OK 待ち**）
  - 症状 A（4b register）: **スキルタブ選択中**なのに `detectStitchTabFromRgba`→**TrainingInfo**。`stitch.ts` 上書きで結合は OK
  - 症状 B（6 継承・G-FRD-F）: **継承タブ選択中**も同警告→`StitchTab=Skill`。**継承履歴緑バー以下が未カット**（`cropAtInheritanceHistoryBar` は `tab===Inheritance` のみ）
  - 対応: `tabDetectCore` partner 配線・register 帯下端より下の再走査・緑比率スコア・右端弱優勢再判定。`stitch.ts` は partner 渡し（継承は検出側で維持）
  - golden: `G-FRD-S-register` tab=Skill・`G-FRD-F` tab=Inheritance assert 追加（25/25 PASS）
  - 関連: `[REQ-stitch-scene-model.md](tasks/REQ-stitch-scene-model.md)` INV-2 拡張

- [ ] **オートキャプチャ結合画像のディスク非保存オプション**
  - 現状: オートキャプチャ完了後 `useCapture` が OpenCV で結合し、`saveFolder` 指定時は Rust `save_stitched_image`、未指定時はブラウザダウンロードへ保存。Rust 側 `capture.rs` もフレーム PNG を一時ディレクトリに書き込み
  - 目標: 設定で「結合画像を PC ディスクに保存しない」を選べるようにする（OCR 用のメモリ上 `resultImage` / dataUrl は維持）
  - 触る想定: `SettingsPanel.tsx`, `useCapture.ts`, `page.tsx`（localStorage 設定）、必要なら `stitch.rs` / `capture.rs`（一時フレームの扱い・削除タイミング）
  - 注意: 保存先フォルダ設定との関係（非保存 ON 時は saveFolder を無視等）を UI で明示。実機検証必須

- [ ] **エラートーストの全文表示**（truncate 解除）
  - 症状: `ToastNotification` の message に `truncate` があり、長文が途中で切れる（実機: スキルデータフォールバック警告が「最新版…」までしか見えない）
  - 目標: `type: error` のトーストは全文が読めるようにする（折り返し・複数行。`max-w` は維持可）
  - 触る想定: `ToastNotification.tsx`（success は1行 truncate 維持でも可）
  - 経緯: `[REQ-skill-data-fetch-fallback.md](tasks/REQ-skill-data-fetch-fallback.md)` 実機検証手順 2

- [ ] **keep-alive タブのメモリ/描画負荷軽減**（将来 Fix）
  - 現状: sim 済みタブは unmount せず Recharts 等がタブ数分残る。1〜3 タブ運用では問題になりにくい
  - 目標: 非アクティブタブのグラフ/Recharts をアンマウントまたは lazy 化（5 タブ以上を想定した場合）
  - 触る想定: `page.tsx` keep-alive 構造、`RaceDetailChart.tsx`
  - v1.1.0 スコープ外（`[REQ-release-v1.1.0.md](tasks/REQ-release-v1.1.0.md)` 決定ログ参照）

- [ ] **Google Map 型グラフ — 操作中 overlay 中間レベル**（赤線のみ表示。ラベル・layout・getBBox は defer 維持）
  - 前提: 現状は最小レベル（操作中 overlay 全非表示）でパフォーマンス優先
  - 目標: パン/ズーム中も発動区間の赤線だけ見せる（`skillMarkersToPx` のみ、layout キャッシュ再利用検討）
  - 関連: `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)`

- [ ] **Google Map 型グラフ — 操作中 overlay 理想レベル**（赤線 + ラベル表示）
  - 前提: 中間レベル実装後・実機計測で許容できる場合のみ
  - 注意: `layoutSkillMarkers` + SVG DOM + getBBox が毎フレーム戻り、レスポンス改善分が相殺されやすい
  - 関連: `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)`

- [ ] **スキルパレットの並び順をレアリティ段階別に変更**
  - 現状: `buildPaletteSkillOptions` は `umasimSkillDataList` の出現順（extract 順）
  - 目標: 可能なら **❖緑（inherit）→ ★赤（evo）→ ✦金（rare）+ 白（normal）混合** の3段階でグループ化して表示
  - 触る想定: `umasimSkillData.ts`（`buildPaletteSkillOptions` の sort）、必要なら `SkillCommandPalette.tsx`
  - 注意: `onlyUnique` パレットは unique のみのため別扱い。各段階内の名前順は要検討
  - 関連: `[REQ-palette-local-skill-data.md](tasks/REQ-palette-local-skill-data.md)`

- [ ] **タブ追加時のサムネイル飛翔アニメーション削除**
  - 経緯: 旧レイアウトでは右カラム上部タブが見えないことがあり、タブ追加をユーザーに認知させるための対処だった
  - 現状: ダッシュボード形式で上部タブが常に見えるため不要
  - 目標: `flyingThumbnail` / `flyToTab` アニメーションと関連 state・タイマーを削除
  - 触る想定: `page.tsx`, `SimTabPanel.tsx`
  - 関連: 全画面 Cockpit UI（`[REQ-fullscreen-cockpit-layout.md](tasks/REQ-fullscreen-cockpit-layout.md)`）

- [ ] **グラフ デバフ帯（B-3）の実機検証**
  - 現状: `minus` 系はパレット/OCR 経路で sim に載らず、紫線・デバフ checkbox の検証不可
  - 目標: SkillVerifier で minus を手動追加する等、検証用データで `kind: debuff` の skillEvents を確認
  - 触る想定: 検証手順のみ（必要なら `SkillVerifier` / パレット方針は別判断）
  - 関連: `[REQ-race-detail-graph-phase3.md](tasks/REQ-race-detail-graph-phase3.md)` B-3

- [ ] **「実行時のステータス条件」ボタンをテキスト付き表記に変更**
  - 現状: `SimulationStatusView` が Activity アイコンのみ（スペース不足時の暫定 UI）
  - 目標: Cockpit UI 整備で余白が確保されたため、「実行時のステータス条件」等のラベル付きボタンに変更
  - 触る想定: `SimulationStatusView.tsx`, 必要なら `page.tsx` のツールバー行

- [ ] **ゲームアップデート後のスキルデータ更新**
  - 手順: `UPDATE_SKILLS.md`
  - コマンド: `npm run extract-umasim-skills`（必須）、`npm run extract-skill-info`（mdb あり時）

- [ ] **OCR 用 Gemini モデルを Flash-Lite のみに変更**
  - 現状: `geminiOcr.ts` で `gemini-3.5-flash` を primary、`gemini-3.1-flash-lite` を fallback として試行
  - 目標: `gemini-3.5-flash` を外し、最初から `gemini-3.1-flash-lite` のみ使用
  - 触る想定: `app/lib/geminiOcr.ts`、必要なら `page.tsx`（OCR 完了トーストのモデル表示）

- [ ] **StatusPanel のスキル表示に色分けを追加**（任意）
  - 現状: スキル名のみ（`getSkillNameById`）
  - 低優先: SkillPanel / Verifier で足りるなら見送り可

- [ ] **skill_data.txt 参照の一本化（案B）— 自前 GitHub fetch**
  - 背景: P1 後も WASM=mee1080/umasim 実行時 fetch、UI=同梱 `umasimSkillData.ts` と更新経路が分かれる。参照正本を1本にすると保守・不整合防止に有利
  - 目標: 開発者が `extract-umasim-skills` 等で生成した `skill_data.txt` を **自前リポジトリ** に置き、アプリはそこから fetch（WASM 初期化 + パレット/OCR 用一覧の共通正本）。extract→push のみで **アプリ再配布なし** に近づける（オンライン時）
  - 想定: `umaemuAdapter.fetchSkillData` の URL を自前 raw に変更、パレット/OCR も同一 JSON から派生（または runtime キャッシュ共有）。オフライン用に同梱フォールバック要検討
  - 触る想定: `umaemuAdapter.ts`, `umasimSkillData.ts`, `UPDATE_SKILLS.md`, extract/publish 手順（CI 化も可）
  - **今回やらない**: P1 完了後・余裕ができたら着手。`race.js`/WASM 本体更新・`skillRarityData.ts`（mdb）は別経路のまま

---

## 完了済み

- [x] **G-FRD-I golden 登録** — expectations 8件目・Vitest 29/29 PASS・Catalog 同期（2026-06-28 03:34 / コミット待ち）/ [`REQ-stitch-rewrite.md`](tasks/REQ-stitch-rewrite.md) R4b
- [x] **オートキャプチャ結合リライト R4b**（TrainingInfo S-6 配線）— golden 25/25 PASS。**実機クローズ**: G-FRD-I（`StitchTab=TrainingInfo`）+ 退行ゲート全 OK（2026-06-28 03:16 / `b8963da`）/ [`REQ-stitch-rewrite.md`](tasks/REQ-stitch-rewrite.md) R4b
- [x] **オートキャプチャ結合リライト R4a**（postProcess 分離・compose 純化）— golden 25/25 + postProcess Vitest 2件 PASS。**実機クローズ**: Step 1 G-HOF-S・3 G-TRN・4a/4b G-FRD-S・5 G-HOF-F・6 G-FRD-F（S-5）退行なし（2026-06-28 00:47 / `0b549f5`）/ [`REQ-stitch-rewrite.md`](tasks/REQ-stitch-rewrite.md) R4a
- [x] **G-HOF-S 末端 terminal 微探索 + NO_SCROLL skip** — 最終ペア [0,40) 微探索・terminal 経路 skip/terminal 採用。Vitest 4件 + golden 25/25。**実機クローズ**: G-HOF-S 長リスト（Frame 8→9 raw=82→final=28 terminal）・G-TRN・G-FRD-S-release/register 退行なし（2026-06-28 00:11 / `d914c3b`）/ [`REQ-stitch-rewrite.md`](tasks/REQ-stitch-rewrite.md) R3.5c-2 拡張
- [x] **オートキャプチャ・スクロール用カーソル位置** — Y: 帯上端 + max(56px, 62%帯高)（`1ac4742`）。X: crop 中心（`cropCore` 同系・`2b272bd`。幾何中心 `a3b8fcd` は実機 NG で差し替え）。golden 25/25。**実機クローズ**: G-FRD-S-register/release・G-HOF-S・G-TRN・Y/X とも OK（2026-06-27 23:21 / `2b272bd`）/ [`REQ-stitch-rewrite.md`](tasks/REQ-stitch-rewrite.md)
- [x] **Scene Model M6c** — R3.5d-5 実機検証クローズ（4a/4b/1/3/6 全 OK・StitchTab 修正後 Step 6 再 OK）（2026-06-27 21:54 / `ef7beda`）/ [`REQ-stitch-scene-model.md`](tasks/REQ-stitch-scene-model.md)
- [x] **オートキャプチャ結合 R3.5d 実機検証クローズ**（d-5: FRD Step 4/6・HOF/TRN 退行なし）（2026-06-27 21:54 / `ef7beda`）/ [`REQ-stitch-rewrite.md`](tasks/REQ-stitch-rewrite.md)
- [x] **Scene Model M6b** — INV-1: scrollStart ガード・G-FRD-S-register scrollStart assert・golden 23/23（2026-06-27 18:56 / `dccf6b3`）/ [`REQ-stitch-scene-model.md`](tasks/REQ-stitch-scene-model.md) — アーモンドアイ golden は PNG 待ち
- [x] **Scene Model M6a** — INV-2: partner register 幾何帯除外・centerDominant 検出・layoutCore partnerTabRow 正本化・golden 22/22（2026-06-27 17:35 / `556a503`）/ [`REQ-stitch-scene-model.md`](tasks/REQ-stitch-scene-model.md)
- [x] **Scene Model M5** — wheelCore・capture_frame0_preview IPC・Rust 緑タブ走査廃止・reason=stitch_*（2026-06-27 08:11 / `ba18bc3`）/ [`REQ-stitch-scene-model.md`](tasks/REQ-stitch-scene-model.md)
- [x] **Scene Model M4** — partnerDetectCore・緑判定 rgba 正本化・tabDetect INV-2 配線・capture.rs 閾値同期（2026-06-27 08:01 / `40bcbca`）/ [`REQ-stitch-scene-model.md`](tasks/REQ-stitch-scene-model.md)
- [x] **Scene Model M3** — expectations sceneSpec 必須・Vitest 駆動・INV-1 メタ（FRD タイト帯）（2026-06-27 07:14 / `cf2a6a0`）/ [`REQ-stitch-scene-model.md`](tasks/REQ-stitch-scene-model.md)
- [x] **CHAT_TEMPLATE 起票ルール** — ネストフェンス禁止・検証コマンド共通化（2026-06-27 07:03 / `1e11a78`）
- [x] **CONCEPT-MAP 種別列** — 英語先頭・種別列追加・隣の概念削除（2026-06-27 06:52 / `db7969f`）
- [x] **CONCEPT-MAP 新設** — 概念地図・`communication.mdc` / `concept-map.mdc`・CHAT_TEMPLATE・DOCS-GUIDE 同期（2026-06-27 06:40 / `18f43f0`）
- [x] **Scene Model M2** — expectations `sceneSpec`（partnerBand/tabRow/scrollStart/wheel）・Catalog 期待サマリー・REQ INV 対応表・measure-regions R0 notes（2026-06-27 06:13 / `028221f`）/ [`REQ-stitch-scene-model.md`](tasks/REQ-stitch-scene-model.md)
- [x] **Scene Model M1 Phase C** — G-FRD-S-register golden（frame_000〜007）・expectations・Vitest・Catalog、golden 19+1 expected fail（2026-06-27 05:57 / `5d4f9a6`）/ `[REQ-stitch-scene-model.md](tasks/REQ-stitch-scene-model.md)`
- [x] **Scene Model M1 Phase B** — `G-FRD-S` → `G-FRD-S-release`、`golden/FRD/skill/` → `skill-release/`、expectations・Vitest・Catalog 同期、golden 18/18 PASS（2026-06-27 05:30 / `a84d51f`）/ `[REQ-stitch-scene-model.md](tasks/REQ-stitch-scene-model.md)`
- [x] **Scene Model Catalog Phase A** — SCENE-CATALOG に goldenPath・expectations 列・対応表、欠落表吸収、NG サブケース整理、PACK-GUIDE 同期（2026-06-27 05:25 / `fa91f07`）/ `[REQ-stitch-scene-model.md](tasks/REQ-stitch-scene-model.md)` M1 Phase A
- [x] **design-pack 整理** — logs/screenshots 削除・Vitest 参照 PNG を golden/ へ統合・PACK-GUIDE 2層化（2026-06-27 05:12 / `23cac9f`）
- [x] **design-pack P0** — PACK-GUIDE 新設・README 案内板化・DOCS-GUIDE リンク（2026-06-27 04:48 / `11a6879`）/ `[PACK-GUIDE.md](../auto-capture-design-pack/PACK-GUIDE.md)`
- [x] **オートキャプチャ結合 R3.5d 実装**（d-2〜d-4: frame0 帯推定・狭帯 -3 / 広帯 -4・FRD golden）— golden 18/18 PASS（2026-06-27 02:41 / `139c14e`）/ `[REQ-stitch-rewrite.md](tasks/REQ-stitch-rewrite.md)` — **d-5 実機はユーザー確認待ち**
- [x] **オートキャプチャ結合 R3.5c**（c-2〜c-5 一部 + 実機 HOF-S/TRN/HOF-F）— terminal・狭帯ガード・golden 18/18（2026-06-27 02:04 / `23ebab7`）/ `[REQ-stitch-rewrite.md](tasks/REQ-stitch-rewrite.md)`
- [x] **オートキャプチャ結合リライト R3.5b**（layout L2 優先・tabDetect 2タブガード）— golden 17/17 PASS（2026-06-27 00:02 / `5d98121`）/ `[REQ-stitch-rewrite.md](tasks/REQ-stitch-rewrite.md)`
- [x] **オートキャプチャ結合リライト R3.5a**（shiftEstimate: SSD + median・scrollMatch 委譲）— golden 15/15 PASS（2026-06-26 23:12 / `76b3fc7`）/ `[REQ-stitch-rewrite.md](tasks/REQ-stitch-rewrite.md)`
- [x] **オートキャプチャ結合リライト R3**（compose / scrollMatch・`USE_STITCH_V2=true`）— golden 12/12 PASS（2026-06-26 19:41 / `7fbf8b5`）。**実機**: HOF OK・FRD/TRN NG → R3.5 へ / `[REQ-stitch-rewrite.md](tasks/REQ-stitch-rewrite.md)`
- [x] **オートキャプチャ結合リライト R2**（layout / tabDetect 整理・走査帯正本化）— G-CMP-S + G-FRD-S layout/tabRow PASS、G-FRD-S scrollStart 要フォロー（2026-06-26 18:07 / `47d5755`）/ `[REQ-stitch-rewrite.md](tasks/REQ-stitch-rewrite.md)`
- [x] **オートキャプチャ結合リライト R1**（scrollStartY absdiff 正本・`USE_STITCH_V2`）— G-TRN/G-HOF-S golden PASS（2026-06-26 08:41 / `1df1860`）/ `[REQ-stitch-rewrite.md](tasks/REQ-stitch-rewrite.md)`
- [x] **オートキャプチャ結合リライト R0（golden ハーネス）** — expectations.json・measure-regions.ps1・Vitest 5件 PASS・設計パック 6 golden PASS（2026-06-26 08:13 / `851d341`）/ `[REQ-stitch-rewrite.md](tasks/REQ-stitch-rewrite.md)`
- [x] **オートキャプチャ G-TRN 実機検証** — Phase 1（-5 旧 `0887fcd`）+ **v2/-4 実機 OK**（R3.5c `23ebab7`）/ `[REQ-auto-capture-multi-screen.md](tasks/REQ-auto-capture-multi-screen.md)`
- [x] **オートキャプチャ Phase 1（結合修正 S-1〜S-5）** — StitchLayout/StitchTab・absdiff フォールバック・継承緑帯修正。`capture.rs` 未変更（2026-06-26 06:12 / `700d0b3`）/ `[REQ-auto-capture-multi-screen.md](tasks/REQ-auto-capture-multi-screen.md)` Phase 1 **done**
- [x] **スキルデータ fetch フォールバック + シミュレーションエラー区別** — GitHub→AppData→同梱チェーン、`SkillDataFetchError`/`SimulationWorkerError` 区別、フォールバックトースト（2026-06-23 03:36 / `a5c04a0`）/ `[REQ-skill-data-fetch-fallback.md](tasks/REQ-skill-data-fetch-fallback.md)` **done**（実機検証: 手順 1〜2 OK、**3〜7 は Backlog 延期** 2026-06-25）
- [x] **REQ 索引 INDEX.md 新設とロードマップ同期** — 全28件カタログ・`REQ-race-detail-graph.md` Phase 5 同期・`PROJECT.md` / rules 更新（2026-06-20 00:41 / `5d9dc0c`）
- [x] **v1.1.0 リリース（Phase R1 + R2.5 + R3）** — バージョン 1.1.0 bump・CHANGELOG・`tauri build` 通過（2026-06-19 23:51 / `5650bb7`）/ `[REQ-release-v1.1.0.md](tasks/REQ-release-v1.1.0.md)` **done**
- [x] **v1.1.0 リリース — Phase R2.5: スキルデータ extract** — umasim 2021件同期・新規4エントリ（フローラ固有/継承・evo×2）・extract スクリプトにヘルパー保持（2026-06-19 23:36 / `8293001`）
- [x] **v1.1.0 リリース — Phase R1: バグ Fix（R-001 / R-006 / R-008）** — シミュ失敗トースト正規化・raceDetail 失敗通知・simulationCount NaN ガード（`simulationErrors.ts` 新設）（2026-06-19 23:26 / `c12e628`）
- [x] **左カラム設定項目の折りたたみ** — 3項目を1トグルで折りたたみ、自動コピーはヘッダー常時表示、localStorage `settingsPanelExpanded`（**実機検証クローズ** 2026-06-19 20:45 / `05fd9a6`）
- [x] **サイドバー折りたたみ時アイコンフラッシュ修正** — invisible+transition 廃止、条件レンダリング+装飾なしゴースト行（2026-06-19 20:02 / `36cbc07`）
- [x] **サイドバー折りたたみ rail 展開ボタン Y 揃え（再修正）** — 共通ヘッダー化 + 折りたたみ時 invisible 行で行高維持・absolute 中央配置（2026-06-19 19:56 / `ccbcf73`）
- [x] **サイドバー折りたたみ rail 展開ボタン Y 揃え** — 展開時ヘッダーと同じ `pt-4` + `h-10` 行に配置（2026-06-19 19:51 / `ab93563`）
- [x] **サイドバー UI ポリッシュ（実機指摘）** — 最小幅タイトル1行 truncate + 折りたたみ rail アイコン除去（スペーサーで展開ボタン Y 維持）（2026-06-19 19:45 / `6bb53b9`）
- [x] **サイドバー折りたたみボタンをスクロール位置に依存させない** — 展開時を固定ヘッダー + スクロールボディ（案 B）（2026-06-19 19:33 / `74aebc6`）
- [x] **Google Map 型グラフ — ホイール停止後 overlay 復帰 latency 短縮** — 合成 metrics 即時 handoff（A）+ adaptive idle（B）（**実機検証クローズ** 2026-06-19 / `ed67df3` / `[REQ-race-detail-graph-overlay-handoff-latency.md](tasks/REQ-race-detail-graph-overlay-handoff-latency.md)` **done**）
- [x] ホイール 1 ノッチ拡大率調整 — `CHART_VIEW_WHEEL_ZOOM_FACTOR` 1.2→1.3（**実機検証クローズ** 2026-06-19 19:19 / `7e6af0d` / `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)`）
- [x] **Google Map 型グラフ UI Phase 5 完了** — ステップ 3 暫定 UI 削除 + ステップ 4 全体実機検証クローズ（検証手順 1〜7 すべて OK / `249c4b2` / `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)` **done**）
- [x] Google Map 型グラフ UI Phase 5 — **ステップ 3 暫定 UI 削除**（`expandSkillRows` / K=4 legacy 経路除去・map-view 単一路線・操作ヒント追加）（`ee6d460` / `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)`）
- [x] ホイール 1 ノッチ拡大率調整 — `CHART_VIEW_WHEEL_ZOOM_FACTOR` 1.1→1.2（**実機検証クローズ** 2026-06-19 18:18 / `bec0d2a` / `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)`）
- [x] **連続ホイールズームの途中 commit 除去** — `MAP_INTERACTION_WHEEL_IDLE_MS` 150→300ms（案 A。**実機検証クローズ** 2026-06-19 18:12 / `8227f93`〜`1902c42` / `[REQ-race-detail-graph-wheel-continuous-zoom.md](tasks/REQ-race-detail-graph-wheel-continuous-zoom.md)`）
- [x] Google Map 型グラフ — Interaction Canvas Engine **Phase 1〜4**（Dual-Viewport・handoff 200ms SLA。**実機検証クローズ** 2026-06-19 / `9042aa9` / `96e40d5` / `[REQ-race-detail-graph-interaction-engine.md](tasks/REQ-race-detail-graph-interaction-engine.md)`）
- [x] Google Map 型グラフ — Interaction Canvas Engine **Phase 4 設計レビュー**（案 A 維持 + probe 多フレーム rAF + dev 計測・200ms SLA 定義）（2026-06-19 17:36 / `[REQ-race-detail-graph-interaction-engine.md](tasks/REQ-race-detail-graph-interaction-engine.md)`）
- [x] ホイールズーム中心を可視窓 center（画面中心拡大）に変更 — **採用・実機検証クローズ** 2026-06-19（`6ac05a9` / `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)`）
- [x] 非操作時もスキル発動点小丸を常時表示（半径 2.5px・overlay SVG + Canvas）（`c6db25c` / `d22db24` / Phase 3 拡張）
- [x] グラフパン時の Y 軸目盛りテキスト選択による再ドラッグ不能 — select-none + pointerdown preventDefault（`9a3b8ca` / Phase 3 実機指摘）
- [x] Google Map 型グラフ — Interaction Canvas Engine **Phase 3**（Canvas rAF 配線・発動点小丸・Line strokeOpacity defer）（**実機検証クローズ** 2026-06-19 / `8ab7c60` / `[REQ-race-detail-graph-interaction-engine.md](tasks/REQ-race-detail-graph-interaction-engine.md)`）
- [x] Google Map 型グラフ — Interaction Canvas Engine **Phase 2**（liveViewRef 分離・deferDomainCommit・buildInteractionPlotMetrics）（**実機検証クローズ・軽量** 2026-06-19 16:13 / `8767b1a` / `[REQ-race-detail-graph-interaction-engine.md](tasks/REQ-race-detail-graph-interaction-engine.md)`）
- [x] Google Map 型グラフ — Interaction Canvas Engine **Phase 1**（chartLineRenderer.ts・getSpeedAtTime export・座標検証）（`5693968` / `[REQ-race-detail-graph-interaction-engine.md](tasks/REQ-race-detail-graph-interaction-engine.md)`）
- [x] Google Map 型グラフ — domain 更新 30fps cap（perf fallback）（**実機検証クローズ** 2026-06-19 01:12 / `5053012`〜`cba1f4c` / `[REQ-race-detail-graph-map-view-perf-fallback.md](tasks/REQ-race-detail-graph-map-view-perf-fallback.md)`）
- [x] Google Map 型グラフ — overlay scales 同期 + ズーム操作一連（レスポンス・復帰ずれ・scales probe）（**実機検証クローズ** 2026-06-19 00:46 / `98c0cea`〜`a1dd542` / `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)`）
- [x] Google Map 型グラフ — overlay 復帰位置ずれ修正（metrics 同期ゲート + 操作終了時 pending flush）（`a9125c7` / `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)`）
- [x] Google Map 型グラフ — ズーム操作のレスポンス改善（rAF バッチ・metrics リセット削減・操作中 overlay defer）（`98c0cea` / `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)`）
- [x] Google Map 型グラフ — percent 軸追従修正（ホイール・縦パンで centerPercent 連動）（**実機検証クローズ** 2026-06-18 23:30 / `f8a62f0` / `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)`）
- [x] Google Map 型グラフ UI — ステップ 2（ChartViewState 配線・ホイール等倍ズーム・2D パン・ダブルクリックリセット）（`91e76cb` / `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)`）
- [x] Google Map 型グラフ UI — map-view ステップ 1（ChartPlotMetrics + cartesian 実測 + 俯瞰統合 layout）（`aca5f6f` / `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)`）
- [x] Phase 5-R1b ポリッシュ: XAxis reserve + overlay domain を speedPlotHeight に統一（`a8744ef` / 実機確認待ち）
- [x] Phase 5-R1b ポリッシュ: speedPlotHeight に Legend 分を反映（`ba4e172` — XAxis 未考慮で stack 16px 低下）
- [x] Phase 5-R1b ポリッシュ: contentPlotHeight 修正 + nudge リセット（`2e52a26` — Legend 未考慮で過補正）
- [x] Phase 5-R1b ポリッシュ: stack 0 赤線の半px整列 + 速度線 nudge（`b94777d` — **plot 高さ修正で置換**）
- [x] Phase 5-R1b ポリッシュ: 赤線アンカー分離 + 同時刻のみスタック（`7af3b0c` — **案1は撤回**）
- [x] Phase 5-R1b ポリッシュ: ラベル↔赤線隙間 + 速度線 linear 補間統一（`cce0314` / 5-R1b 実機指摘）
- [x] Phase 5-R1b: 詳細表示レイアウト（赤線アンカー + 同時刻スタック圧縮）— yStackOffset 二段階・赤線速度線アンカー・ラベル上配置（**実機検証待ち** / `782dabe` / `[REQ-race-detail-graph-same-time-stack-compact.md](tasks/REQ-race-detail-graph-same-time-stack-compact.md)`）— 赤線／ラベル一体・K=4.0 固定・案3 維持（**実機検証クローズ** 2026-06-14 11:04 / `dd414ea` / `[REQ-race-detail-graph-analysis-revert.md](tasks/REQ-race-detail-graph-analysis-revert.md)`）
- [x] detail 分析モード刷新 — 案3 + K 下限 3.0 + 赤線分離（**赤線分離 NG・R1 で revert 予定** / `a83d5df` / `[REQ-race-detail-graph-skill-layout-sync.md](tasks/REQ-race-detail-graph-skill-layout-sync.md)`）
- [x] xStaggerOnly 衝突条件修正（案A）— baseY 近接判定除去、Y zoom 探索 dead code 解消（**superseded** / `0545e9f` / `[REQ-race-detail-graph-skill-layout-sync.md](tasks/REQ-race-detail-graph-skill-layout-sync.md)`）
- [x] overview stack 0 優先（案1）— OFF 時 Y stagger なし・速度スナップ維持・被り許容（**実機検証待ち** / `3806581` / `[REQ-race-detail-graph-skill-layout-sync.md](tasks/REQ-race-detail-graph-skill-layout-sync.md)`）
- [x] detail ラベル px 固定（A案）— font/hit box/オフセット固定、yZoom は plot+stagger のみ（**実機検証待ち** / `af78fe8` / `[REQ-race-detail-graph-skill-layout-sync.md](tasks/REQ-race-detail-graph-skill-layout-sync.md)`）
- [x] detail Y zoom 反復収束 + X-only stagger — 2D 被りゼロまで K 探索・detail 時 X 重なり stagger（**実機検証待ち** / `12af1e1` / `[REQ-race-detail-graph-skill-layout-sync.md](tasks/REQ-race-detail-graph-skill-layout-sync.md)`）
- [x] 縦拡大 = Y クローズアップ（密集度自動 zoom）— 速度追従+相関維持・detail 縦スクロール（**superseded by 反復 zoom** / `b7f3838` / `[REQ-race-detail-graph-skill-layout-sync.md](tasks/REQ-race-detail-graph-skill-layout-sync.md)`）
- [x] 縦拡大 ON 時 Y 軸圧縮（360px 固定）修正 — viewport 高さ LineChart + 下スキル band（**superseded** / `e1ef3f2`）
- [x] 縦拡大 ON 時の Y 軸縮小・スキル重なり修正 — 速度 plot 固定 + スキル band 分離 + X+Y stagger（**実機検証待ち** / `cff8573` / `[REQ-race-detail-graph-skill-layout-sync.md](tasks/REQ-race-detail-graph-skill-layout-sync.md)`）
- [x] スキル帯×速度折れ線連動レイアウト — 速度スナップ + 0.4秒ビンストラグger（案A）（**実機検証待ち** / `6816447` / `[REQ-race-detail-graph-skill-layout-sync.md](tasks/REQ-race-detail-graph-skill-layout-sync.md)`）
- [x] パレットのスキルデータ参照をローカルに統一 — `buildPaletteSkillOptions` + inherit 優先 dedupe + SkillPanel warm-up 削除（**実機検証クローズ** / `f564898` / `[REQ-palette-local-skill-data.md](tasks/REQ-palette-local-skill-data.md)`）
- [x] タブ切り替え時の引っかかり改善 — keep-alive + visibility 重ね + TabBar UI 刷新（**実機検証クローズ** / `224d67a`〜`132d56a` / `[REQ-tab-switch-performance.md](tasks/REQ-tab-switch-performance.md)`）
- [x] スタミナキープ持続線異常 — WASM endTime センチネル + 条件付き水平線描画（**実機検証クローズ** / `8b02849` / `[REQ-race-detail-graph-stamina-keep-line.md](tasks/REQ-race-detail-graph-stamina-keep-line.md)`）
- [x] グラフ縦拡大 ON 時の末尾スキル帯クリップ — `computeExpandedChartHeight` 式修正（`6a9b0fb` / `[REQ-race-detail-graph-vertical-clip.md](tasks/REQ-race-detail-graph-vertical-clip.md)`）
- [x] グラフスキル hover UI ポリッシュ — カーソル default + hover ピル発光（`67b3707` / `[REQ-race-detail-graph-skill-tooltip.md](tasks/REQ-race-detail-graph-skill-tooltip.md)`）
- [x] グラフ内スキル hover Tooltip — 効果量・持続時間・発動位置％（本家 GraphSkill.description 準拠）（`a5e5e7d` / `2c73c81` / `[REQ-race-detail-graph-skill-tooltip.md](tasks/REQ-race-detail-graph-skill-tooltip.md)`）
- [x] 直近レース詳細グラフ Phase 4 — baseline グラフ diff（2系列オーバーレイ・**実機検証クローズ** A〜F OK）（`e780b3d` / `a4752cf` / `[REQ-race-detail-graph-phase4.md](tasks/REQ-race-detail-graph-phase4.md)`）
- [x] レース詳細グラフ UI レスポンス改善 Phase 1+2 — overlay SVG・useMemo 分割・スクロールバー/Tooltip 追従修正・**実機検証クローズ**（`f8158c8` / `2c8e1ed` / `e9b337f` / `873080e` / `[REQ-race-detail-graph-performance.md](tasks/REQ-race-detail-graph-performance.md)`）
- [x] Phase 3 UX スキル行 B案 — 下ライン・28px 行高・zinc ピル・縦拡大一貫レイアウト（`447d25e` / `[REQ-race-detail-graph-phase3-ux.md](tasks/REQ-race-detail-graph-phase3-ux.md)`）
- [x] 直近レース詳細グラフ Phase 3 UX ポリッシュ — ラベル TopLeft・ダーク scrollbar・フォーカス白線除去・Legend 同期（`7a91cb7` / `[REQ-race-detail-graph-phase3-ux.md](tasks/REQ-race-detail-graph-phase3-ux.md)`）
- [x] TODO.md 運用ルール整備 — 進行中ライフサイクル・エージェント必須手順を TODO / rules / CHAT_TEMPLATE / PROJECT に追記（`bf52d7a`）
- [x] 直近レース詳細グラフ Phase 3 — スキル帯・表示切替（WASM skillEvents + checkbox + 本家準拠ラベル/赤線）（`f8e8cbe`〜修正コミット / `[REQ-race-detail-graph-phase3.md](tasks/REQ-race-detail-graph-phase3.md)`）
- [x] 直近レース詳細グラフ Phase 2 — 区間オーバーレイ + trackDetail WASM + UX改善（色弱対策・坂上下段・右Y軸体力0）（`5e2b401` / `[REQ-race-detail-graph-phase2.md](tasks/REQ-race-detail-graph-phase2.md)`）
- [x] レース詳細グラフ Y軸・単位改善 — 双 Y 軸・体力/レーン床リマップ・速度 m/s（`206b9ee` / `[REQ-race-detail-graph-axis.md](tasks/REQ-race-detail-graph-axis.md)`）
- [x] 全画面 Cockpit UI（Phase 1〜3 + UX ポリッシュ）— SkillVerifier 右ペイン・トースト Portal・KPI ストリップ等（`98c8739`〜`a75ec9c` / `[REQ-fullscreen-cockpit-layout.md](tasks/REQ-fullscreen-cockpit-layout.md)`）
- [x] サイドバー狭幅 UI 整備（Phase S1+S2）— 行レイアウト修正・二重カード解消・padding 圧縮（`d8ddb66` / `[REQ-sidebar-compact-layout.md](tasks/REQ-sidebar-compact-layout.md)`）
- [x] 全画面 Cockpit UI Phase 2 — KPI ストリップ + グラフ常時表示 + 実機検証済み（`6b8b13b` / `c9412ee`）
- [x] 全画面 Cockpit UI Phase 1 — サイドバー折りたたみ + 右カラム全幅化 + min-w-0 縮退（`98c8739`）
- [x] 直近レース詳細グラフ（Phase 1 MVP）— `runSimulationDetail` WASM + recharts 折りたたみ UI（`2abda5a` / `[REQ-race-detail-graph-phase1.md](tasks/REQ-race-detail-graph-phase1.md)`）
- [x] Gemini API キーのセキュアストレージ化（Windows Credential Manager + localStorage 移行）（`fa7c5b3`）
- [x] スキル UI 最終実機確認（パレット先頭 inherit・special/minus 除外・色分け一致）
- [x] パレットから `special` / `minus` スキルを除外（`570a1f2`）
- [x] スキルアイコンの不要な末尾スペースを削除（`2d20a50`）
- [x] スキル5色表示（ID ベース）+ 通常固有ガード（`8e6ff01` 付近）
- [x] パレット先頭15件が白表示になる原因調査（`special`/`minus` が色分け対象外だった）
- [x] SkillVerifier の色分け表示（`getSkillRarityInfoById` 適用済み・コード確認）
- [x] Cursor 運用ドキュメント整備（`945d18f`）

---

## 保留 / ブロック中

- [ ] **R3.5d パートナー登録緑ボタン除外**（`6de25ad`）— **実機再検証待ち**（tauri dev 再起動 or release exe 後）
  - Scene Model M4/M6 と統合修正予定。暫定パッチの追加は `[REQ-stitch-scene-model.md](tasks/REQ-stitch-scene-model.md)` パッチ禁止リストに従う

---

## 既知の問題・メモ

- パレットのスキル一覧は `**umasimSkillDataList`（ローカル）正本** — `buildPaletteSkillOptions`。WASM sim は `fetchSkillData()`（GitHub 優先 → AppData → 同梱 `public/skill_data.txt`）
- **オートキャプチャ Capture–Stitch 契約**: **広帯 -4 / 狭帯 -3**（`scrollRegionH` しきい値 280px）。**M5**: wheel は stitch（TS）正本・Rust IPC 受信。正本: `[REQ-stitch-rewrite.md](tasks/REQ-stitch-rewrite.md)`「Capture–Stitch 契約」
- **Scene Model ロードマップ**: `[REQ-stitch-scene-model.md](tasks/REQ-stitch-scene-model.md)` 起票（M0 done）。Catalog: `[SCENE-CATALOG.md](../auto-capture-design-pack/SCENE-CATALOG.md)`。素材運用: `[PACK-GUIDE.md](../auto-capture-design-pack/PACK-GUIDE.md)`
- **stitch `layoutOpenCv.ts`**: 旧 `layout.ts` は Next.js 16 の `app/` 予約名衝突でリネーム（`0fac03e`）。正本は `layoutCore.ts`。ビルド失敗時は `[RELEASE_BUILD.md](RELEASE_BUILD.md)` トラブルシュート
- **FRD StitchTab 誤検出**: **解消**（`4c6029e` 修正・M6c Step 6 実機 OK: `StitchTab=Inheritance`・継承履歴緑ライン Y=2778）
- **オートキャプチャ結合 R3.5d**: **d-5 実機クローズ**（4a/4b/1/3/6 全 OK・HOF/TRN 退行なし）
- **オートキャプチャ結合 R3.5b 完了**: layout L2 優先 + tabDetect 2タブガード。golden 17/17
- **オートキャプチャ結合 R3.5 設計正本**: shiftEstimate（SSD + median）。詳細: `[REQ-stitch-rewrite.md](tasks/REQ-stitch-rewrite.md)` R3.5 節
- **sim スキルデータ**: オンライン時 GitHub fetch + AppData キャッシュ。オフライン時は同梱/キャッシュで制限付き動作（フォールバック時トースト）
- **REQ-skill-data-fetch-fallback 実機検証**: 手順 1〜2 確認済み。手順 3〜7（同梱のみ・fetch 全滅・Worker 区別・回帰）は P1 Backlog — 後日クローズ予定（2026-06-25）
- **将来（案B・Backlog）**: `skill_data.txt` を自前 GitHub に置き fetch 一本化 → extract→push でユーザー再配布を減らす方針。sim 定義と UI 一覧を同一 JSON に揃える
- **新スキル時の現状**: 同梱 `umasimSkillData.ts` 利用箇所（P1 後のパレット/OCR）は **extract + アプリ再配布** が必要。WASM のみ mee1080/umasim fetch なら sim 定義はオンラインで追従しうるが、パレット/OCR は同梱更新まで新スキル非対応
- `special`（14件）+ `minus`（1件）が `unique` 直後に並んでいたため、除外前は先頭がすべて白表示だった
- Gemini API キーは Windows 資格情報マネージャー（`com.umamusume.race-analyzer` / `gemini_api_key`）に保存
- サイドバー狭幅 UI（380px / min 320px）は Phase S1+S2 で完了（`[REQ-sidebar-compact-layout.md](tasks/REQ-sidebar-compact-layout.md)`）。S3 コンテナクエリは見送り。**設定折りたたみ**（3項目1トグル・`settingsPanelExpanded`・hydration 対策済み）は **実機検証クローズ**（2026-06-19 / `05fd9a6`）
- 全画面 Cockpit UI（Phase 1〜3）は完了（`[REQ-fullscreen-cockpit-layout.md](tasks/REQ-fullscreen-cockpit-layout.md)`）
- グラフ Y軸・m/s は `[REQ-race-detail-graph-axis.md](tasks/REQ-race-detail-graph-axis.md)` で対応済み
- 直近レース詳細グラフ: ロードマップ `[REQ-race-detail-graph.md](tasks/REQ-race-detail-graph.md)`。**Phase 5 実装正本**は `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)`（Google Map 型・等倍 XY + 2D パン）。旧 R2/R3 は superseded
- 現代ウマ娘: 所持 50〜70+ スキル。グラフ `skillEvents` は発動イベント数（20〜40+ あり得る）
- **別作業で発見（2026-06-11）**: サイドバー折りたたみボタンのスクロール追従、ステータス条件ボタンのテキスト化、グラフ/スキル表記以降のレスポンス低下 — いずれも Backlog 登録済み
- **REQ 運用**: 着手候補の正本は **本 TODO**。全 REQ カタログは `[docs/tasks/INDEX.md](tasks/INDEX.md)`。`draft` REQ 起票時は Backlog へ必ず1行追加（`.cursor/rules/docs-management.mdc`）
- **連続ホイール・overlay 復帰**: **実機検証クローズ**（2026-06-19）。handoff + adaptive idle（`ed67df3`）+ ホイール 1.3（`7e6af0d`）で停止後 latency・2 ノッチ目ひっかかりともに改善。詳細: `[REQ-race-detail-graph-overlay-handoff-latency.md](tasks/REQ-race-detail-graph-overlay-handoff-latency.md)`
- **v1.1.0 リリース**: 作業正本 `[REQ-release-v1.1.0.md](tasks/REQ-release-v1.1.0.md)` — **2026-06-19 完了（R1/R2.5/R3）**
- **配布**: インストーラーではなく `desktop-app/src-tauri/target/release/app.exe` を直接配布。リリース時は `[RELEASE_BUILD.md](RELEASE_BUILD.md)` の `npm run build:release-exe` を必須（2026-06-19 手順整備）
- 因子管理 DB・Tesseract OCR・Supabase 連携は **開発予定なし**（`.cursor/rules/development.mdc`）

---

## セクションの役割


| セクション          | 役割                          | いつ更新するか               |
| -------------- | --------------------------- | --------------------- |
| **現在のフォーカス**   | プロジェクト全体で今優先しているテーマ（1行）     | 着手時・方針変更時             |
| **進行中**        | **いまコード/設定を変更している作業**（最大1件） | **着手時**（必須）           |
| **Backlog**    | 未着手タスク（優先度付き）               | 新タスク追加・着手時に行を移動       |
| **完了済み**       | 完了タスク（コミットハッシュ付き）           | **完了時**（必須）           |
| **保留 / ブロック中** | 外部待ち・判断待ちで止まっている作業          | ブロック発生/解消時            |
| **既知の問題・メモ**   | バグメモ・調査結果・運用メモ（タスク化前の情報）    | 発見時。タスク化したら Backlog へ |


---

## 更新ルール

### ライフサイクル（Backlog 項目）

1. **着手時（必須）**: Backlog から該当行を **「進行中」へ移す**（同時に載せるのは1件）。「現在のフォーカス」を合わせて更新。`最終更新:` を書き換える
2. **完了時（必須）**: 「進行中」から **「完了済み」へ移す**（コミットハッシュを添える）。Backlog に残っていれば削除。REQ があれば `done` に更新
3. **中断・ブロック時**: 「進行中」→「保留 / ブロック中」へ移し、理由を1行追記

### その他

1. 新タスク発生時: 優先度を決めて Backlog に追加（Backlog 外の作業も同様）
2. 大きめの機能は `docs/tasks/REQ-*.md` を作成してリンクする
3. **日時記録**: 更新・ログのタイムスタンプは `YYYY-MM-DD HH:mm`（ローカル時刻）。詳細は `.cursor/rules/docs-management.mdc`
4. TODO を触ったら、先頭の `最終更新:` を **その作業の日時** に書き換える
5. **REQ を `draft` / `in-progress` で起票したら、同一コミット内で Backlog に必ず1行追加する**（REQ だけに書いて TODO を空にしない）
6. REQ が `done` になったら Backlog から削除し「完了済み」へ移す（REQ ファイル自体は残す）
7. REQ 20件超: `docs/tasks/INDEX.md` を新設して一覧管理（`.cursor/rules/docs-management.mdc` 参照）

### 着手の定義

次の **いずれかが最初に起きた時点** で「着手」とみなし、**最初のコミットに TODO 更新を含める**（遅くともコード変更と同じコミット内）。

- ワークスペースのコード・設定を変更する
- `docs/tasks/REQ-*.md` を `in-progress` にする
- ユーザー指示で「このタスクを進める」と明示された（調査のみの Ask mode を除く）

### Backlog 外・小さな作業


| 種別                       | 進行中       | Backlog              |
| ------------------------ | --------- | -------------------- |
| 数行の修正・バグ1件               | 載せる（1行で可） | 不要                   |
| メモ・Backlog 追記のみ          | 不要        | 追記のみ                 |
| 複数コミット/複数セッション見込み        | 載せる       | 先に Backlog へ追加してから着手 |
| 設計レビュー（Ask mode・コード変更なし） | 不要        | 不要（フォーカス更新のみ可）       |


### 複数チャット並行時

- **進行中は常に最大1件**。別チャットで新タスクに着手する前に、既存の進行中を **完了** または **保留** へ移す
- 別チャットが作業中なのに「進行中: なし」は **運用エラー**。起票側チャットが着手時更新を省略した可能性が高い
- ユーザーが「別チャットで作業中」と伝えた場合、TODO を読んで進行中が空なら **Backlog と会話内容から推定して進行中を埋める**（推測でフォーカスだけ変えない）

---

## エージェント必須手順

> `.cursor/rules/docs-management.mdc` と `docs/CHAT_TEMPLATE.md` からも参照される。

### 作業開始時（コード変更あり）

1. `@docs/TODO.md` を読む
2. 対象タスクが Backlog に無ければ追加（優先度付き）
3. 既存の「進行中」があれば完了/保留処理してから、対象を **進行中へ移す**（1件）
4. 「現在のフォーカス」を更新
5. `最終更新:` を `Get-Date -Format "yyyy-MM-dd HH:mm"` で取得した時刻に更新
6. 上記を **最初のコミット** に含める（コード変更と分離しない）

### 作業完了時

1. 「進行中」→「完了済み」（コミットハッシュ）
2. REQ があれば `done` + 決定ログ
3. `最終更新:` を更新
4. 完了報告の **前に** コミットする

