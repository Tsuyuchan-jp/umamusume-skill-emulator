# stitch モジュール（リライト中）

設計正本: [`docs/tasks/REQ-stitch-rewrite.md`](../../../../docs/tasks/REQ-stitch-rewrite.md)  
キャプチャ正本: **`wheelCore.ts`** + **`captureWheel.ts`**（M5）— **広帯 -4 / 狭帯 -3**（`scrollRegionH` しきい値 280px）。Rust は IPC 受信のみ。契約は REQ「Capture–Stitch 契約」節。

| Phase | 状態 |
|-------|------|
| R0 | golden 期待値・Vitest スモーク **done** |
| R1 | `regions.ts` scrollStartY absdiff 正本 **done** |
| R2 | `layoutOpenCv.ts` / `tabDetect.ts` 分割・走査帯正本化 **done** |
| R3 | `compose.ts` / `scrollMatch.ts`・`stitch.ts`・V2 ON **done** |
| R3.5a | `shiftEstimate*`（SSD + median）**done** |
| R3.5b | layout L2 優先・tabDetect 2タブガード **done** |
| R3.5c | -4・terminal・golden **done** |
| **R3.5d** | **frame0 帯推定・狭帯 -3**（docs 確定・実装待ち） |
| R4 | postProcess 分離・TrainingInfo |
| R5 | `opencvStitcher.ts` 削除 |

## shiftEstimate（R3.5a 正本）

- **Step B**: スクロール帯 RGBA 列の全重なり SSD（`overlapAvgDiff`）
- **Step C**: セッション `S*`（median）・外れ値 τ・末端 terminal / bound（**R3.5c-2 done**）
- **R3.5c-3**: 狭帯（`<320px`）のみ `STITCH_SHIFT_MIN_OVERLAP_RATIO` で探索上界を制約

`scrollMatch.ts` は `shiftEstimate.ts` へ委譲。

## モジュール構成

| ファイル | 責務 |
|---------|------|
| `constants.ts` | 走査帯・`STITCH_SHIFT_*` |
| `layoutCore.ts` / `layoutOpenCv.ts` | layout / tabRow（正本は Core。OpenCv は Mat 橋渡し） |
| `tabDetectCore.ts` / `tabDetect.ts` | StitchTab |
| `regionsCore.ts` / `regions.ts` | scrollStartY |
| `shiftEstimateCore.ts` / `shiftEstimate.ts` | SSD + median（正本） |
| `scrollMatch.ts` | 委譲・互換 API |
| `composeCore.ts` / `compose.ts` | 合成式・S-2・S-5・trim |
| `stitch.ts` | オーケストレータ |
| `flags.ts` | `USE_STITCH_V2 = true` |

## 合成式（正本）

```
出力 = StaticHeader(frame0, 0..scrollStartY)
     + ScrollStrip(frame0, scrollStartY..footerStart)
     + Σ append(frameN 下端 overlap)
     + Footer(frameLast)
```

公開 API: [`../opencvStitcher.ts`](../opencvStitcher.ts) → `stitch.ts`（R5 で削除予定）

## `app/` 配下のファイル名（Next.js）

`app/lib/stitch/` に **`layout.ts` / `page.ts` / `route.ts`** 等の [予約名](https://nextjs.org/docs/app/api-reference/file-conventions) を置くと、Next.js がルート用ファイルと誤認し本番ビルドが失敗する。結合モジュールは `layoutOpenCv.ts` のように予約名を避ける（2026-06-27・`0fac03e`）。
