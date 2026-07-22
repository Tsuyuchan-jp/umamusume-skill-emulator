# REQ-ocr-cancel: OCR 解析の中止（AbortController）

> Gemini OCR が長時間返らないとき、ユーザーが途中で止められるようにする。
> 設計レビューで Q1〜Q8 承認済み（案 A）。正本: 本 REQ + [`CHAT_TEMPLATE.md`](../CHAT_TEMPLATE.md)。

- **ステータス**: done（**実機検証クローズ** 2026-07-23 06:04）
- **作成日**: 2026-07-23 05:35
- **関連コミット**: `3892bf9`（着手）〜 `bac51e7`（実装）〜 `6ff6505`（docs 同期）

---

## 解くべき問題と目的（Problem Framing）

- **現状の課題**: `page.tsx` の `handleOcrStart` が `analyzeStitchedImage` を await するだけで、解析中に止められない。Gemini がエラーを返さず長時間かかるとき UI がロックしたように見える
- **目的**: 解析中に「停止」でき、中止後に再度 OCR を実行できること。AbortError（中止）と本物の API エラー表示を区別する

---

## スコープ

### やること

- `AbortController` + `fetch` の `signal` による OCR 中止
- `CapturePanel` で解析中に同一ボタンを「停止」表示へ切替
- 中止後の状態リセット（`isOcrProcessing` false・再 OCR 可能）
- AbortError を 503/API エラー表示と区別
- 中止後に遅延成功しても `umaData` を載せない

### やらないこと

- 自動タイムアウト中止（今回は手動のみ）
- Flash-Lite のみ化、プロンプト/精度変更
- ファイル選択 OCR UI 本体、スキル獲得 OCR
- キャプチャ / stitch / シミュレーション
- `useToast` への `dismiss` 追加（中止/完了/エラーの `showToastMessage` で sticky を上書き）

---

## 仕様

### UI（CapturePanel）

- 待機時ラベル: 「画像からステータスを読込」
- 解析中: 同一ボタンを「停止」表示（スピナー付き可）。キャプチャの開始/停止と同型
- 解析中は `disabled` にしない。クリックで `onOcrCancel`
- トースト内に停止ボタンは置かない。別ボタンも増やさない

### 開始〜完了〜中止の状態

| 段階 | 保証 |
|------|------|
| 開始 | `setIsOcrProcessing(true)` → `setUmaData(null)` → toast「OCR解析中...」(durationMs=0) → `analyzeStitchedImage(..., { signal })` |
| 成功 | `signal.aborted` またはセッション世代が古い場合は `setUmaData` しない。有効なときだけ `setUmaData` + 完了 toast |
| 中止（AbortError） | error toast にしない。`showToastMessage「OCR解析を中止しました」, "success", 約3000`。`umaData` は null のまま（前回結果は復元しない） |
| 本物エラー | 既存の 503/UNAVAILABLE 文言と `OCRエラー: message` を維持 |
| finally | 常に `setIsOcrProcessing(false)` |

### 将来のファイル OCR

- ファイル選択 OCR UI を追加する際は、本 REQ で導入する `analyzeStitchedImage` の **signal 付き API** を再利用する（中止 UI も同契約）

---

## 設計制約（契約）

- **事前条件**: API キーあり・結合画像（`resultImage`）ありで OCR を開始できること
- **事後条件（成功）**: 有効セッションのみ `umaData` 更新・完了 toast・`isOcrProcessing === false`
- **事後条件（中止）**: `umaData === null`・中止 toast（success）・`isOcrProcessing === false`・再 OCR 可能
- **不変条件**:
  - `AbortSignal` 契約: `page.tsx` が `AbortController` を保持し、OCR 開始時に新規作成して `analyzeStitchedImage(apiKey, dataUrl, { signal })` に渡す。`geminiOcr` 内で Controller をシングルトン生成しない
  - 同一 `signal` を primary・fallback 両方の `fetch` に渡す
  - primary 失敗後に fallback する前に `signal.aborted` なら AbortError 相当で打ち切り（fallback を呼ばない）
  - AbortError / `name === 'AbortError'` / DOMException abort は `ApiError(429/503)` に変換せず、そのまま再 throw
  - プロンプト本文・JSON スキーマ・`fuzzyMatcher`・モデル構成は変更しない
  - abort 後に遅延成功しても結果を破棄する（`setUmaData` しない）
- **異常時の保証**: 本物の API/ネットワークエラーは既存文言を維持。中止は error toast にしない

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/lib/geminiOcr.ts` | `options.signal` 受付・fetch 渡し・Abort 区別・fallback 前 aborted チェック |
| `desktop-app/app/(main)/page.tsx` | AbortController 保持・中止ハンドラ・結果破棄・toast 分岐 |
| `desktop-app/app/components/CapturePanel.tsx` | 解析中「停止」UI・`onOcrCancel` |
| `docs/TODO.md` / `docs/tasks/INDEX.md` | 着手・完了同期 |
| `docs/reference/SYSTEM_SPECIFICATION.md` | 完了時に実装済みへ |

---

## 永続正本同期（エージェント必須）

| トリガー | 更新先 |
|----------|--------|
| 着手 | `TODO.md` 進行中、本 REQ、`INDEX.md` |
| 実装完了 | 本 REQ 決定ログ、`TODO.md` 完了済み、`INDEX.md` |
| OCR 中止機能の実装完了 | [`SYSTEM_SPECIFICATION.md`](../reference/SYSTEM_SPECIFICATION.md) §3.2 / §3.9 |
| Phase / REQ 完了 | `CONCEPT-MAP.md`（新用語時のみ。AbortController は追記 0 件可） |

---

## 完了条件

- [x] `docs/TODO.md` Backlog に起票と同時に1行追加（`draft` 起票時必須）→ 着手時に進行中へ
- [x] 「設計制約（契約）」を記入し、完成プロンプト（Q1〜Q8）で合意済み
- [x] 解析中に「停止」でき、トーストが「OCR解析を中止しました」に切り替わる（**実機 OK**）
- [x] 中止後 `isOcrProcessing` が false になり、再度 OCR を実行できる（**実機 OK**）
- [x] 中止後に遅延成功で `umaData` が載らない（**実機 OK**）
- [x] 通常完了・503/API エラー表示が退行していない（**実機 OK**）
- [x] `npm test`（desktop-app）通過（62件）
- [x] REQ 完了時: TODO を完了済みへ移動、`SYSTEM_SPECIFICATION.md` 更新
- [x] コミット
- [x] **実機検証クローズ**（2026-07-23 06:04）— 中止→再実行・通常完了・本物エラーの3系統 OK

---

## 検証手順

1. `desktop-app` で `npm test`（CHAT_TEMPLATE「検証コマンド（共通）」参照）— **62 passed**（2026-07-23 05:38）
2. 実機: 解析中に「停止」→ 中止 toast → 再 OCR 可能 — **OK**（2026-07-23 06:04）
3. 実機: 通常完了（`umaData` 表示・完了 toast）— **OK**
4. 実機: 本物エラー（503/API）が従来どおり error toast になること — **OK**

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-07-23 05:35 | 案 A（page が AbortController 保持・signal 渡し）。CapturePanel 同一ボタンで停止。AbortError は success toast。セッション世代で遅延結果破棄。Flash-Lite のみ化等はスコープ外 | 設計レビュー Q1〜Q8 承認済み |
| 2026-07-23 05:38 | 実装完了。`analyzeStitchedImage(..., { signal })`・CapturePanel「停止」・AbortError 区別。CONCEPT-MAP: 今回の用語追加なし（既存カードで十分） | `npm test` 62件 PASS。SYSTEM_SPEC §3.2/§3.9 同期 |
| 2026-07-23 06:04 | **実機検証クローズ** — 中止→再実行・通常完了・本物エラー表示の3系統すべて OK。REQ 正式クローズ | ユーザー実機確認。CONCEPT-MAP: 今回の用語追加なし（既存カードで十分） |
