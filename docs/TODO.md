# Todo / 進捗管理

> Cursor 作業チャット起票時に `@docs/TODO.md` で参照する正本。
> **作業完了のたびに必ず更新**し、コミットに含める。

最終更新: 2026-06-11 14:29

---

## 現在のフォーカス

パレットのスキルデータ参照ローカル統一（P1 次候補）

---

## 進行中

なし

---

## 次にやること（Backlog）

優先度順。作業チャット起票時は **P0 から1件** 取る。

### P0 — 次に着手

（空 — P1 へ）

### P1 — 重要（急がない）

- [ ] **パレットのスキルデータ参照をローカルに統一**
  - 現状: パレット一覧は `fetchSkillData()`（GitHub）、色分けは `umasimSkillData.ts`（ローカル）の二重参照
  - 目標: `umasimSkillDataList` を正本にして不整合リスクを減らす
  - 触る想定: `SkillCommandPalette.tsx`, `umaemuAdapter.ts`
  - 注意: フィルタ条件（special/minus 除外）は維持

- [ ] **直近レース詳細グラフ Phase 4 — baseline グラフ diff（核機能）**
  - SkillVerifier: baseline / current の2系列 or 差分表示、両方 raceDetail 保持
  - REQ: [`REQ-race-detail-graph-phase4.md`](tasks/REQ-race-detail-graph-phase4.md)
  - 触る想定: `SkillVerifier.tsx`, `RaceDetailChart.tsx`, `umaemuAdapter.ts`
  - 注意: Phase 3 完了後が自然。着手前に Ask mode 設計レビュー必須

- [ ] **グラフ実装以降の UI レスポンス低下への対処**
  - 症状: レース詳細グラフ（特にグラフ内スキル表記・Phase 3 以降）導入後、全体の操作レスポンスが明確に遅くなった
  - 調査候補: recharts 再描画、`RaceDetailChart.tsx` の skill ラベル/帯、シミュレーション結果更新時の不要 re-render、WASM 詳細取得のタイミング
  - 触る想定: `RaceDetailChart.tsx`, `raceGraphBuilder.ts`, `SkillVerifier.tsx`, `ResultCard.tsx`
  - 注意: 計測（React Profiler / 再現手順メモ）を先に取ってから最適化方針を決める

### P2 — 改善・アイデア

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
- 直近レース詳細グラフ: ロードマップ [`REQ-race-detail-graph.md`](tasks/REQ-race-detail-graph.md)。Phase 1 + axis + Phase 2 + **Phase 3 完了**。**次: Phase 4**（baseline diff・設計レビュー後）
- **別作業で発見（2026-06-11）**: サイドバー折りたたみボタンのスクロール追従、ステータス条件ボタンのテキスト化、グラフ/スキル表記以降のレスポンス低下 — いずれも Backlog 登録済み
- **REQ 運用**: 着手候補の正本は **本 TODO**。`draft` REQ 起票時は Backlog へ必ず1行追加（`.cursor/rules/docs-management.mdc`）
- 因子管理 DB・Tesseract OCR・Supabase 連携は **開発予定なし**（`.cursor/rules/development.mdc`）

---

## 更新ルール

1. 作業開始時: 「進行中」に1件だけ移す
2. 作業完了時: 「完了済み」に移し、コミットハッシュを添える
3. 新タスク発生時: 優先度を決めて Backlog に追加
4. フォーカスが変わったら「現在のフォーカス」を書き換える
5. 大きめの機能は `docs/tasks/REQ-*.md` を作成してリンクする
6. **日時記録**: 更新・ログのタイムスタンプは `YYYY-MM-DD HH:mm`（ローカル時刻）。詳細は `.cursor/rules/docs-management.mdc`
7. ファイルを更新したら、先頭の `最終更新:` をその作業の日時に書き換える
8. **REQ を `draft` / `in-progress` で起票したら、同一作業で Backlog に必ず1行追加する**（REQ だけに書いて TODO を空にしない）
9. REQ が `done` になったら Backlog から削除し「完了済み」へ移す（REQ ファイル自体は残す）
10. REQ 20件超: `docs/tasks/INDEX.md` を新設して一覧管理（`.cursor/rules/docs-management.mdc` 参照）
