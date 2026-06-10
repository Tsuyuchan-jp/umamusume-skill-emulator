# Todo / 進捗管理

> Cursor 作業チャット起票時に `@docs/TODO.md` で参照する正本。
> **作業完了のたびに必ず更新**し、コミットに含める。

最終更新: 2026-06-10 15:55

---

## 現在のフォーカス

パレットのスキルデータ参照をローカルに統一（P1）

---

## 進行中

なし

---

## 次にやること（Backlog）

優先度順。作業チャット起票時は **P0 から1件** 取る。

### P0 — 次に着手

（なし — P1 を参照）

### P1 — 重要（急がない）

- [ ] **パレットのスキルデータ参照をローカルに統一**
  - 現状: パレット一覧は `fetchSkillData()`（GitHub）、色分けは `umasimSkillData.ts`（ローカル）の二重参照
  - 目標: `umasimSkillDataList` を正本にして不整合リスクを減らす
  - 触る想定: `SkillCommandPalette.tsx`, `umaemuAdapter.ts`
  - 注意: フィルタ条件（special/minus 除外）は維持

### P2 — 改善・アイデア

- [ ] **直近レース詳細グラフ（Phase 1 MVP）**
  - REQ: `docs/tasks/REQ-race-detail-graph.md`
  - 目標: 速度・体力・レーンの折れ線 + ResultCard 下折りたたみ。シミュ後に詳細1走を自動取得
  - 前提: umasim `:race` WASM に詳細出力 API 追加（現行 rawSample では frames なし）
  - Phase 4: baseline グラフ diff（核機能・高優先）
  - 触る想定: `umaemu/`（race.js, worker.js）, `umaemuAdapter.ts`, `RaceDetailChart.tsx`（新規）

- [ ] **ゲームアップデート後のスキルデータ更新**
  - 手順: `UPDATE_SKILLS.md`
  - コマンド: `npm run extract-umasim-skills`（必須）、`npm run extract-skill-info`（mdb あり時）

- [ ] **StatusPanel のスキル表示に色分けを追加**（任意）
  - 現状: スキル名のみ（`getSkillNameById`）
  - 低優先: SkillPanel / Verifier で足りるなら見送り可

---

## 完了済み

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
