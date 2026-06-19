# REQ-release-v1.1.0: v1.1.0 リリース（バグ Fix + スキル同期 + ビルド）

> v1.0.7 以降の master を **v1.1.0 としてリリース** するための作業正本。
> 設計レビュー（Ask mode 2026-06-19）承認済み。機能追加・大規模リファクタは v1.1.1 以降。

- **ステータス**: done
- **作成日**: 2026-06-19 23:16
- **関連コミット**: `c12e628`（R1）、`8293001`（R2.5）、`5650bb7`（R3 / リリース）

---

## 目的

v1.0.7 以降に積み上がった Cockpit UI・グラフ Phase 5・keep-alive 等を **v1.1.0 としてユーザー向けリリース** する。リリース前に既知バグ Fix・スキルデータ同期・CHANGELOG / バージョン bump・本番ビルド検証を完了する。

---

## Phase 表

| Phase | 内容 | 状態 |
|-------|------|------|
| **R1** | バグ Fix（R-001 トースト、R-006 raceDetail 失敗トースト、任意 R-008） | 完了 |
| **R2** | Medium Fix（任意・時間あれば R-003 next/script 等） | 未着手 |
| **R2.5** | スキルデータ `extract-umasim-skills` のみ | 完了 |
| **R3** | version bump、CHANGELOG、本番ビルド・実機検証 | 完了 |

---

## スコープ

### v1.1.0 でやること

- **R-001** — シミュ失敗トーストの `null`/生エラー非表示・日本語案内
- **R-006** — `raceDetail` 取得失敗時「sim 成功・グラフのみ不可」の軽量トースト
- **R-008（任意）** — `simulationCount` localStorage NaN ガード
- **R2.5** — `npm run extract-umasim-skills`（`race.js` 更新はしない）
- **R3** — `1.1.0` bump（4 箇所）、CHANGELOG 追記、`npm run tauri build`、実機チェックリスト

### v1.1.0 でやらないこと

- OCR 中止（R-004 / P1 Backlog）
- HotKey dev 警告 Fix（R-002 — 本番 exe 未再現のため Defer）
- keep-alive タブ最適化（R-009 — 1〜3 タブ運用想定、将来 Fix）
- グラフ P2（overlay 中間レベル等）、パレット並び順、Cockpit 大規模 UI 再設計
- `race.js` / WASM エンジン更新（extract のみ）
- 因子 DB / Tesseract / Supabase

---

## Fix 詳細

### R-001 — シミュ失敗トースト

| 項目 | 内容 |
|------|------|
| 症状 | Worker 異常時に `シミュレーションエラー: null` 等が表示 |
| 根拠 | `umaemuAdapter.ts` L51 `new Error(error)`、`SimulationLauncher.tsx` L85-88、`SimTabPanel.tsx` L246-249 |
| 方針 | `toSimulationError()` で正規化 + `formatSimulationErrorMessage()` でトースト確定 |
| 文案例 | 「シミュレーションを完了できませんでした。一時的な不具合の可能性があります。もう一度実行してみてください。繰り返す場合はアプリの再読み込みをお試しください。」 |
| 対象 | 初回 sim（SimulationLauncher）+ 検証 sim（SimTabPanel） |

正規化対象例: `null`、空文字、`"Worker terminated"`、その他非日本語内部メッセージ。`console.error` は詳細ログ用に維持（API キー等を含めない）。

### R-006 — raceDetail 取得失敗トースト

| 項目 | 内容 |
|------|------|
| 症状 | sim 集計は成功するがグラフ用 `raceDetail` のみ失敗 — 現状 `console.warn` のみ |
| 根拠 | `umaemuAdapter.ts` L218-224 |
| 方針 | catch 内で UI へ通知。`runMultipleSimulations` の戻りは従来どおり（`raceDetail: null`）。呼び出し元（SimulationLauncher / SimTabPanel）でトースト表示するか、adapter からコールバック — **実装時に最小差分で選択** |
| 文案例 | 「シミュレーションは完了しましたが、詳細グラフの取得に失敗しました。もう一度実行するか、結果の数値のみご確認ください。」 |

### R-008（任意）— simulationCount NaN

| 項目 | 内容 |
|------|------|
| 根拠 | `page.tsx` L190-193 — 破損 localStorage で NaN |
| 方針 | 不正値は 100 にフォールバック |

---

## スキル更新（R2.5）

**方針: extract のみ**（`race.js` / WASM 手動更新なし）

```powershell
cd desktop-app
npm run extract-umasim-skills
```

| データ | 更新 | 再配布 |
|--------|------|--------|
| `umasimSkillData.ts` | extract | 要（同梱） |
| 実行時 `skill_data.txt` | オンライン時 GitHub 自動 fetch | 不要 |
| `race.js` / `*.wasm` | **今回触らない** | — |

検証: パレット表示・OCR 名前→ID・sim 100 走 + グラフ（オンライン）。

---

## バージョン bump 箇所（R3）

| ファイル | フィールド |
|---------|-----------|
| `desktop-app/package.json` | `"version": "1.1.0"` |
| `desktop-app/src-tauri/tauri.conf.json` | `"version": "1.1.0"` |
| `docs/PROJECT.md` | `現在バージョン: v1.1.0` |
| `desktop-app/app/(main)/page.tsx` | ヘッダー `v1.0.7` ×2 → `v1.1.0` |

---

## CHANGELOG v1.1.0 草案（R3 で追記）

### 新機能

- 全画面 Cockpit UI（サイドバー折りたたみ・右カラム全幅・KPI ストリップ・グラフ常時表示）
- サイドバー狭幅 UI・設定パネル折りたたみ
- 直近レース詳細グラフ（Google Map 型パン/ズーム、Interaction Canvas、overlay handoff、Phase 4 比較、スキル帯・Tooltip）
- タブ切り替え keep-alive
- パレットのスキルデータをローカル正本に統一

### 修正

- スタミナキープ持続線の異常描画
- グラフ縦拡大時のスキル帯クリップ
- シミュレーション失敗時のトースト文言改善
- 詳細グラフ取得失敗時のユーザー通知
- 各種グラフ UX（Y 軸選択防止、ホイール 1.3、overlay 復帰 latency 等）

### データ

- スキルマスタを umasim `skill_data.txt` と同期（extract 日付を記載）

### ビルド

- 本番ビルド通過・成果物: `umamusume-race-analyzer_1.1.0_x64-setup.exe` / `.msi`

---

## 触るファイル（予定）

| Phase | ファイル | 変更内容 |
|-------|---------|---------|
| R1 | `umaemuAdapter.ts` | エラー正規化、raceDetail 失敗通知 |
| R1 | `SimulationLauncher.tsx` | トースト文言 |
| R1 | `SimTabPanel.tsx` | 検証 sim トースト |
| R1 | `page.tsx`（任意） | simulationCount NaN ガード |
| R2.5 | `umasimSkillData.ts` | extract 再生成 |
| R3 | `package.json`, `tauri.conf.json`, `PROJECT.md`, `page.tsx`, `CHANGELOG.md` | バージョン・履歴 |

### 触らない（デフォルト）

- `geminiOcr.ts`, `fuzzyMatcher.ts`, `src-tauri/`
- `race.js`, `public/umaemu/*.wasm`
- グラフ P2 新機能

---

## 完了条件（REQ 全体）

- [x] `docs/TODO.md` Backlog に起票と同時に1行追加
- [x] **R1** — R-001 / R-006 / R-008 実装・test/build 通過（実機確認は R3 チェックリスト）
- [x] **R2.5** — extract 実行・差分確認・test/build 通過（スキル +4 エントリ / 2021件）
- [x] **R3** — バージョン 4 箇所 + CHANGELOG + `npm run tauri build` 通過（実機手動項目はインストール後確認）
- [x] 本 REQ を `done`、TODO を完了済み（コミットハッシュ）
- [ ] push はユーザー依頼時のみ

---

## 実機検証チェックリスト（R3）

### ビルド

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run tauri build`

### コアフロー

- [ ] ショートカットでキャプチャ開始/停止
- [ ] 結合 → 保存 → OCR → sim → タブ + グラフ
- [ ] SkillVerifier 差分 sim + 比較グラフ

### Fix 確認

- [ ] sim 失敗時トーストに `null` が出ない（R-001）
- [ ] raceDetail 失敗時に軽量トースト（R-006 — 再現手段がなければコードレビュー + warn 経路確認）

### UI / グラフ

- [ ] サイドバー折りたたみ・設定折りたたみ
- [ ] タブ keep-alive（2 タブ以上）
- [ ] グラフ パン/ズーム/ダブルクリックリセット

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-19 23:51 | Phase R3 完了。v1.1.0 bump・CHANGELOG・tauri build 通過（setup.exe / msi 1.1.0） | REQ 全体 done |
| 2026-06-19 23:36 | Phase R2.5 完了。umasim 2021件 extract、新規スキル4エントリ。extract スクリプトにパレット等ヘルパー追記で再発防止 | test/build 通過 |
| 2026-06-19 23:26 | Phase R1 完了。`simulationErrors.ts` で正規化、`raceDetailFetchFailed` フラグでトースト、NaN ガード | R-001/R-006/R-008 実装・test/build 通過 |
| 2026-06-19 23:16 | REQ 起票。Phase R1〜R3 + R2.5 スキル extract | 設計レビュー Ask mode 承認・ユーザー判断反映 |
| 2026-06-19 23:16 | OCR 中止（R-004）は v1.1.0 外 | 将来実装 |
| 2026-06-19 23:16 | HotKey 警告（R-002）は Defer | 本番 exe 未再現 |
| 2026-06-19 23:16 | raceDetail 失敗トースト（R-006）は Fix | ユーザー承認 |
| 2026-06-19 23:16 | keep-alive（R-009）は Defer | 1〜3 タブ運用想定 |
| 2026-06-19 23:16 | スキル更新は extract のみ | race.js 更新なし |
