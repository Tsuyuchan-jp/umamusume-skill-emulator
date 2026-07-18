# REQ-release-v1.2.0: v1.2.0 リリース（stitch 末端修正 + UI ポリッシュ + ビルド）

> v1.1.1 以降の master を **v1.2.0 としてリリース** するための作業正本。
> 長距離 sim（中山3600m）は **v1.2.0 スコープ外** — 次回バージョンで対応（ユーザー承認 2026-07-18）。

- **ステータス**: done
- **作成日**: 2026-07-18 21:18
- **関連コミット**: `58873a5`

---

## 目的

v1.1.1 以降に積み上がったオートキャプチャ末端結合修正・Tab Arrival・UI ポリッシュ・sim エラー表示改善を **v1.2.0 としてユーザー向けリリース** する。

---

## スコープ

### v1.2.0 でやること

- stitch 末端二重結合修正（案 A′ + 案 A2a）— 実機検証済み
- Tab Arrival Phase A、飛翔アニメ削除、ステータス条件ボタン、エラートースト改善
- sim Worker 実エラー伝播・超長距離向け日本語文言
- `1.2.0` bump（`package.json` 正本）、CHANGELOG 追記、`npm run build:release-exe`

### v1.2.0 でやらないこと

- 長距離 sim（中山3600m）根本原因の解消 — **次回バージョン**（`REQ-long-distance-sim-error.md` 継続）
- Tab Arrival Phase B（ヘッダーフラッシュ・KPI ポップ）
- スキル獲得画面 OCR → SP 算出
- スキルデータ更新（2042件のまま）

---

## 完了条件

- [x] `desktop-app/package.json` → `1.2.0`
- [x] `docs/CHANGELOG.md` に v1.2.0 節
- [x] `npm test` 通過（`version.test.ts` 含む）
- [x] `npm run build:release-exe` で `app.exe` 生成
- [x] UI ヘッダー `v1.2.0` 表示（`APP_VERSION_LABEL` 経由）
- [x] `docs/TODO.md` 完了済み行にコミットハッシュ（`58873a5`）

---

## 決定事項ログ

| 日時 | 内容 |
|------|------|
| 2026-07-18 21:18 | ユーザー承認。長距離 sim は v1.2.0 に含めず次回バージョンへ延期 |
| 2026-07-18 21:24 | `npm test` 62件 PASS・`build:release-exe` 成功（`app.exe` 2026-07-18 21:24） |
| 2026-07-18 21:18 | CONCEPT-MAP: 今回の用語追加なし（既存カードで十分） |
