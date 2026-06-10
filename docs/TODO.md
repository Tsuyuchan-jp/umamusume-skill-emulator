# Todo / 進捗管理

> Cursor 作業チャット起票時に `@docs/TODO.md` で参照する正本。
> **作業完了のたびに必ず更新**し、コミットに含める。

最終更新: 2026-06-10 23:45

---

## 現在のフォーカス

パレットのスキルデータ参照をローカルに統一（P1）— 次チャットで着手

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

### P2 — 改善・アイデア

- [ ] **ゲームアップデート後のスキルデータ更新**
  - 手順: `UPDATE_SKILLS.md`
  - コマンド: `npm run extract-umasim-skills`（必須）、`npm run extract-skill-info`（mdb あり時）

- [ ] **StatusPanel のスキル表示に色分けを追加**（任意）
  - 現状: スキル名のみ（`getSkillNameById`）
  - 低優先: SkillPanel / Verifier で足りるなら見送り可

---

## 完了済み

- [x] レース詳細グラフ Y軸・単位改善 — 双 Y 軸・体力/レーン床リマップ・速度 m/s（`206b9ee` / [`REQ-race-detail-graph-axis.md`](tasks/REQ-race-detail-graph-axis.md)）
- [x] 全画面 Cockpit UI（Phase 1〜3 + UX ポリッシュ）— SkillVerifier 右ペイン・トースト Portal・KPI ストリップ等（`98c8739`〜`a75ec9c` / [`REQ-fullscreen-cockpit-layout.md`](tasks/REQ-fullscreen-cockpit-layout.md)）
- [x] サイドバー狭幅 UI 整備（Phase S1+S2）— 行レイアウト修正・二重カード解消・padding 圧縮（`d8ddb66` / [`REQ-sidebar-compact-layout.md`](tasks/REQ-sidebar-compact-layout.md)）
- [x] 全画面 Cockpit UI Phase 2 — KPI ストリップ + グラフ常時表示 + 実機検証済み（`6b8b13b` / `c9412ee`）
- [x] 全画面 Cockpit UI Phase 1 — サイドバー折りたたみ + 右カラム全幅化 + min-w-0 縮退（`98c8739`）
- [x] 直近レース詳細グラフ（Phase 1 MVP）— `runSimulationDetail` WASM + recharts 折りたたみ UI（`2abda5a`）
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
