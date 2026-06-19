# Todo / 進捗管理

> **プロジェクト進捗の唯一の正本。** Backlog・進行中・完了・保留・既知の問題はすべてここを見る。
> Cursor 作業チャット起票時は `@docs/TODO.md` を **最初に** 参照する。
> **着手時と完了時の両方** で必ず更新し、コミットに含める（詳細は下記「更新ルール」「エージェント必須手順」）。

最終更新: 2026-06-19 18:45

---

## 現在のフォーカス

**グラフ本線（P1）**: Google Map 型 Phase 5 **完了** — 次は P0 トースト改善 or P2 overlay 復帰 latency

**おすすめの進め方**:
1. **P0** — シミュレーション失敗トースト（小タスク・グラフと独立）
2. **P2** — ホイール停止後 overlay 復帰 latency 短縮（合成 metrics 即時 handoff）
3. **P2（任意）** — 操作中 overlay 中間レベル（赤線のみ）

---

## 進行中

（なし）

## 次にやること（Backlog）

優先度順。作業チャット起票時は **P0 から1件** 取る。

### P0 — 次に着手

- [ ] **シミュレーション失敗トーストの文言改善（`null` 非表示・再試行案内）**
  - 経緯: WASM Worker 異常終了時に `シミュレーションエラー: null` がユーザー向けトーストに表示された。フルリロードで復旧した事例あり
  - 現状: `SimulationLauncher.tsx` が `e.message` をそのまま表示。`umaemuAdapter.ts` が Worker の `error: null` / `"null"` を `new Error(error)` で渡す
  - 目標: 無意味なメッセージ（`null`・空・`Worker terminated` 等）は **日本語の案内文** に置換。「もう一度実行」「解消しない場合は再読み込み」を含める
  - 実装方針（2段）:
    1. `umaemuAdapter.ts` — reject 時に `toSimulationError()` で正規化（内部コード `SIMULATION_ENGINE_UNAVAILABLE` 等）
    2. `SimulationLauncher.tsx` — `formatSimulationErrorMessage()` でトースト文言確定。`console.error` は詳細ログ用に維持
  - 文案例: 「シミュレーションを完了できませんでした。一時的な不具合の可能性があります。もう一度実行してみてください。繰り返す場合はアプリの再読み込みをお試しください。」
  - 触る想定: `umaemuAdapter.ts`, `SimulationLauncher.tsx`
  - REQ: 不要（数行〜小タスク）

### P1 — 重要

（Phase 5 完了。次の P1 候補は Backlog 追加時にここへ）

### P2 — 改善・アイデア

- [ ] **Google Map 型グラフ — ホイール停止後 overlay 復帰 latency 短縮**
  - 現状: `MAP_INTERACTION_WHEEL_IDLE_MS=300` 待機 + Recharts metrics probe（最大 ~200ms）で停止〜スキル overlay 表示まで長い
  - 目標: 連続ホイールの途中 commit なしは維持しつつ、**停止後の overlay 表示を ~100ms 台**へ
  - 推奨: 合成 metrics 即時 handoff（`buildInteractionPlotMetrics` + 凍結 cartesian）+ adaptive idle（単発 notch は短 settle）
  - 触る想定: `useChartViewInteraction.ts`, `RaceDetailChart.tsx`
  - 関連: [`REQ-race-detail-graph-map-view.md`](tasks/REQ-race-detail-graph-map-view.md)

- [ ] **Google Map 型グラフ — 操作中 overlay 中間レベル**（赤線のみ表示。ラベル・layout・getBBox は defer 維持）
  - 前提: 現状は最小レベル（操作中 overlay 全非表示）でパフォーマンス優先
  - 目標: パン/ズーム中も発動区間の赤線だけ見せる（`skillMarkersToPx` のみ、layout キャッシュ再利用検討）
  - 関連: [`REQ-race-detail-graph-map-view.md`](tasks/REQ-race-detail-graph-map-view.md)

- [ ] **Google Map 型グラフ — 操作中 overlay 理想レベル**（赤線 + ラベル表示）
  - 前提: 中間レベル実装後・実機計測で許容できる場合のみ
  - 注意: `layoutSkillMarkers` + SVG DOM + getBBox が毎フレーム戻り、レスポンス改善分が相殺されやすい
  - 関連: [`REQ-race-detail-graph-map-view.md`](tasks/REQ-race-detail-graph-map-view.md)

- [ ] **スキルパレットの並び順をレアリティ段階別に変更**
  - 現状: `buildPaletteSkillOptions` は `umasimSkillDataList` の出現順（extract 順）
  - 目標: 可能なら **❖緑（inherit）→ ★赤（evo）→ ✦金（rare）+ 白（normal）混合** の3段階でグループ化して表示
  - 触る想定: `umasimSkillData.ts`（`buildPaletteSkillOptions` の sort）、必要なら `SkillCommandPalette.tsx`
  - 注意: `onlyUnique` パレットは unique のみのため別扱い。各段階内の名前順は要検討
  - 関連: [`REQ-palette-local-skill-data.md`](tasks/REQ-palette-local-skill-data.md)

- [ ] **タブ追加時のサムネイル飛翔アニメーション削除**
  - 経緯: 旧レイアウトでは右カラム上部タブが見えないことがあり、タブ追加をユーザーに認知させるための対処だった
  - 現状: ダッシュボード形式で上部タブが常に見えるため不要
  - 目標: `flyingThumbnail` / `flyToTab` アニメーションと関連 state・タイマーを削除
  - 触る想定: `page.tsx`, `SimTabPanel.tsx`
  - 関連: 全画面 Cockpit UI（[`REQ-fullscreen-cockpit-layout.md`](tasks/REQ-fullscreen-cockpit-layout.md)）

- [ ] **グラフ デバフ帯（B-3）の実機検証**
  - 現状: `minus` 系はパレット/OCR 経路で sim に載らず、紫線・デバフ checkbox の検証不可
  - 目標: SkillVerifier で minus を手動追加する等、検証用データで `kind: debuff` の skillEvents を確認
  - 触る想定: 検証手順のみ（必要なら `SkillVerifier` / パレット方針は別判断）
  - 関連: [`REQ-race-detail-graph-phase3.md`](tasks/REQ-race-detail-graph-phase3.md) B-3

- [ ] **サイドバー折りたたみボタンをスクロール位置に依存させない**
  - 現状: 折りたたみボタンが左カラムの `overflow-y-auto` 内（タイトル行）にあり、下へスクロールすると押せない
  - 目標: 左カラムをスクロール中でも常に折りたたみ操作可能（sticky ヘッダー or ボタンをスクロール外へ分離）
  - 触る想定: `desktop-app/app/(main)/page.tsx`（サイドバー展開時レイアウト）

- [ ] **左カラム設定項目の折りたたみ**
  - 現状: `SettingsPanel` の項目（API キー・保存先・ホットキー等）が常時展開。項目数は多くないが左カラムがやや冗長
  - 目標: 設定ブロックを折りたたみ可能にし、すっきりした見た目にする（デフォルト展開/折りたたみは実装時に決定）
  - 触る想定: `SettingsPanel.tsx`, 必要なら `CapturePanel.tsx`
  - 関連: サイドバー狭幅 UI（[`REQ-sidebar-compact-layout.md`](tasks/REQ-sidebar-compact-layout.md)）

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

- [x] **Google Map 型グラフ UI Phase 5 完了** — ステップ 3 暫定 UI 削除 + ステップ 4 全体実機検証クローズ（検証手順 1〜7 すべて OK / `249c4b2` / [`REQ-race-detail-graph-map-view.md`](tasks/REQ-race-detail-graph-map-view.md) **done**）
- [x] Google Map 型グラフ UI Phase 5 — **ステップ 3 暫定 UI 削除**（`expandSkillRows` / K=4 legacy 経路除去・map-view 単一路線・操作ヒント追加）（`ee6d460` / [`REQ-race-detail-graph-map-view.md`](tasks/REQ-race-detail-graph-map-view.md)）
- [x] ホイール 1 ノッチ拡大率調整 — `CHART_VIEW_WHEEL_ZOOM_FACTOR` 1.1→1.2（**実機検証クローズ** 2026-06-19 18:18 / `bec0d2a` / [`REQ-race-detail-graph-map-view.md`](tasks/REQ-race-detail-graph-map-view.md)）
- [x] **連続ホイールズームの途中 commit 除去** — `MAP_INTERACTION_WHEEL_IDLE_MS` 150→300ms（案 A。**実機検証クローズ** 2026-06-19 18:12 / `8227f93`〜`1902c42` / [`REQ-race-detail-graph-wheel-continuous-zoom.md`](tasks/REQ-race-detail-graph-wheel-continuous-zoom.md)）
- [x] Google Map 型グラフ — Interaction Canvas Engine **Phase 1〜4**（Dual-Viewport・handoff 200ms SLA。**実機検証クローズ** 2026-06-19 / `9042aa9` / `96e40d5` / [`REQ-race-detail-graph-interaction-engine.md`](tasks/REQ-race-detail-graph-interaction-engine.md)）
- [x] Google Map 型グラフ — Interaction Canvas Engine **Phase 4 設計レビュー**（案 A 維持 + probe 多フレーム rAF + dev 計測・200ms SLA 定義）（2026-06-19 17:36 / [`REQ-race-detail-graph-interaction-engine.md`](tasks/REQ-race-detail-graph-interaction-engine.md)）
- [x] ホイールズーム中心を可視窓 center（画面中心拡大）に変更 — **採用・実機検証クローズ** 2026-06-19（`6ac05a9` / [`REQ-race-detail-graph-map-view.md`](tasks/REQ-race-detail-graph-map-view.md)）
- [x] 非操作時もスキル発動点小丸を常時表示（半径 2.5px・overlay SVG + Canvas）（`c6db25c` / `d22db24` / Phase 3 拡張）
- [x] グラフパン時の Y 軸目盛りテキスト選択による再ドラッグ不能 — select-none + pointerdown preventDefault（`9a3b8ca` / Phase 3 実機指摘）
- [x] Google Map 型グラフ — Interaction Canvas Engine **Phase 3**（Canvas rAF 配線・発動点小丸・Line strokeOpacity defer）（**実機検証クローズ** 2026-06-19 / `8ab7c60` / [`REQ-race-detail-graph-interaction-engine.md`](tasks/REQ-race-detail-graph-interaction-engine.md)）
- [x] Google Map 型グラフ — Interaction Canvas Engine **Phase 2**（liveViewRef 分離・deferDomainCommit・buildInteractionPlotMetrics）（**実機検証クローズ・軽量** 2026-06-19 16:13 / `8767b1a` / [`REQ-race-detail-graph-interaction-engine.md`](tasks/REQ-race-detail-graph-interaction-engine.md)）
- [x] Google Map 型グラフ — Interaction Canvas Engine **Phase 1**（chartLineRenderer.ts・getSpeedAtTime export・座標検証）（`5693968` / [`REQ-race-detail-graph-interaction-engine.md`](tasks/REQ-race-detail-graph-interaction-engine.md)）
- [x] Google Map 型グラフ — domain 更新 30fps cap（perf fallback）（**実機検証クローズ** 2026-06-19 01:12 / `5053012`〜`cba1f4c` / [`REQ-race-detail-graph-map-view-perf-fallback.md`](tasks/REQ-race-detail-graph-map-view-perf-fallback.md)）
- [x] Google Map 型グラフ — overlay scales 同期 + ズーム操作一連（レスポンス・復帰ずれ・scales probe）（**実機検証クローズ** 2026-06-19 00:46 / `98c0cea`〜`a1dd542` / [`REQ-race-detail-graph-map-view.md`](tasks/REQ-race-detail-graph-map-view.md)）
- [x] Google Map 型グラフ — overlay 復帰位置ずれ修正（metrics 同期ゲート + 操作終了時 pending flush）（`a9125c7` / [`REQ-race-detail-graph-map-view.md`](tasks/REQ-race-detail-graph-map-view.md)）
- [x] Google Map 型グラフ — ズーム操作のレスポンス改善（rAF バッチ・metrics リセット削減・操作中 overlay defer）（`98c0cea` / [`REQ-race-detail-graph-map-view.md`](tasks/REQ-race-detail-graph-map-view.md)）
- [x] Google Map 型グラフ — percent 軸追従修正（ホイール・縦パンで centerPercent 連動）（**実機検証クローズ** 2026-06-18 23:30 / `f8a62f0` / [`REQ-race-detail-graph-map-view.md`](tasks/REQ-race-detail-graph-map-view.md)）
- [x] Google Map 型グラフ UI — ステップ 2（ChartViewState 配線・ホイール等倍ズーム・2D パン・ダブルクリックリセット）（`91e76cb` / [`REQ-race-detail-graph-map-view.md`](tasks/REQ-race-detail-graph-map-view.md)）
- [x] Google Map 型グラフ UI — map-view ステップ 1（ChartPlotMetrics + cartesian 実測 + 俯瞰統合 layout）（`aca5f6f` / [`REQ-race-detail-graph-map-view.md`](tasks/REQ-race-detail-graph-map-view.md)）
- [x] Phase 5-R1b ポリッシュ: XAxis reserve + overlay domain を speedPlotHeight に統一（`a8744ef` / 実機確認待ち）
- [x] Phase 5-R1b ポリッシュ: speedPlotHeight に Legend 分を反映（`ba4e172` — XAxis 未考慮で stack 16px 低下）
- [x] Phase 5-R1b ポリッシュ: contentPlotHeight 修正 + nudge リセット（`2e52a26` — Legend 未考慮で過補正）
- [x] Phase 5-R1b ポリッシュ: stack 0 赤線の半px整列 + 速度線 nudge（`b94777d` — **plot 高さ修正で置換**）
- [x] Phase 5-R1b ポリッシュ: 赤線アンカー分離 + 同時刻のみスタック（`7af3b0c` — **案1は撤回**）
- [x] Phase 5-R1b ポリッシュ: ラベル↔赤線隙間 + 速度線 linear 補間統一（`cce0314` / 5-R1b 実機指摘）
- [x] Phase 5-R1b: 詳細表示レイアウト（赤線アンカー + 同時刻スタック圧縮）— yStackOffset 二段階・赤線速度線アンカー・ラベル上配置（**実機検証待ち** / `782dabe` / [`REQ-race-detail-graph-same-time-stack-compact.md`](tasks/REQ-race-detail-graph-same-time-stack-compact.md)）— 赤線／ラベル一体・K=4.0 固定・案3 維持（**実機検証クローズ** 2026-06-14 11:04 / `dd414ea` / [`REQ-race-detail-graph-analysis-revert.md`](tasks/REQ-race-detail-graph-analysis-revert.md)）
- [x] detail 分析モード刷新 — 案3 + K 下限 3.0 + 赤線分離（**赤線分離 NG・R1 で revert 予定** / `a83d5df` / [`REQ-race-detail-graph-skill-layout-sync.md`](tasks/REQ-race-detail-graph-skill-layout-sync.md)）
- [x] xStaggerOnly 衝突条件修正（案A）— baseY 近接判定除去、Y zoom 探索 dead code 解消（**superseded** / `0545e9f` / [`REQ-race-detail-graph-skill-layout-sync.md`](tasks/REQ-race-detail-graph-skill-layout-sync.md)）
- [x] overview stack 0 優先（案1）— OFF 時 Y stagger なし・速度スナップ維持・被り許容（**実機検証待ち** / `3806581` / [`REQ-race-detail-graph-skill-layout-sync.md`](tasks/REQ-race-detail-graph-skill-layout-sync.md)）
- [x] detail ラベル px 固定（A案）— font/hit box/オフセット固定、yZoom は plot+stagger のみ（**実機検証待ち** / `af78fe8` / [`REQ-race-detail-graph-skill-layout-sync.md`](tasks/REQ-race-detail-graph-skill-layout-sync.md)）
- [x] detail Y zoom 反復収束 + X-only stagger — 2D 被りゼロまで K 探索・detail 時 X 重なり stagger（**実機検証待ち** / `12af1e1` / [`REQ-race-detail-graph-skill-layout-sync.md`](tasks/REQ-race-detail-graph-skill-layout-sync.md)）
- [x] 縦拡大 = Y クローズアップ（密集度自動 zoom）— 速度追従+相関維持・detail 縦スクロール（**superseded by 反復 zoom** / `b7f3838` / [`REQ-race-detail-graph-skill-layout-sync.md`](tasks/REQ-race-detail-graph-skill-layout-sync.md)）
- [x] 縦拡大 ON 時 Y 軸圧縮（360px 固定）修正 — viewport 高さ LineChart + 下スキル band（**superseded** / `e1ef3f2`）
- [x] 縦拡大 ON 時の Y 軸縮小・スキル重なり修正 — 速度 plot 固定 + スキル band 分離 + X+Y stagger（**実機検証待ち** / `cff8573` / [`REQ-race-detail-graph-skill-layout-sync.md`](tasks/REQ-race-detail-graph-skill-layout-sync.md)）
- [x] スキル帯×速度折れ線連動レイアウト — 速度スナップ + 0.4秒ビンストラグger（案A）（**実機検証待ち** / `6816447` / [`REQ-race-detail-graph-skill-layout-sync.md`](tasks/REQ-race-detail-graph-skill-layout-sync.md)）
- [x] パレットのスキルデータ参照をローカルに統一 — `buildPaletteSkillOptions` + inherit 優先 dedupe + SkillPanel warm-up 削除（**実機検証クローズ** / `f564898` / [`REQ-palette-local-skill-data.md`](tasks/REQ-palette-local-skill-data.md)）
- [x] タブ切り替え時の引っかかり改善 — keep-alive + visibility 重ね + TabBar UI 刷新（**実機検証クローズ** / `224d67a`〜`132d56a` / [`REQ-tab-switch-performance.md`](tasks/REQ-tab-switch-performance.md)）
- [x] スタミナキープ持続線異常 — WASM endTime センチネル + 条件付き水平線描画（**実機検証クローズ** / `8b02849` / [`REQ-race-detail-graph-stamina-keep-line.md`](tasks/REQ-race-detail-graph-stamina-keep-line.md)）
- [x] グラフ縦拡大 ON 時の末尾スキル帯クリップ — `computeExpandedChartHeight` 式修正（`6a9b0fb` / [`REQ-race-detail-graph-vertical-clip.md`](tasks/REQ-race-detail-graph-vertical-clip.md)）
- [x] グラフスキル hover UI ポリッシュ — カーソル default + hover ピル発光（`67b3707` / [`REQ-race-detail-graph-skill-tooltip.md`](tasks/REQ-race-detail-graph-skill-tooltip.md)）
- [x] グラフ内スキル hover Tooltip — 効果量・持続時間・発動位置％（本家 GraphSkill.description 準拠）（`a5e5e7d` / `2c73c81` / [`REQ-race-detail-graph-skill-tooltip.md`](tasks/REQ-race-detail-graph-skill-tooltip.md)）
- [x] 直近レース詳細グラフ Phase 4 — baseline グラフ diff（2系列オーバーレイ・**実機検証クローズ** A〜F OK）（`e780b3d` / `a4752cf` / [`REQ-race-detail-graph-phase4.md`](tasks/REQ-race-detail-graph-phase4.md)）
- [x] レース詳細グラフ UI レスポンス改善 Phase 1+2 — overlay SVG・useMemo 分割・スクロールバー/Tooltip 追従修正・**実機検証クローズ**（`f8158c8` / `2c8e1ed` / `e9b337f` / `873080e` / [`REQ-race-detail-graph-performance.md`](tasks/REQ-race-detail-graph-performance.md)）
- [x] Phase 3 UX スキル行 B案 — 下ライン・28px 行高・zinc ピル・縦拡大一貫レイアウト（`447d25e` / [`REQ-race-detail-graph-phase3-ux.md`](tasks/REQ-race-detail-graph-phase3-ux.md)）
- [x] 直近レース詳細グラフ Phase 3 UX ポリッシュ — ラベル TopLeft・ダーク scrollbar・フォーカス白線除去・Legend 同期（`7a91cb7` / [`REQ-race-detail-graph-phase3-ux.md`](tasks/REQ-race-detail-graph-phase3-ux.md)）
- [x] TODO.md 運用ルール整備 — 進行中ライフサイクル・エージェント必須手順を TODO / rules / CHAT_TEMPLATE / PROJECT に追記（`bf52d7a`）
- [x] 直近レース詳細グラフ Phase 3 — スキル帯・表示切替（WASM skillEvents + checkbox + 本家準拠ラベル/赤線）（`f8e8cbe`〜修正コミット / [`REQ-race-detail-graph-phase3.md`](tasks/REQ-race-detail-graph-phase3.md)）
- [x] 直近レース詳細グラフ Phase 2 — 区間オーバーレイ + trackDetail WASM + UX改善（色弱対策・坂上下段・右Y軸体力0）（`5e2b401` / [`REQ-race-detail-graph-phase2.md`](tasks/REQ-race-detail-graph-phase2.md)）
- [x] レース詳細グラフ Y軸・単位改善 — 双 Y 軸・体力/レーン床リマップ・速度 m/s（`206b9ee` / [`REQ-race-detail-graph-axis.md`](tasks/REQ-race-detail-graph-axis.md)）
- [x] 全画面 Cockpit UI（Phase 1〜3 + UX ポリッシュ）— SkillVerifier 右ペイン・トースト Portal・KPI ストリップ等（`98c8739`〜`a75ec9c` / [`REQ-fullscreen-cockpit-layout.md`](tasks/REQ-fullscreen-cockpit-layout.md)）
- [x] サイドバー狭幅 UI 整備（Phase S1+S2）— 行レイアウト修正・二重カード解消・padding 圧縮（`d8ddb66` / [`REQ-sidebar-compact-layout.md`](tasks/REQ-sidebar-compact-layout.md)）
- [x] 全画面 Cockpit UI Phase 2 — KPI ストリップ + グラフ常時表示 + 実機検証済み（`6b8b13b` / `c9412ee`）
- [x] 全画面 Cockpit UI Phase 1 — サイドバー折りたたみ + 右カラム全幅化 + min-w-0 縮退（`98c8739`）
- [x] 直近レース詳細グラフ（Phase 1 MVP）— `runSimulationDetail` WASM + recharts 折りたたみ UI（`2abda5a` / [`REQ-race-detail-graph-phase1.md`](tasks/REQ-race-detail-graph-phase1.md)）
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

なし

---

## 既知の問題・メモ

- パレットのスキル一覧は **`umasimSkillDataList`（ローカル）正本** — `buildPaletteSkillOptions`。WASM sim のみ `fetchSkillData()`（GitHub）
- **将来（案B・Backlog）**: `skill_data.txt` を自前 GitHub に置き fetch 一本化 → extract→push でユーザー再配布を減らす方針。sim 定義と UI 一覧を同一 JSON に揃える
- **新スキル時の現状**: 同梱 `umasimSkillData.ts` 利用箇所（P1 後のパレット/OCR）は **extract + アプリ再配布** が必要。WASM のみ mee1080/umasim fetch なら sim 定義はオンラインで追従しうるが、パレット/OCR は同梱更新まで新スキル非対応
- `special`（14件）+ `minus`（1件）が `unique` 直後に並んでいたため、除外前は先頭がすべて白表示だった
- Gemini API キーは Windows 資格情報マネージャー（`com.umamusume.race-analyzer` / `gemini_api_key`）に保存
- サイドバー狭幅 UI（380px / min 320px）は Phase S1+S2 で完了（[`REQ-sidebar-compact-layout.md`](tasks/REQ-sidebar-compact-layout.md)）。S3 コンテナクエリは見送り
- 全画面 Cockpit UI（Phase 1〜3）は完了（[`REQ-fullscreen-cockpit-layout.md`](tasks/REQ-fullscreen-cockpit-layout.md)）
- グラフ Y軸・m/s は [`REQ-race-detail-graph-axis.md`](tasks/REQ-race-detail-graph-axis.md) で対応済み
- 直近レース詳細グラフ: ロードマップ [`REQ-race-detail-graph.md`](tasks/REQ-race-detail-graph.md)。**Phase 5 実装正本**は [`REQ-race-detail-graph-map-view.md`](tasks/REQ-race-detail-graph-map-view.md)（Google Map 型・等倍 XY + 2D パン）。旧 R2/R3 は superseded
- 現代ウマ娘: 所持 50〜70+ スキル。グラフ `skillEvents` は発動イベント数（20〜40+ あり得る）
- **別作業で発見（2026-06-11）**: サイドバー折りたたみボタンのスクロール追従、ステータス条件ボタンのテキスト化、グラフ/スキル表記以降のレスポンス低下 — いずれも Backlog 登録済み
- **REQ 運用**: 着手候補の正本は **本 TODO**。`draft` REQ 起票時は Backlog へ必ず1行追加（`.cursor/rules/docs-management.mdc`）
- **連続ホイールひっかかり**: **解消・実機検証クローズ**（idle 300ms / `8227f93`）。overlay 復帰 ~500ms は連続ズーム改善とのトレードオフとして許容。**Phase 5 実機検証（2026-06-19）**: 停止後 overlay 表示が長く感じる → P2「合成 metrics 即時 handoff」Backlog 登録
- 因子管理 DB・Tesseract OCR・Supabase 連携は **開発予定なし**（`.cursor/rules/development.mdc`）

---

## セクションの役割

| セクション | 役割 | いつ更新するか |
|-----------|------|---------------|
| **現在のフォーカス** | プロジェクト全体で今優先しているテーマ（1行） | 着手時・方針変更時 |
| **進行中** | **いまコード/設定を変更している作業**（最大1件） | **着手時**（必須） |
| **Backlog** | 未着手タスク（優先度付き） | 新タスク追加・着手時に行を移動 |
| **完了済み** | 完了タスク（コミットハッシュ付き） | **完了時**（必須） |
| **保留 / ブロック中** | 外部待ち・判断待ちで止まっている作業 | ブロック発生/解消時 |
| **既知の問題・メモ** | バグメモ・調査結果・運用メモ（タスク化前の情報） | 発見時。タスク化したら Backlog へ |

---

## 更新ルール

### ライフサイクル（Backlog 項目）

1. **着手時（必須）**: Backlog から該当行を **「進行中」へ移す**（同時に載せるのは1件）。「現在のフォーカス」を合わせて更新。`最終更新:` を書き換える
2. **完了時（必須）**: 「進行中」から **「完了済み」へ移す**（コミットハッシュを添える）。Backlog に残っていれば削除。REQ があれば `done` に更新
3. **中断・ブロック時**: 「進行中」→「保留 / ブロック中」へ移し、理由を1行追記

### その他

4. 新タスク発生時: 優先度を決めて Backlog に追加（Backlog 外の作業も同様）
5. 大きめの機能は `docs/tasks/REQ-*.md` を作成してリンクする
6. **日時記録**: 更新・ログのタイムスタンプは `YYYY-MM-DD HH:mm`（ローカル時刻）。詳細は `.cursor/rules/docs-management.mdc`
7. TODO を触ったら、先頭の `最終更新:` を **その作業の日時** に書き換える
8. **REQ を `draft` / `in-progress` で起票したら、同一コミット内で Backlog に必ず1行追加する**（REQ だけに書いて TODO を空にしない）
9. REQ が `done` になったら Backlog から削除し「完了済み」へ移す（REQ ファイル自体は残す）
10. REQ 20件超: `docs/tasks/INDEX.md` を新設して一覧管理（`.cursor/rules/docs-management.mdc` 参照）

### 着手の定義

次の **いずれかが最初に起きた時点** で「着手」とみなし、**最初のコミットに TODO 更新を含める**（遅くともコード変更と同じコミット内）。

- ワークスペースのコード・設定を変更する
- `docs/tasks/REQ-*.md` を `in-progress` にする
- ユーザー指示で「このタスクを進める」と明示された（調査のみの Ask mode を除く）

### Backlog 外・小さな作業

| 種別 | 進行中 | Backlog |
|------|--------|---------|
| 数行の修正・バグ1件 | 載せる（1行で可） | 不要 |
| メモ・Backlog 追記のみ | 不要 | 追記のみ |
| 複数コミット/複数セッション見込み | 載せる | 先に Backlog へ追加してから着手 |
| 設計レビュー（Ask mode・コード変更なし） | 不要 | 不要（フォーカス更新のみ可） |

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
