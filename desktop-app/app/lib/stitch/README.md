# stitch モジュール（リライト中）

設計正本: [`docs/tasks/REQ-stitch-rewrite.md`](../../../../docs/tasks/REQ-stitch-rewrite.md)

| Phase | 状態 |
|-------|------|
| R0 | golden 期待値・Vitest スモーク |
| R1 | `regions.ts` scrollStartY absdiff 正本（`USE_STITCH_V2`） |
| R2 | `layout.ts` / `tabDetect.ts` 分割・走査帯正本化 |
| R3 | `compose.ts` / `scrollMatch.ts`・`stitch.ts` オーケストレータ・V2 ON |

## モジュール構成（R3）

| ファイル | 責務 |
|---------|------|
| `constants.ts` | 走査帯・閾値・継承 S-5 定数 |
| `layoutCore.ts` / `layout.ts` | layout / tabRow（RGBA + OpenCV 薄ラッパー） |
| `tabDetectCore.ts` / `tabDetect.ts` | StitchTab |
| `regionsCore.ts` / `regions.ts` | scrollStartY（RGBA 正本 + OpenCV 薄ラッパー） |
| `scrollMatchCore.ts` / `scrollMatch.ts` | NCC + S-4 absdiff（スクロール帯 ROI） |
| `composeCore.ts` / `compose.ts` | REQ 正本合成式・S-2 バー隠し・余白トリム |
| `stitch.ts` | オーケストレータ（継承 S-5 は最終段） |
| `flags.ts` | `USE_STITCH_V2 = true` |

## 合成式（正本）

```
出力 = StaticHeader(frame0, 0..scrollStartY)
     + ScrollStrip(frame0, scrollStartY..footerStart)
     + Σ append(frameN 下端 overlap)
     + Footer(frameLast)
```

公開 API: [`../opencvStitcher.ts`](../opencvStitcher.ts) は `stitch.ts` へ委譲（R5 で削除予定）
