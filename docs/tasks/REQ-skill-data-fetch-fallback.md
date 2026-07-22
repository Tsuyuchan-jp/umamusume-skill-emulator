# REQ-skill-data-fetch-fallback: スキルデータ取得のフォールバックとシミュレーションエラー区別

> ユーザーレポート（外部 HTTPS 不安定・シミュレーション失敗）への恒久対処。
> OpenCV.js 同梱化と同思想の **fetch 優先 + 同梱フォールバック** を sim 用 `skill_data.txt` に適用する。
> 設計レビュー → 実装の 2 チャット運用。正本: 本 REQ + [`CHAT_TEMPLATE.md`](../CHAT_TEMPLATE.md)。

- **ステータス**: done（**実機検証クローズ** 2026-07-23）
- **作成日**: 2026-06-22 16:17
- **関連コミット**: `d79dd28`（Phase 1）〜 `a5c04a0`（Phase 4）

---

## 目的

一部ユーザー環境で **実行時の外部 HTTPS**（CDN・`raw.githubusercontent.com` 等）が不安定またはブロックされ、シミュレーションが断続的に失敗している。開発者の実機では再現しにくく、現状の汎用エラーメッセージ（R-001）では原因切り分けができない。

本 REQ では次を実現する。

1. **skill_data.txt**: GitHub fetch を優先しつつ、失敗時は同梱データ + AppData キャッシュで sim を継続可能にする（ゲーム更新のたびのアプリ再配布は不要な運用を維持）
2. **エラー区別表示**: fetch 失敗・WASM/Worker 失敗・既存 raceDetail 失敗をユーザー向けに分離
3. **（余力）接続チェック UI** またはフォールバック使用時の明示トースト

---

## 背景（チャットログ要約）

### ユーザーレポート

| 事象 | 内容 |
|------|------|
| シミュレーション失敗 | 「シミュレーションを完了できませんでした。一時的な不具合の可能性が…」が断続的に表示。100 回試行で約 50% 失敗、1000 回では十数回リトライで成功した例 |
| レビュアー推測 | Gemini API キー（無料枠・混雑）が原因ではないか — **誤り**（sim 経路に Gemini は未使用） |
| 過去の関連報告 | **3 名**が OpenCV.js の **CDN からのダウンロード失敗**を報告。同梱化で対処済み |
| 今回の報告者 | 上記 3 名のうちの 1 名。OpenCV 問題と同系統の **GitHub fetch 失敗**の可能性が高い |

### 技術的整理

| 経路 | 現状 | 外部依存 |
|------|------|----------|
| 画像結合 | `/opencv.js` 同梱 | なし（CDN 問題は同梱で解消済み） |
| シミュレーション | `umaemuAdapter.fetchSkillData()` → `raw.githubusercontent.com/mee1080/umasim/.../skill_data.txt` | **あり** |
| OCR | Gemini API | あり（別経路） |

- 失敗時メッセージ正本: [`simulationErrors.ts`](../../desktop-app/app/lib/engine/simulationErrors.ts) の `DEFAULT_SIMULATION_ERROR_MESSAGE`（R-001）
- 内部英語エラー（`Failed to fetch skill data`、`null`、OOM 等）はすべて同一文言に正規化されるため、ユーザー・開発者とも原因特定が困難
- `raceDetail` のみ失敗時は別メッセージ（`RACE_DETAIL_FETCH_FAILED_MESSAGE`）— sim 集計成功時

### 根本原因の仮説（環境クラス）

単一バグより **特定ユーザー環境クラス** の可能性が高い。

1. **`raw.githubusercontent.com` および CDN 系ドメインのブロック**（DNS フィルタ・企業網・AdGuard 等）— 最有力
2. **未署名 portable exe** からの WebView2 外部通信制限（AV / SmartScreen）
3. **プロキシ必須環境**での WebView2 `fetch` 挙動差
4. **地域的到達性**（GitHub / 海外 CDN への不安定アクセス）

**MSI 配布への変更は根本対策にならない**（同一 WebView2・同一 `fetch`）。OpenCV は「同梱で外部依存を除去」したことで解決した。

### 方針決定（2026-06-22 チャット）

| 優先 | 内容 |
|------|------|
| 実施 | エラー区別表示、`fetch` 優先 + 同梱フォールバック + AppData キャッシュ、フォールバック時トースト（接続チェック UI は余力） |
| 低優先（本 REQ 外） | コード署名、Rust 側 HTTP 取得、自前ミラー（TODO 案B） |

ユーザーに `raw.githubusercontent.com` をブラウザで開いてもらう等の技術検証は期待しない。**アプリ側で区別表示・フォールバック**により非技術ユーザーでも運用可能にする。

---

## Phase 表（予定）

| Phase | 内容 | 状態 |
|-------|------|------|
| **D1** | 設計レビュー（Ask mode）— 取得順序・キャッシュパス・エラー分類・UI | done |
| **1** | `fetchSkillData` リファクタ（fetch → AppData キャッシュ → 同梱）+ ビルド時 `skill_data.txt` 同梱 | done |
| **2** | `simulationErrors` 拡張・SimulationLauncher / SimTabPanel のトースト分岐 | done |
| **3** | フォールバック使用時トースト +（余力）Settings 接続チェック | done（接続チェック UI は Backlog 化） |
| **4** | 実機検証・`UPDATE_SKILLS.md` / README 更新 | done |

---

## スコープ

### やること

#### Phase 1 — スキルデータ取得

- [`umaemuAdapter.ts`](../../desktop-app/app/lib/engine/umaemuAdapter.ts) の `fetchSkillData` を次の優先順位で取得する（設計レビューで確定）:
  1. **GitHub fetch**（現行 URL: `mee1080/umasim` の `skill_data.txt`）— 最新優先
  2. **AppData キャッシュ**（Tauri fs または既存ストレージ方針）— 前回成功分
  3. **同梱フォールバック** — `public/skill_data.txt`（`extract-umasim-skills` 生成物をビルド時にコピーする手順を整備）
- 取得成功時は AppData に保存し、次回起動の fetch 負荷を下げる
- フォールバック使用時は **メタデータ**（ソース: `remote` | `cache` | `bundled`）を呼び出し元に返せるようにする（トースト・ログ用）
- メモリ内 `cachedSkillsJson` との整合を維持（Worker への `skillData` 渡しは現状維持）

#### Phase 2 — エラー区別表示

- [`simulationErrors.ts`](../../desktop-app/app/lib/engine/simulationErrors.ts) にエラー種別（例: `SKILL_DATA_FETCH` / `SIMULATION_WORKER` / 既存 `RACE_DETAIL`）とユーザー向け文言を定義
- **fetch 全滅**（remote + cache + bundled すべて不可）と **WASM/Worker 失敗**を別トーストに
- [`SimulationLauncher.tsx`](../../desktop-app/app/components/SimulationLauncher.tsx)、[`SimTabPanel.tsx`](../../desktop-app/app/(main)/SimTabPanel.tsx) で `formatSimulationErrorMessage` の利用を種別対応に
- `console.error` には従来どおり技術詳細（API キー等は含めない）

#### Phase 3 — UX（余力）

- フォールバック（cache / bundled）使用時: 「同梱または保存済みのスキルデータで続行しました（最新版ではない可能性があります）」等の **明示トースト**
- **接続チェック**（SettingsPanel）: 「スキルデータ取得テスト」ボタン → 成功/失敗/使用ソースを日本語表示（ユーザー向け簡易診断）

#### Phase 4 — ドキュメント

- [`UPDATE_SKILLS.md`](../../UPDATE_SKILLS.md): 同梱 `skill_data.txt` の更新手順を追記
- [`README.md`](../../README.md): ネットワーク要件を「オンライン推奨・オフラインは同梱版で制限付き動作」に更新

### やらないこと

- Gemini API / OCR 経路の変更
- **MSI 配布への切り替え**（ネットワーク問題の根本対策としては期待しない）
- **コード署名**（中長期・低優先）
- **Rust 側 HTTP 取得**（中長期・低優先）
- **自前 GitHub ミラー一本化**（TODO 案B — 本 REQ とは別タスク。フォールバック同梱で当面は足りる）
- `umasimSkillData.ts`（OCR/パレット）の fetch 化 — 現状ローカル正本のまま
- `race.js` / WASM 本体の更新
- シミュレーション試行回数のチャンク化・Worker OOM 対策（別 Issue として Backlog 検討可。本 REQ ではエラー区別のみ）

---

## 仕様（設計レビューで詰める項目）

### 取得優先順位（案）

```
1. fetch GitHub（成功 → AppData 保存 → 使用）
2. AppData キャッシュ（fetch 失敗時）
3. public/skill_data.txt 同梱（2 も無い or 破損時）
4. すべて失敗 → SKILL_DATA_FETCH エラー（日本語・再試行案内）
```

### エラーメッセージ（案）

| 種別 | ユーザー向け文言（案） |
|------|----------------------|
| `SKILL_DATA_FETCH` | スキルデータの取得に失敗しました。インターネット接続をご確認のうえ、もう一度お試しください。 |
| `SIMULATION_WORKER` | シミュレーション処理中にエラーが発生しました。試行回数を減らすか、アプリを再起動してお試しください。 |
| `RACE_DETAIL` | 既存 `RACE_DETAIL_FETCH_FAILED_MESSAGE` を維持 |
| フォールバック使用 | オンライン取得に失敗したため、保存済み／同梱のスキルデータで続行しました（最新版ではない可能性があります）。 |

### AppData キャッシュ（設計未決）

- 保存先: Tauri `app_data_dir` 配下（例: `skill_data.txt` または `skill_data.json`）
- 権限: `tauri.conf` / capabilities に fs 追加が必要か — **設計レビューで決定**
- 破損検知: JSON parse 失敗時は次のソースへフォールスルー

### 同梱 skill_data.txt の生成

- ソース: `npm run extract-umasim-skills` と同じ umasim `skill_data.txt`
- ビルド前コピー: `public/skill_data.txt`（`build-release-exe` または extract スクリプト拡張 — 設計で決定）
- git 追跡: 大容量のため **生成物を git に含めるか CI のみか** を設計で決定

### 既知の関連 TODO

- [`TODO.md`](../TODO.md)「skill_data.txt 参照の一本化（案B）」— 本 REQ 完了後も将来改善として残す（fetch URL の自前化は本 REQ スコープ外）

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/lib/engine/umaemuAdapter.ts` | `fetchSkillData` 多段フォールバック、ソースメタデータ |
| `desktop-app/app/lib/engine/simulationErrors.ts` | エラー種別・文言・テスト追加 |
| `desktop-app/app/components/SimulationLauncher.tsx` | トースト分岐・フォールバック通知 |
| `desktop-app/app/(main)/SimTabPanel.tsx` | 同上（検証 sim） |
| `desktop-app/app/components/SettingsPanel.tsx` | （余力）接続チェック UI |
| `desktop-app/public/skill_data.txt` | 同梱フォールバック（生成・配置） |
| `tools/mdb-extractor/extract_umasim_skill_data.js` または `desktop-app/scripts/*` | 同梱用コピー手順 |
| `desktop-app/src-tauri/capabilities/default.json` | （必要時）fs 権限 |
| `UPDATE_SKILLS.md`, `README.md` | 運用・ネットワーク記載更新 |
| `desktop-app/app/lib/engine/simulationErrors.test.ts` | 新エラー種別のテスト |

### 触らないファイル（原則）

- `geminiOcr.ts`, `fuzzyMatcher.ts` — OCR 経路
- `src-tauri/capture.rs` 等キャプチャ Rust — 本タスクと無関係
- `race.js` / WASM バイナリ

---

## 完了条件

- [x] 設計レビュー（Phase D1）完了・方針承認
- [x] GitHub fetch 成功時は従来どおり最新 `skill_data.txt` を使用
- [x] fetch 失敗時、AppData → 同梱の順で sim が動作する
- [x] fetch 全滅時と Worker 失敗時で **異なる** ユーザー向けトースト
- [x] フォールバック使用時に明示トースト（接続チェック UI は Backlog）
- [x] Vitest: `simulationErrors` 新種別
- [x] `UPDATE_SKILLS.md` / README 更新
- [x] 実機確認 — **手順 1〜7 実機検証クローズ**（2026-07-23）。手順 1〜2 は 2026-06-25 確認済み
- [x] REQ `done`、TODO 完了済み、INDEX 更新、コミット

---

## 検証手順（改訂版）

> `skill_data.txt` の取得は **sim 実行直前のみ**（起動時・OCR 時は取得しない）。
> 同一セッション内の 2 回目以降の sim はメモリキャッシュを再利用するため、手順 2/3/4 では **必ずアプリ終了**すること。

| 手順 | 内容 | 状態 |
|------|------|------|
| 1 | オンライン sim → フォールバックトーストなし | OK |
| 2 | オンライン sim 成功 → アプリ終了 → オフライン → sim（AppData キャッシュ経路） | OK |
| 3 | キャッシュなし・オフライン・同梱フォールバック | OK |
| 4 | fetch 全滅（dev: `public/skill_data.txt` 削除/破損） | OK |
| 5 | Worker 失敗時のエラー文言区別 | OK |
| 6 | SimulationLauncher / SimTabPanel 回帰 | OK |
| 7 | raceDetail 失敗トースト維持 | OK |

### 手順 3 — 同梱フォールバック（キャッシュなし・オフライン）

1. `tauri dev` を **停止**
2. AppData キャッシュを削除:
   ```powershell
   Remove-Item -Recurse -Force "$env:APPDATA\com.umamusume.race-analyzer\skill_data" -ErrorAction SilentlyContinue
   ```
3. インターネット OFF → `npm run tauri dev` で起動 → sim 実行（OCR 不要）
4. **期待**: sim 成功 ＋ 警告トースト「オンライン取得に失敗したため、保存済み／同梱の…」（`type: error`）

### 手順 4 — fetch 全滅（dev のみ）

1. `desktop-app/public/skill_data.txt` を一時リネームまたは破損
2. 手順 3 と同様（キャッシュ削除・オフライン）→ sim
3. **期待**: sim 失敗 ＋「スキルデータの取得に失敗しました。インターネット接続を…」（`SkillDataFetchError` 文言）
4. 検証後 `skill_data.txt` を復元

### 手順 5 — Worker 失敗時のエラー区別

- **期待**: 「シミュレーション処理中にエラーが…」（手順 4 の文言と異なる）
- 再現例: dev で `worker.js` の `SIMULATE` 先頭に一時 throw、または極端な試行回数。無理なら「未検証」と記録可

### 手順 6 — 回帰

- `SimulationLauncher` 初回 sim、`SimTabPanel` 比較検証 sim

### 手順 7 — raceDetail 失敗トースト

- sim 成功 + `raceDetailFetchFailed` 時に既存文言トースト（回帰なし）

### 切り分けヒント

- DevTools に `GitHub skill data fetch failed, trying AppData cache:` が出ればオフライン経路
- 警告トーストが出ない場合: OS オフラインでも `raw.githubusercontent.com` が通っている可能性
- 手順 2 と 3 は似ているが、手順 3 だけは **事前 AppData 削除が必須**

---

## リスク・注意

| リスク | 対策 |
|--------|------|
| 同梱データが古い | fetch 優先 + フォールバック時トーストで明示 |
| AppData と bundled の二重管理 | extract 手順を UPDATE_SKILLS に一元化 |
| `public/skill_data.txt` のリポジトリサイズ | 設計で git 追跡方針を決定 |
| 案B TODO との重複 | 本 REQ はフォールバックまで。URL 自前化は別タスク |

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-22 16:17 | REQ 起票。fetch 優先 + 同梱フォールバック + エラー区別 + AppData キャッシュをスコープに | ユーザーレポート・チャット分析に基づく方針決定 |
| 2026-06-22 16:17 | MSI / コード署名 / Rust HTTP / 案B は本 REQ 外（低優先） | 効果対コスト・OpenCV 同梱と同思想で足りる |
| 2026-06-22 16:17 | 設計レビュー（Ask mode）後に実装チャットへ | CHAT_TEMPLATE 2 チャット運用 |
| 2026-06-23 03:35 | Phase 1〜4 実装完了。接続チェック UI は Settings Backlog へ | 余力スコープ見送り。フォールバックトーストで代替 |
| 2026-06-25 07:18 | 実機検証手順 1〜2 OK。手順 3〜7 は TODO P1 Backlog へ延期 | ユーザー判断で後日実施。検証手順を改訂版に更新 |
| 2026-07-23 04:52 | **実機検証クローズ** — 手順 3〜7 全 OK。REQ 正式クローズ | ユーザー実機確認。CONCEPT-MAP: 今回の用語追加なし（既存カードで十分） |

---

## 設計レビュー起票用プロンプト

新チャット（**Ask mode**）の先頭に貼る。`@` でファイルを添付すること。

```
@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-skill-data-fetch-fallback.md
@docs/CHAT_TEMPLATE.md

## チャット種別
設計レビュー（Ask mode）

## 進め方（重要）
- このチャットでは **コード変更・ファイル編集・コミットを一切しない**
- 現状整理 → 方針提案 → 変更範囲 → リスク → 検証手順 まで提示する
- 私が「承認」「修正」「見送り」のいずれかを返すまで、実装に進まない

## 背景
- P1 Backlog: スキルデータ取得フォールバックとシミュレーションエラー区別（REQ-skill-data-fetch-fallback.md）
- 3 名が OpenCV CDN 失敗、1 名が sim 断続失敗。外部 HTTPS（raw.githubusercontent.com）不安定が疑われる
- Gemini API は sim 経路に無関係。現状 R-001 で全エラーが同一文言に正規化され原因不明

## 今回決めたいこと
1. fetchSkillData の取得優先順位（GitHub → AppData → 同梱）の詳細設計
2. AppData キャッシュの保存先・Tauri fs 権限・ファイル名
3. public/skill_data.txt の生成タイミング（extract / build スクリプト）と git 追跡方針
4. simulationErrors のエラー種別設計とトースト文言
5. 接続チェック UI を Phase 3 に含めるか、フォールバックトーストのみで足りるか

## 確認してほしいファイル
- desktop-app/app/lib/engine/umaemuAdapter.ts
- desktop-app/app/lib/engine/simulationErrors.ts
- desktop-app/app/components/SimulationLauncher.tsx
- desktop-app/app/(main)/SimTabPanel.tsx
- desktop-app/app/components/SettingsPanel.tsx
- desktop-app/src-tauri/capabilities/default.json
- tools/mdb-extractor/extract_umasim_skill_data.js
- UPDATE_SKILLS.md

## 触らないこと（設計上も変更提案に含めない）
- geminiOcr.ts / fuzzyMatcher.ts
- src-tauri キャプチャ系
- race.js / WASM 本体
- MSI 配布切替、コード署名、Rust HTTP、案B 自前ミラー

## 期待するアウトプット
1. 現状整理（データフロー図または箇条書き）
2. 推奨設計（取得チェーン・エラー分類・UI）
3. 未決事項と推奨デフォルト
4. Phase 1〜4 の実装順と完了条件の具体化
5. 承認後に Agent mode 実装チャットへ貼れる「完成プロンプト」（CHAT_TEMPLATE 承認後テンプレ形式、▼ここからコピー／▲ここまで付き）
```
