# REQ-capture-skip-disk-save: オートキャプチャ結合画像のディスク非保存オプション

> 設定で結合画像の PC ディスク保存をスキップし、OCR 用メモリ上プレビューは維持する（案 A・フロントのみ v1）。
> 設計レビュー承認済み。正本: 本 REQ + 完成プロンプト。

- **ステータス**: done（**実機検証クローズ** 2026-08-05 18:26）
- **作成日**: 2026-08-05 17:56
- **関連コミット**: `040bcf4`

---

## 解くべき問題と目的（Problem Framing）

- **現状の課題**: オートキャプチャ完了後、結合 PNG は必ず `saveFolder` 指定時は Rust `save_stitched_image`、未指定時はブラウザダウンロードへ保存される。OCR のみ欲しい場合でもディスクに残る
- **目的**: 設定で結合画像のディスク保存をスキップし、メモリ上の `resultImage`（dataUrl）とプレビュー・OCR 経路は従来どおり維持する

---

## スコープ

### やること

- localStorage キー `skipStitchedDiskSave`（`true` = 結合 PNG をディスクに保存しない。デフォルト `false`）
- `useCapture.handleSaveAndCopy` で ON 時は `save_stitched_image` とブラウザ download の両方をスキップ。`stitchImages` と `resultImage` は従来どおり生成
- `saveFolder` の localStorage 値は保持するが、非保存 ON 時は使用しない
- SettingsPanel で保存先フォルダ UI を disabled＋説明表示。非保存トグルを追加
- 完了メッセージ（非保存時）: 「画像の結合が完了しました（ディスクには保存していません）」
- CHANGELOG Unreleased にユーザー向け1行追記

### やらないこと

- 自動コピー・ファイル OCR 経路（`resultImageFromFile`）の変更
- 一時フレーム PNG（`app_cache_dir`）の削除・`capture.rs` / `stitch.rs` の変更
- 手動スクロールキャプチャ（`start_capture_session`）の UI 配線（分岐は `handleSaveAndCopy` 共通のまま）

---

## 仕様

### 設定

| キー | 型 | デフォルト | 意味 |
|------|-----|----------|------|
| `skipStitchedDiskSave` | boolean 文字列 | `false` | `true` のとき結合 PNG をディスクに保存しない |

### handleSaveAndCopy

| `skipStitchedDiskSave` | stitch | save_stitched_image / download | resultImage | 完了メッセージ |
|------------------------|--------|-------------------------------|-------------|----------------|
| `false` | 実行 | 従来どおり | 設定 | 「画像の結合と保存が完了しました！」 |
| `true` | 実行 | スキップ | 設定 | 「画像の結合が完了しました（ディスクには保存していません）」 |

### SettingsPanel

- 「結合画像をディスクに保存しない」チェックボックス
- ON 時: 保存先フォルダ行を disabled、説明「非保存 ON のため使用しません（設定値は保持されます）」

### 不変

- `autoCopyEnabled` / クリップボード自動コピー
- `resultImageFromFile` 経路（ファイル OCR）
- Rust 側一時フレームの書き込み

---

## 設計制約（契約）

- **事前条件**: オートキャプチャ完了後 `handleSaveAndCopy` が呼ばれる
- **事後条件**: 非保存 ON でも `captureStatus === "saved"` かつ `resultImage` が dataUrl で設定される
- **不変条件**: `stitchImages` の入出力契約、OCR 入力（`resultImage`）、autoCopy 判定（`resultImageFromFile` 除外）
- **異常時の保証**: stitch 失敗時は従来どおり `captureError` 表示。ディスク保存スキップは stitch 成功後のみ

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/hooks/useCapture.ts` | 非保存分岐・完了メッセージ |
| `desktop-app/app/(main)/page.tsx` | localStorage 状態・ハンドラ |
| `desktop-app/app/components/SettingsPanel.tsx` | トグル・保存先 disabled |
| `desktop-app/app/components/CapturePanel.tsx` | props 受け渡し |
| `docs/tasks/REQ-capture-skip-disk-save.md` | 本 REQ |
| `docs/TODO.md` | 着手・完了 |
| `docs/CHANGELOG.md` | Unreleased |

---

## 永続正本同期（エージェント必須）

| トリガー | 更新先 |
|----------|--------|
| 着手 | `TODO.md` 進行中 |
| 実装完了 | 本 REQ 決定ログ、`TODO.md`、`CHANGELOG.md` Unreleased |
| Phase / REQ 完了 | CONCEPT-MAP 検討（新用語なし想定） |

---

## 完了条件

- [x] `docs/TODO.md` Backlog に起票と同時に1行追加（`draft` 起票時必須）
- [x] 「設計制約（契約）」記入・承認済み
- [x] 実機確認（自動キャプチャ・非保存 ON/OFF）
- [x] REQ 完了時: TODO を完了済みへ移動
- [x] コミット

---

## 検証手順

1. `desktop-app` で `npm test` — 退行なし
2. `tauri dev` — 設定「結合画像をディスクに保存しない」ON → 自動キャプチャ → プレビュー表示・完了メッセージ・ディスクに factor_*.png が増えないこと
3. 同設定 OFF → 従来どおり保存（saveFolder またはダウンロード）
4. 非保存 ON でも自動コピー・OCR が動作すること
5. 「画像ファイルを開く」経路は退行なし

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-08-05 17:56 | 案 A（フロントのみ）を v1 とする | Rust 一時フレーム削除はスコープ外。OCR 用メモリプレビューが主目的 |
| 2026-08-05 17:56 | `saveFolder` 値は保持し UI のみ disabled | 非保存 OFF に戻したとき即復帰 |
| 2026-08-05 17:56 | 手動スクロールキャプチャは実機検証対象外 | UI 未配線。`handleSaveAndCopy` 共通分岐で将来も有効 |
| 2026-08-05 18:26 | **実機検証クローズ（ユーザー確認）** — 非保存 ON/OFF・プレビュー・ディスク非保存・自動コピー・OCR・ファイル OCR 経路すべて OK | verify-close |
