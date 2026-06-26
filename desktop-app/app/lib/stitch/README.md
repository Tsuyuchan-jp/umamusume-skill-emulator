# stitch モジュール（リライト中）

設計正本: [`docs/tasks/REQ-stitch-rewrite.md`](../../../../docs/tasks/REQ-stitch-rewrite.md)

| Phase | 状態 |
|-------|------|
| R0 | golden 期待値・Vitest スモーク |
| R1 | `regions.ts` scrollStartY absdiff 正本（`USE_STITCH_V2`） |
| R2 | `layout.ts` / `tabDetect.ts` 分割・走査帯 0.28–0.48 正本化 |

## モジュール構成（R2）

| ファイル | 責務 |
|---------|------|
| `constants.ts` | 走査帯・partner 帯・閾値定数（measure-regions.ps1 と同期） |
| `layoutCore.ts` | layout / tabRow 判定（RGBA・Vitest 用） |
| `layout.ts` | OpenCV Mat ラッパ |
| `tabDetectCore.ts` | 緑プロファイル走査・StitchTab（RGBA） |
| `tabDetect.ts` | OpenCV Mat ラッパ |
| `regions.ts` | scrollStartY absdiff 正本（R2 不変更） |

現行結合: [`../opencvStitcher.ts`](../opencvStitcher.ts)（layout/tabDetect は re-export）
