# stitch-golden — オートキャプチャ結合 golden ハーネス（R0）

設計正本: [`docs/tasks/REQ-stitch-rewrite.md`](../../docs/tasks/REQ-stitch-rewrite.md)

## 目的

- **scrollStartY**（静的ヘッダー下端）の期待帯を JSON で管理
- 設計パック PNG から **OpenCV crop 相当** の計測を CLI で再現
- R1 以降の結合リライトの回帰ゲート

## ファイル

| ファイル | 内容 |
|---------|------|
| `expectations.json` | golden ID・layout・scrollStartRatio 期待帯 |
| `measure-regions.ps1` | crop 検出 + タブ行推定 + 期待値 compare |

## 使い方

リポジトリルートから:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\stitch-golden\measure-regions.ps1
```

特定ケースのみ:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\stitch-golden\measure-regions.ps1 -CaseId G-HOF-S
```

Vitest（期待値 JSON の整合・設計パック存在チェック）:

```powershell
cd desktop-app
npm run stitch:golden
```

## 出力の読み方

- **scrollStartRatio**: タブ行下端 + margin（`tabY + tabH + margin`）/ crop 高さ
- **legacyHeaderRatio**: 旧コード固定 16%（参考。合格基準ではない）
- **PASS/FAIL**: `expectations.json` の `scrollStartRatio` 帯との比較

## 注意

- 計測は **単一フレーム + タブ緑推定** が主。R1 以降は frame0↔1 absdiff を TypeScript 側の正本とする。
- 設計パック（`auto-capture-design-pack/`）が無い場合、CLI は SKIP、Vitest は `describe.skipIf` でスキップ。
