# stitch モジュール（リライト中）

設計正本: [`docs/tasks/REQ-stitch-rewrite.md`](../../../../docs/tasks/REQ-stitch-rewrite.md)

| Phase | 状態 |
|-------|------|
| R0 | golden 期待値・Vitest スモーク |
| R1 | `regions.ts` scrollStartY absdiff 正本（`USE_STITCH_V2`） |
| R2 | `layout.ts` / `tabDetect.ts` 分割・走査帯正本化 |
| R3 | `compose.ts` / `scrollMatch.ts`・`stitch.ts` オーケストレータ・V2 ON |
| **R3.5a** | **`shiftEstimate*`（SSD + median）** — scrollMatch 内部委譲・golden 15/15 |
| R3.5b | layout L2 優先・tabDetect 2タブガード（TRN） |
| R3.5c | 実機 Step 3–4–6 再検証 |

## shiftEstimate（R3.5a 正本）

- **Step B**: スクロール帯 RGBA 列の全重なり SSD（`overlapAvgDiff`）。NCC 下端テンプレートは廃止
- **Step C**: セッション `S*`（median）・外れ値 τ・高側誤ピーク時のアンカー再探索・末端 terminal / bound
- `scrollMatch.ts` は `shiftEstimate.ts` へ委譲（`scrollMatchCore.ts` は非推奨・参照のみ）

## モジュール構成

| ファイル | 責務 |
|---------|------|
| `constants.ts` | 走査帯・閾値・`STITCH_SHIFT_*` |
| `layoutCore.ts` / `layout.ts` | layout / tabRow（RGBA + OpenCV 薄ラッパー） |
| `tabDetectCore.ts` / `tabDetect.ts` | StitchTab |
| `regionsCore.ts` / `regions.ts` | scrollStartY（RGBA 正本 + OpenCV 薄ラッパー） |
| **`shiftEstimateCore.ts` / `shiftEstimate.ts`** | **全重なり SSD + セッション median（正本）** |
| `scrollMatch.ts` | `estimateShiftFrames` への薄い委譲・`ScrollMatchResult` 互換 |
| `scrollMatchCore.ts` | 旧 NCC 実装（非推奨・テスト参照用） |
| `composeCore.ts` / `compose.ts` | REQ 正本合成式・S-2 バー隠し・余白トリム |
| `stitch.ts` | オーケストレータ（`shiftEstimate: S*` ログ） |
| `flags.ts` | `USE_STITCH_V2 = true` |

## 合成式（正本）

```
出力 = StaticHeader(frame0, 0..scrollStartY)
     + ScrollStrip(frame0, scrollStartY..footerStart)
     + Σ append(frameN 下端 overlap)
     + Footer(frameLast)
```

公開 API: [`../opencvStitcher.ts`](../opencvStitcher.ts) は `stitch.ts` へ委譲（R5 で削除予定）
