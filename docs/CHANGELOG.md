# 更新履歴

> アプリのリリース単位の変更記録。開発運用ドキュメント（TODO / REQ）とは別管理。

---

## Unreleased

（なし）

---

## v1.3.0 — 2026-07-23

### 新機能

- **長距離レース連続シミュレーションの失敗走スキップ** — 本家 umasim の `RaceOperation`（レース実行処理）と同様、内部エラーで落ちた走だけスキップし、成功した走で集計を続行。1走の例外でバッチ全体が ERROR にならない（成功が1走以上あれば結果を返す）
- **完走数表示** — 結果タブヘッダー右（ステータス条件ボタンの左）に `n/N走` を表示。カーソルを合わせると `シミュ完走〇走 失敗〇走` のツールチップを表示。失敗0は控えめ、失敗ありは琥珀色で強調

### 修正

- **長距離レース（中山3600m）連続シミュレーション失敗** — v1.2.0 既知の問題を解消（逃げ/先行/差し×低スタミナでも成功分の結果を表示）
- **シミュレーション完了トースト** — 失敗走があるとき「N回中M回完走しました（K回は内部エラーのためスキップ）」と表示。比較検証も同方針
- **全滅時の挙動** — 成功0のときは ERROR トーストのみ（結果タブを作らない）。日本語理由は Step1 維持
- **スパート率・各種 rate の分母** — 指定回数ではなく成功回数（`completedCount`）を分母に統一
- **レース条件ラベル** — `RaceInfoLabel`（レース情報ラベル）から試行回数の「〇走」を削除（完走数はヘッダーに集約）
- **スパート率チップのレイアウト** — タイム表示枠と同じ高さに揃え、スパート率表示との混同を防止

### データ

- スキルマスタ **2042件**（v1.2.0 から変更なし）

### ビルド

- 配布正本: `desktop-app/src-tauri/target/release/app.exe` 更新（`npm run build:release-exe`）

---

## v1.2.0 — 2026-07-18

### 新機能

- **Tab Arrival Phase A** — 新規タブ・複製タブ追加時の TabBar 入場演出（スケール/不透明度/リング/下線）、自動スクロール、NEW/コピーバッジ

### 修正

- **オートキャプチャ結合: 最下部びったし二重結合** — 最下部が画面下端にぴったり収まるとき末尾スキル行が重複する問題を修正（案 A′: terminal micro skip）
- **オートキャプチャ結合: 最終ペア coarse≈`S*` 誤採用** — 正当な小スクロールが `S*` 近傍の誤ピークに取られる問題を修正（案 A2a: 短帯再探索）
- **タブ追加・複製時の飛翔アニメーション削除** — サムネイル飛翔演出を廃止し操作感を軽量化
- **「実行時のステータス条件」ボタン** — アイコンのみから「ステータス条件」テキスト付き表記へ変更
- **エラートースト** — `type: error` の長文を折り返し・複数行で全文表示（success は従来どおり1行 truncate）
- **シミュレーションエラー表示** — Worker の null 文字列 / 空メッセージを超長距離向け日本語案内へ変換（`SIMULATION_NULL_ERROR_MESSAGE`）

### 既知の問題（次回バージョンで対応予定）

- **長距離レース（中山3600m）連続シミュレーション失敗** — 逃げ/先行/差しで 100回試行がほぼ失敗。エラーメッセージは改善済みだが根本原因は未解決（`REQ-long-distance-sim-error.md`）

### データ

- スキルマスタ **2042件**（v1.1.1 最終ビルドから変更なし）

### ビルド

- 配布正本: `desktop-app/src-tauri/target/release/app.exe` 更新（`npm run build:release-exe`）

---

## v1.1.1 — 2026-06-30

### データ

- スキルマスタを umasim `skill_data.txt` と同期（2038件 / 新育成ウマ娘スキル対応）
- `master.mdb` から `skillRarityData.ts` を再生成（1833件）
- **2026-07-11 追記**: スキルマスタ再同期（**2042件** / +4）・`app.exe` 再ビルド（バージョン表記 v1.1.1 のまま）

### ビルド

- 配布正本: `desktop-app/src-tauri/target/release/app.exe` 更新済み（`npm run build:release-exe`）
- **2026-07-11**: 上記データ更新に伴い `app.exe` 再生成

---

## v1.1.0 — 2026-06-19

### 新機能

- **全画面 Cockpit UI** — サイドバー折りたたみ・右カラム全幅・KPI ストリップ・グラフ常時表示
- **サイドバー狭幅 UI** — 380px 運用向けレイアウト整備・設定パネル折りたたみ
- **直近レース詳細グラフ** — Google Map 型パン/ズーム、Interaction Canvas、overlay handoff、Phase 4 比較、スキル帯・Tooltip
- **タブ切り替え keep-alive** — 非アクティブタブの state 保持
- **パレット** — スキルデータ参照をローカル正本（`umasimSkillData.ts`）に統一

### 修正

- スタミナキープ持続線の異常描画
- グラフ縦拡大時のスキル帯クリップ
- シミュレーション失敗時のトースト文言改善（`null` 等の内部エラー非表示）
- 詳細グラフ（`raceDetail`）取得失敗時のユーザー通知
- 各種グラフ UX（Y 軸テキスト選択防止、ホイール 1.3、overlay 復帰 latency 短縮 等）
- `simulationCount` localStorage 破損時の NaN ガード

### データ

- スキルマスタを umasim `skill_data.txt` と同期（2026-06-19 extract / 2021件）

### ビルド

- 配布正本: `desktop-app/src-tauri/target/release/app.exe`（インストーラーは使わない。手順は `docs/RELEASE_BUILD.md`）
- `npm run build:release-exe`（`tauri build --no-bundle`）で exe 更新

---

## v1.0.7 — 2026-06-10

### 変更

- **Gemini API キーのセキュアストレージ化**
  - 保存先を `localStorage` から **Windows 資格情報マネージャー** へ移行
  - 起動時に旧 `localStorage` キー（`geminiApiKey`）があれば自動移行（成功後に削除）
  - `keyring` crate に `windows-native` を指定し、再起動後もキーが保持されるよう修正
- **アプリ識別子のリネーム**
  - `identifier`: `com.umamusume.race-analyzer`（旧: `com.umareceipt.capture`）
  - `productName`: `umamusume-race-analyzer`（旧: `uma-receipt-capture`）
- **ApiKeyModal** の説明文を資格情報マネージャー保存に合わせて更新

### ドキュメント

- Cursor 運用: 設計レビュー / バグ報告テンプレート整備（`docs/CHAT_TEMPLATE.md`）

### 修正

- 本番ビルド（`npm run tauri build`）向け TypeScript 修正
  - `page.tsx`: 型 import 追加
  - `SimulationLauncher.tsx`: strict チェック対応

### ビルド

- 本番ビルド（`npm run tauri build`）通過
- 成果物: `umamusume-race-analyzer_1.0.7_x64-setup.exe` / `.msi`

---

## v1.0.6 — （以前）

- スキル UI（5色表示・通常固有ガード・パレット除外）
- キャプチャ → OCR → umasim WASM シミュレーション一連フロー
- FHD 実機検証済み

※ v1.0.6 以前の詳細は git 履歴を参照。
