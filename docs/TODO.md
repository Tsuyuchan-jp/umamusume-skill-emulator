# Todo / 進捗管理

> **プロジェクト進捗の唯一の正本。** Backlog・進行中・完了・保留・既知の問題はすべてここを見る。
> Cursor 作業チャット起票時は `@docs/TODO.md` を **最初に** 参照する。
> **着手時と完了時の両方** で必ず更新し、コミットに含める（要点は下記「更新ルール」「エージェント必須手順」。詳細は [`DOCS-GUIDE.md`](DOCS-GUIDE.md)）。

最終更新: 2026-09-12 07:37

---

## docs 入口

運用・永続正本・REQ の地図: `[DOCS-GUIDE.md](DOCS-GUIDE.md)`

---

## 現在のフォーカス

OCR 難読スキル名の失敗改善（実装済・実機検証待ち）

## サマリー（手更新）

Backlog・保留を変更したら件数を合わせて更新する。

| 進行中 | P1 着手可能 | P1 棚上げ | P2 未着手 | 保留 |
| --- | --- | --- | --- | --- |
| 1 | 2 | 1 | 6 | 1 |

直近リリース: **v1.6.1**（2026-09-10）

---

## 進行中

- [ ] **OCR 難読スキル名の失敗改善**（実装済・**実機検証待ち**）
  - 照合順: エイリアス → `千.万.` 骨格 → 編集距離≤1（4文字以上）→ Dice 0.45
  - 実機4件の机上: 千錘万錬 / 千礫万鋒 / 勝利へ至る累積 / 聡せめ心 → 採用（`npm test` 111件 PASS）
  - 実機確認: 同じ4件が SkillPanel に載り、読み取り失敗から消えること。快速・パレット／sim 退行なし
  - 関連: [`REQ-ocr-fuzzy-missing-skills.md`](tasks/REQ-ocr-fuzzy-missing-skills.md)（B2 吸収）


## 次にやること（Backlog）

優先度順（重要度）。

### P0 — 緊急（次回バージョン優先）

（なし）

### P1 — 重要

- [ ] **1走シミュレーション — 賢さ判定による不発動スキル表示**
  - 背景: 実ゲームでは所持スキルがすべて発動するわけではなく、**賢さ**の数値判定で一部スキルが不発動になる。現状のグラフ（1走 `raceDetail`）は **発動した `skillEvents` のみ** 表示で、不発動スキルは見えない
  - 目標: 本家 **umasim** が賢さ判定による不発動をどう扱っているかを調査した上、1走シミュレーション結果に **不発動スキル** を表記する（発動スキル帯と区別できる UI）
  - 調査: umasim / WASM の `runSimulationDetail` 出力に不発動情報があるか、`activateLot` 等の既存フィールドとの対応、なければ Worker 拡張の要否
  - 触る想定: `umaemuAdapter.ts`, `worker.js` / WASM（`SkillEventDump` 拡張の可能性）、`RaceDetailChart.tsx`, `raceGraphBuilder.ts`, `types.ts`
  - 注意: **着手前に Ask mode で umasim 調査・UI 案を確定**。REQ 起票推奨（レース詳細グラフ Phase 3 系の拡張）
  - 関連: `[REQ-race-detail-graph-phase3.md](tasks/REQ-race-detail-graph-phase3.md)` スキル帯・`[REQ-race-detail-graph-skill-tooltip.md](tasks/REQ-race-detail-graph-skill-tooltip.md)`

- [ ] **Worker 大量試行時の断続失敗対策**（調査・別タスク）
  - 背景: ユーザーレポートで 1,000 回 sim の途中失敗など fetch 単独では説明しきれないパターンあり（`[REQ-skill-data-fetch-fallback.md](tasks/REQ-skill-data-fetch-fallback.md)` スコープ外）
  - 目標: OOM / チャンク化等の恒久対策を検討
  - 触る想定: `umaemuAdapter.ts`, `worker.js`（要調査）

### P1 — 棚上げ（着手見送り）

- [ ] **スキル獲得画面 OCR → 全習得スキルポイント算出**（大型新機能）
  - 概要: スキル獲得画面をキャプチャし OCR で **獲得可能スキル** と **スキルのヒントレベル** を取得。スキル DB と突き合わせ、**全スキル習得に必要なスキルポイント** を算出する
  - オプション（同一機能内）:
    1. **チェックリスト** — 不要スキルを外した場合の必要ポイント再計算
    2. **仮想スキル追加** — 画面に無いスキルを足した場合の必要ポイント再計算
    3. **切れ者** — 切れ者付与時の必要ポイント再計算
  - 想定フロー: キャプチャ（獲得画面）→ OCR → ファジーマッチでスキル ID 解決 → ヒントレベル + DB（コスト・前提）から合計 SP 算出 → UI で調整・再計算
  - 触る想定: `geminiOcr.ts`（獲得画面用プロンプト/スキーマ）、`fuzzyMatcher.ts`, `umasimSkillData.ts` / `skillRarityData.ts`（コスト正本の要確認）、新 UI コンポーネント、必要なら `capture.rs` / `stitch`（獲得画面シーン）・`CapturePanel.tsx`
  - 注意: **着手前に Ask mode 設計レビュー必須**（ヒントレベル→コスト換算・切れ者ルール・DB 不足項目）。**REQ 起票必須**（着手時 `REQ-skill-point-planner.md` 等を draft 起票し同一コミットで本行にリンク）
  - 関連: オートキャプチャ複数画面（育成完了前後の獲得画面）— `[REQ-auto-capture-multi-screen.md](tasks/REQ-auto-capture-multi-screen.md)` Phase 2 経路と整合要検討

### P2 — 改善・アイデア

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

- [ ] **グラフ デバフ帯（B-3）の実機検証**
  - 現状: `minus` 系はパレット/OCR 経路で sim に載らず、紫線・デバフ checkbox の検証不可
  - 目標: SkillVerifier で minus を手動追加する等、検証用データで `kind: debuff` の skillEvents を確認
  - 触る想定: 検証手順のみ（必要なら `SkillVerifier` / パレット方針は別判断）
  - 関連: `[REQ-race-detail-graph-phase3.md](tasks/REQ-race-detail-graph-phase3.md)` B-3

- [ ] **StatusPanel のスキル表示に色分けを追加**（任意）
  - 現状: スキル名のみ（`getSkillNameById`）
  - 低優先: SkillPanel / Verifier で足りるなら見送り可

---

## 完了済み

直近10件のみ。それ以前は [`TODO-ARCHIVE.md`](TODO-ARCHIVE.md)。

- [x] **起動時スキル一覧更新と開催ローテフェッチ** — umasim シミュ JSON から OCR／パレット一覧を生成。`event_track.txt` でチャンミ／LoH。トースト A〜D。`npm test` 103件 PASS。**実機検証クローズ**（起動 A・診断・手動取得・プリセット・OCR/sim 退行なし OK / 2026-09-12 07:17 / `a5faa8c`）/ [`REQ-runtime-skill-catalog.md`](tasks/REQ-runtime-skill-catalog.md)
- [x] **v1.6.1 リリースビルド** — version 1.6.1 bump・CHANGELOG Unreleased 昇格・`app.exe` 生成・96件テスト PASS（2026-09-10 19:48 / `b2fcd49`〜`8659650`）/ [`REQ-release-v1.6.1.md`](tasks/REQ-release-v1.6.1.md)
- [x] **OCR 結合濁点（NFD）のスキルマッチ失敗を修正** — NFC 正規化＋末尾 `Lv` 数字除去。灰の光跡 / 良バ場〇 / ネバーギブアップ / アグレッシブ。閾値 0.45 維持。`npm test` 96件 PASS。**実機検証クローズ**（4件すべて所持スキルに適用 OK / 2026-09-10 19:33 / `369eab6`）
- [x] **AppData スキルキャッシュの mkdir 権限不足を修正** — `$APPDATA/skill_data` 本体を fs capability に追加。コンソール `forbidden path` / `allow-mkdir` 解消。sim 本体は対象外（2026-09-10 19:04 / `2be708c`）
- [x] **ゲームアップデート後のスキルデータ追従** — DMM `master.mdb`（2026-08-31）差し替え・umasim **2106件**（+40）・skillRarity **1892件**（+35）。新規固有「光れ！弾けろ！超新星爆発！」等。コース・プリセット・WASM は今回未変更。`npm test` 92件 PASS。**実機検証クローズ**（新スキル反映・OCR/sim 退行なし OK / 2026-09-10 18:58 / `071aa4a`）
- [x] **ファイル OCR の対応拡張子に WebP を追加** — ダイアログ・ヒント・拡張子から MIME 補完・Gemini へ実 MIME 送信。クリップボード手動コピーの WebP は対象外。`npm test` 92件 PASS。**実機検証クローズ**（WebP 選択・プレビュー・OCR・PNG/JPEG 退行なし OK / 2026-09-10 19:02 / `48badca`）
- [x] **Git 履歴から `auto-capture-design-pack.zip` を削除** — 現行に無い約 53MB zip を履歴除外し Private へ force push（2026-08-25 14:43 / `f079357`）
- [x] **GitHub Private へ初回 push** — 履歴から `master.mdb` と誤ファイル `src-tauri/2` を除外。ローカルの `master.mdb` は gitignore のまま保持（2026-08-25 14:38 / `da004f4`）
- [x] **v1.6.0 リリースビルド** — version 1.6.0 bump・CHANGELOG Unreleased 昇格・`app.exe` 生成・88件テスト PASS（2026-08-10 04:08 / `35aa0a7`）
- [x] **OCR 未マッチ見える化（B1）** — 恒久 UI（パネル内最上・「読み取り失敗（N件）」）・Phase A 診断削除・未収録デバフ注記。`npm test` PASS。**実機検証クローズ**（位置・文言・0件非表示・千鍛万錬退行なし・診断パネル消失・パレット/sim 退行なし OK / 2026-08-10 04:01 / `dbca8af`〜`7097951`）/ [`REQ-ocr-fuzzy-missing-skills.md`](tasks/REQ-ocr-fuzzy-missing-skills.md)（B2 は継続）

---

## 保留 / ブロック中

- [ ] **R3.5d パートナー登録緑ボタン除外**（`6de25ad`）— **実機再検証待ち**（tauri dev 再起動 or release exe 後）
  - Scene Model M4/M6 と統合修正予定。暫定パッチの追加は `[REQ-stitch-scene-model.md](tasks/REQ-stitch-scene-model.md)` パッチ禁止リストに従う

---

## 既知の問題・メモ

未解決・調査中・運用上の参照メモのみ。実機クローズ／解消済みのバグは載せない（完了済み・REQ・ARCHIVE を参照）。

- **Tab Arrival（2026-07-23）**: Phase A（TabBar 入場）**実機検証クローズ**（`7e3acd8`）。旧 Phase B（ヘッダー+scale）は `49ec2f1` でロールバック済み。**KPI フラッシュ**は `e8e5acf` 実装→実機で表現不一致のため `f57d467` でロールバック。**見送り**（再着手時は Ask で方針再合意）
- パレット／OCR のスキル一覧は **実行時の umasim シミュ JSON** から生成（初期値は同梱）。WASM sim も同じ `fetchSkillData()`（GitHub 優先 → AppData → 同梱）
- **sim スキルデータ**: 起動時に取得。オフライン時は同梱/キャッシュ。設定「スキルデータ（診断）」と手動取得ボタン
- **開催ローテ**: umasim `event_track.txt`。失敗時はプリセット非表示。新コース自体は `trackData.ts` 更新が別途必要
- 案B（自前 GitHub への skill_data 置き場）は `[REQ-runtime-skill-catalog.md](tasks/REQ-runtime-skill-catalog.md)` の umasim 直取りで不要
- **新スキル時の現状**: オンラインかつ umasim が更新済みなら **再配布不要**。新しいスキル機構や新コースは WASM / `trackData.ts` 更新が残る
- **オートキャプチャ Capture–Stitch 契約**: **広帯 -4 / 狭帯 -3**（`scrollRegionH` しきい値 280px）。**M5**: wheel は stitch（TS）正本・Rust IPC 受信。正本: `[REQ-stitch-rewrite.md](tasks/REQ-stitch-rewrite.md)`「Capture–Stitch 契約」
- **Scene Model ロードマップ**: `[REQ-stitch-scene-model.md](tasks/REQ-stitch-scene-model.md)` 起票（M0 done）。Catalog: `[SCENE-CATALOG.md](../auto-capture-design-pack/SCENE-CATALOG.md)`。素材運用: `[PACK-GUIDE.md](../auto-capture-design-pack/PACK-GUIDE.md)`
- **stitch `layoutOpenCv.ts`**: 旧 `layout.ts` は Next.js 16 の `app/` 予約名衝突でリネーム（`0fac03e`）。正本は `layoutCore.ts`。ビルド失敗時は `[RELEASE_BUILD.md](RELEASE_BUILD.md)` トラブルシュート
- **オートキャプチャ結合 R3.5 設計正本**: shiftEstimate（SSD + median）。詳細: `[REQ-stitch-rewrite.md](tasks/REQ-stitch-rewrite.md)` R3.5 節
- Gemini API キーは Windows 資格情報マネージャー（`com.umamusume.race-analyzer` / `gemini_api_key`）に保存
- 直近レース詳細グラフ: ロードマップ `[REQ-race-detail-graph.md](tasks/REQ-race-detail-graph.md)`。**Phase 5 実装正本**は `[REQ-race-detail-graph-map-view.md](tasks/REQ-race-detail-graph-map-view.md)`（Google Map 型・等倍 XY + 2D パン）。旧 R2/R3 は superseded
- 現代ウマ娘: 所持 50〜70+ スキル。グラフ `skillEvents` は発動イベント数（20〜40+ あり得る）

---

## セクションの役割

| セクション | 役割 | いつ更新するか |
|---|---|---|
| **現在のフォーカス** | 今優先しているテーマ（1行） | 着手時 |
| **サマリー** | Backlog・保留の件数と直近リリース（手更新） | Backlog・保留・リリース変更時 |
| **進行中** | いま変更中の作業（最大1件） | 着手時（必須） |
| **Backlog** | 未着手タスク | 追加・着手時 |
| **完了済み** | 直近10件（古い分は ARCHIVE） | 完了時（必須） |
| **保留 / ブロック中** | 外部待ち・判断待ち | ブロック時 |
| **既知の問題・メモ** | 未解決・運用参照のみ | 発見時。クローズしたら削除 |

---

## 更新ルール

> 詳細正本: [`DOCS-GUIDE.md`](DOCS-GUIDE.md)・[`.cursor/rules/docs-management.mdc`](../.cursor/rules/docs-management.mdc)・[`CHAT_TEMPLATE.md`](CHAT_TEMPLATE.md)

- **着手**: Backlog → 進行中（1件）・フォーカス・`最終更新:` — 最初のコミットに含める
- **完了**: 進行中 → 完了済み先頭（ハッシュ）・REQ `done`・11件超なら [`TODO-ARCHIVE.md`](TODO-ARCHIVE.md) へ追い出し — 完了報告前にコミット
- **保留**: 進行中 → 保留 / ブロック中
- **REQ 起票**: `draft` / `in-progress` と同一コミットで Backlog に1行追加
- **既知の問題**: クローズ済みバグは載せない。日時は `YYYY-MM-DD HH:mm`（`docs-management.mdc`）
- **サマリー**: Backlog・保留の追加・完了・移動時に件数表を更新

---

## エージェント必須手順

**着手時**: TODO を読む → 対象を進行中へ（1件）→ フォーカス・`最終更新:` → 最初のコミットに含める。

**完了時**: 完了済みへ追記 → REQ `done` → ARCHIVE 追い出し（必要時）→ `最終更新:` → コミット。

並行チャット時は進行中を常に1件に保つ（空のまま別チャット着手は運用エラー）。詳細は `docs-management.mdc`「TODO.md ライフサイクル」。
