# Todo / 進捗管理

> **プロジェクト進捗の唯一の正本。** Backlog・進行中・完了・保留・既知の問題はすべてここを見る。
> Cursor 作業チャット起票時は `@docs/TODO.md` を **最初に** 参照する。
> **着手時と完了時の両方** で必ず更新し、コミットに含める（詳細は下記「更新ルール」「エージェント必須手順」）。

最終更新: 2026-06-12 01:41

---

## 現在のフォーカス

P1 改善タスク（グラフスキル Tooltip / 縦拡大クリップ等）

---

## 進行中

> **同時に載せるのは最大1件。** 別チャットで作業中なら、ここが「なし」のままにしない。
> 形式: `- [ ] **タイトル** — （1行要約）` + 必要なら REQ リンク・触る想定

なし

## 次にやること（Backlog）

優先度順。作業チャット起票時は **P0 から1件** 取る。

### P0 — 次に着手

（なし — 次は P1）

### P1 — 重要

- [ ] **グラフ内スキル hover Tooltip** — 効果量・持続時間・発動位置％（本家準拠）
  - 現状: overlay SVG は `pointer-events-none`。`SkillEventDump` に効果量なし（WASM 拡張の要否は Ask mode で確定）
  - 算出可: 持続時間（start/endTime）、発動位置％（frames + courseLength）
  - REQ: [`REQ-race-detail-graph-skill-tooltip.md`](tasks/REQ-race-detail-graph-skill-tooltip.md)
  - 触る想定: `RaceDetailChart.tsx`, `raceGraphBuilder.ts`、必要なら `WasmEngine.kt`
- [ ] **グラフ縦拡大 ON 時の末尾スキル帯クリップ**
  - 症状: 縦拡大を有効にすると、レース後半（終盤）で発動したスキルが縦幅から溢れて表示されない
  - 触る想定: `RaceDetailChart.tsx`, `raceGraphBuilder.ts`（スキル行レイアウト・縦拡大時の SVG/コンテナ高さ計算）
  - 関連: Phase 3 UX 縦拡大レイアウト（[`REQ-race-detail-graph-phase3-ux.md`](tasks/REQ-race-detail-graph-phase3-ux.md)）

- [ ] **タブ切り替え時の引っかかり改善**
  - 症状: タブ切り替えのみ軽い引っかかりを感じる。スキル表示 ON/OFF どちらでも同程度のため、Phase 1 グラフ性能修正とは無関係の可能性が高い
  - 目標: タブ切替をスキル表示状態に依存せず快適にする
  - 触る想定: `page.tsx`（タブ state・右カラム再描画境界）、必要なら `ResultCard.tsx` / `SkillVerifier.tsx`
  - 注意: Phase 2 性能 REQ 完了後でも可。着手前に Profiler で原因切り分け推奨

- [ ] **パレットのスキルデータ参照をローカルに統一**
  - 現状: パレット一覧は `fetchSkillData()`（GitHub）、色分けは `umasimSkillData.ts`（ローカル）の二重参照
  - 目標: `umasimSkillDataList` を正本にして不整合リスクを減らす
  - 触る想定: `SkillCommandPalette.tsx`, `umaemuAdapter.ts`
  - 注意: フィルタ条件（special/minus 除外）は維持

### P2 — 改善・アイデア

- [ ] **グラフ デバフ帯（B-3）の実機検証**
  - 現状: `minus` 系はパレット/OCR 経路で sim に載らず、紫線・デバフ checkbox の検証不可
  - 目標: SkillVerifier で minus を手動追加する等、検証用データで `kind: debuff` の skillEvents を確認
  - 触る想定: 検証手順のみ（必要なら `SkillVerifier` / パレット方針は別判断）
  - 関連: [`REQ-race-detail-graph-phase3.md`](tasks/REQ-race-detail-graph-phase3.md) B-3

- [ ] **サイドバー折りたたみボタンをスクロール位置に依存させない**
  - 現状: 折りたたみボタンが左カラムの `overflow-y-auto` 内（タイトル行）にあり、下へスクロールすると押せない
  - 目標: 左カラムをスクロール中でも常に折りたたみ操作可能（sticky ヘッダー or ボタンをスクロール外へ分離）
  - 触る想定: `desktop-app/app/(main)/page.tsx`（サイドバー展開時レイアウト）

- [ ] **「実行時のステータス条件」ボタンをテキスト付き表記に変更**
  - 現状: `SimulationStatusView` が Activity アイコンのみ（スペース不足時の暫定 UI）
  - 目標: Cockpit UI 整備で余白が確保されたため、「実行時のステータス条件」等のラベル付きボタンに変更
  - 触る想定: `SimulationStatusView.tsx`, 必要なら `page.tsx` のツールバー行

- [ ] **ゲームアップデート後のスキルデータ更新**
  - 手順: `UPDATE_SKILLS.md`
  - コマンド: `npm run extract-umasim-skills`（必須）、`npm run extract-skill-info`（mdb あり時）

- [ ] **StatusPanel のスキル表示に色分けを追加**（任意）
  - 現状: スキル名のみ（`getSkillNameById`）
  - 低優先: SkillPanel / Verifier で足りるなら見送り可

---

## 完了済み

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

- パレットのスキル一覧は `fetchSkillData()`（GitHub）から取得。色分けは `umasimSkillData.ts`（ローカル）の ID 参照
- `special`（14件）+ `minus`（1件）が `unique` 直後に並んでいたため、除外前は先頭がすべて白表示だった
- Gemini API キーは Windows 資格情報マネージャー（`com.umamusume.race-analyzer` / `gemini_api_key`）に保存
- サイドバー狭幅 UI（380px / min 320px）は Phase S1+S2 で完了（[`REQ-sidebar-compact-layout.md`](tasks/REQ-sidebar-compact-layout.md)）。S3 コンテナクエリは見送り
- 全画面 Cockpit UI（Phase 1〜3）は完了（[`REQ-fullscreen-cockpit-layout.md`](tasks/REQ-fullscreen-cockpit-layout.md)）
- グラフ Y軸・m/s は [`REQ-race-detail-graph-axis.md`](tasks/REQ-race-detail-graph-axis.md) で対応済み
- 直近レース詳細グラフ: ロードマップ [`REQ-race-detail-graph.md`](tasks/REQ-race-detail-graph.md)。**Phase 4 baseline diff 実機検証クローズ**（2026-06-12 01:41）。次の本線は P1 スキル hover Tooltip
- **タブ切り替え**（2026-06-11）: 現状許容・詳細改善は P1 Backlog（グラフ性能 REQ とは別件）
- 現代ウマ娘: 所持 50〜70+ スキル。グラフ `skillEvents` は発動イベント数（20〜40+ あり得る）
- **別作業で発見（2026-06-11）**: サイドバー折りたたみボタンのスクロール追従、ステータス条件ボタンのテキスト化、グラフ/スキル表記以降のレスポンス低下 — いずれも Backlog 登録済み
- **REQ 運用**: 着手候補の正本は **本 TODO**。`draft` REQ 起票時は Backlog へ必ず1行追加（`.cursor/rules/docs-management.mdc`）
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
