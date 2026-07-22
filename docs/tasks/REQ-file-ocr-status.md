# REQ-file-ocr-status: 過去キャプチャ画像からステータス読み込み（ファイル OCR ルート）

> 結合済み縦長画像をファイル選択し、既存 OCR フローに乗せてキャプチャ未実施でもシミュレーションまで通す。
> 設計レビューで Q1〜Q6・ボタン無効案1 承認済み。正本: 本 REQ + 完成プロンプト。

- **ステータス**: done
- **作成日**: 2026-07-23 07:30
- **関連コミット**: `096d436`（着手）〜 `528bce2`（実装）

---

## 解くべき問題と目的（Problem Framing）

- **現状の課題**: ステータス取得はオートキャプチャ → 結合 → OCR のみ。`analyzeStitchedImage` は `resultImage`（dataUrl）を受け取るが、外部画像ファイルを選ぶ UI がない
- **目的**: 過去に保存した結合済み縦長画像を選び、既存 OCR フローに乗せてキャプチャ未実施でもシミュレーションまで通す。OCR 精度・プロンプト・キャプチャ本体は触らない

---

## スコープ

### やること

- Tauri `plugin-dialog` の `open` で PNG/JPEG を選択
- `convertFileSrc` → `fetch` → dataUrl 化（plugin-fs の任意パス読取権限は増やさない）
- 選択後はプレビューのみ（自動 OCR しない）。既存「画像からステータスを読込」と「停止」（Abort）を再利用
- CapturePanel 内、自動キャプチャ操作の近くに「画像ファイルを開く」
- `captureStatus` は `saved` 相当。ファイル由来フラグで autoCopy をスキップ（専用状態 `loaded` は増やさない）
- ファイル読込時はクリップボード自動コピーしない・saveFolder へ再保存しない（設定値は変更しない）
- recording / OCR 解析中は「画像ファイルを開く」を無効
- 読込成功時は `umaData` をクリアし、再度「画像からステータスを読込」を押させる
- `SYSTEM_SPECIFICATION.md` §3.2 にファイル OCR 入口を追記

### やらないこと

- OCR 精度・プロンプト・JSON スキーマ・モデル定数・`mime_type` 固定の変更
- fuzzyMatcher / キャプチャ本体 / stitch / シミュレーション / WASM
- スキル獲得画面 OCR
- OCR 中止 UI の再設計
- ディスク非保存オプション（P2）との同時実装
- 複数ファイル一括 OCR、未結合フレームの自動 stitch

---

## 仕様

### ファイル選択

- ダイアログ: `@tauri-apps/plugin-dialog` の `open`
- フィルタ: PNG / JPEG（`png`, `jpg`, `jpeg`）
- パス読取: `convertFileSrc` → `fetch` → dataUrl（fs 権限拡大なし）

### UI（CapturePanel）

- 「画像ファイルを開く」を自動キャプチャ操作の近くに配置
- 選択後はプレビュー表示のみ。OCR は既存ボタンで手動開始
- ヒント: 結合済みステータス画面画像を想定。非ステータス画像は選択拒否せず、ヒント＋既存 OCR エラーに任せる

### 「画像ファイルを開く」の有効/無効（案1）

| 状態 | ボタン |
|------|--------|
| `recording`（キャプチャ実行中） | 無効 |
| OCR 解析中（`isOcrProcessing`） | 無効（先に「停止」してから開き直す） |
| それ以外（`idle` / `saved` 等） | 有効 |

### autoCopy / saveFolder

- ファイル読込時: 自動コピーしない・ディスクへ再保存しない
- 設定値（`autoCopyEnabled` / `saveFolder`）は変更しない
- 手動コピーはプレビュー表示時に既存どおり可（`autoCopyEnabled` が off のときのコピーボタン等）

### 状態

- `captureStatus`: `saved` 相当（プレビューが出る）
- ファイル由来フラグで autoCopy 抑制（専用 `loaded` は増やさない）
- 読込成功時: `umaData` クリア → 再度「画像からステータスを読込」

---

## 設計制約（契約）

- **事前条件**: ユーザーが PNG/JPEG を選択できること。OCR 開始時は既存どおり API キーと `resultImage` が必要
- **事後条件（ファイル読込成功）**: `resultImage` が dataUrl・`captureStatus === "saved"`・プレビュー表示・`umaData === null`・autoCopy/saveFolder 保存が走らない
- **事後条件（OCR）**: 既存 `analyzeStitchedImage` + Abort 契約と同一（[`REQ-ocr-cancel.md`](REQ-ocr-cancel.md)）
- **不変条件**:
  - plugin-fs の任意パス読取権限を増やさない
  - `geminiOcr` のプロンプト・スキーマ・モデル・`mime_type` 固定を変更しない
  - オートキャプチャ経路の autoCopy / saveFolder 挙動を退行させない
  - 専用 `captureStatus: "loaded"` を増やさない
- **異常時の保証**: 読込失敗はエラー表示。誤画像はヒント＋既存 OCR エラー。OCR 中止は既存どおり

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/hooks/useCapture.ts` | ファイル読込・`saved` 設定・ファイル由来フラグ・再保存なし |
| `desktop-app/app/(main)/page.tsx` | autoCopy 抑制・CapturePanel への配線・`umaData` クリア連携 |
| `desktop-app/app/components/CapturePanel.tsx` | 「画像ファイルを開く」UI・無効条件・ヒント |
| `desktop-app/app/lib/`（小ヘルパー） | パス → dataUrl（必要時） |
| `docs/TODO.md` / `docs/tasks/INDEX.md` | 着手・完了同期 |
| `docs/reference/SYSTEM_SPECIFICATION.md` | §3.2 追記 |

---

## 永続正本同期（エージェント必須）

| トリガー | 更新先 |
|----------|--------|
| 着手 | `TODO.md` 進行中、本 REQ、`INDEX.md` |
| 実装完了 | 本 REQ 決定ログ、`TODO.md` 完了済み、`INDEX.md` |
| ファイル OCR 入口の実装完了 | [`SYSTEM_SPECIFICATION.md`](../reference/SYSTEM_SPECIFICATION.md) §3.2 |
| Phase / REQ 完了 | `CONCEPT-MAP.md`（新用語時のみ。追記 0 件可） |

---

## 完了条件

- [x] キャプチャなしでファイル→プレビュー→OCR→Status/Skill→sim まで通る（実装完了・実機はユーザー確認）
- [x] 既存オートキャプチャ→OCR 経路に退行なし（autoCopy 含む）— ファイル由来フラグで分岐のみ
- [x] ファイル読込時に autoCopy・saveFolder 保存が走らない
- [x] ファイル OCR 中の「停止」（Abort）が既存と同様に動く — 同経路再利用
- [x] recording 中・OCR 中は「画像ファイルを開く」が無効
- [x] PNG/JPEG を選べる。ヒント文言あり
- [x] `docs/TODO.md` 着手・完了同期、`INDEX.md` 更新
- [x] `SYSTEM_SPECIFICATION.md` §3.2 追記
- [x] コミット（push なし）
- [x] `npm test`（desktop-app）62件 PASS（2026-07-23 07:34）

---

## 検証手順

1. CHAT_TEMPLATE「検証コマンド（共通）」— `npm test`（desktop-app）。本変更では stitch:golden 必須ではない — **62 passed**（2026-07-23 07:34）
2. 実機: 通常 OCR・中止・ファイル経路・キャプチャなし sim・autoCopy 退行・recording/OCR 中のボタン無効
3. JPEG は1枚煙テスト可

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-07-23 07:30 | Q1 Tauri dialog / Q2 プレビューのみ手動 OCR / Q3 saved 相当＋ファイル由来で autoCopy 抑制 / Q4 PNG+JPEG・誤画像はヒント＋既存エラー / Q5 本 REQ 起票 / Q6 ファイル読込時はコピー・再保存しない / ボタン無効は案1 | 設計レビュー承認済み |
| 2026-07-23 07:30 | CONCEPT-MAP: 今回の用語追加なし（既存カードで十分） | 入口追加のみで新ドメイン概念なし |
| 2026-07-23 07:35 | 実装完了。`resultImageFromFile` で autoCopy 抑制。dataUrl は `convertFileSrc`→fetch。fs 権限拡大なし | 承認済み方針どおり |
