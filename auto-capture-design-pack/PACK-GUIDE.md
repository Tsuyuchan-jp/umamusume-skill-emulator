# design-pack 運用ガイド（PACK-GUIDE）

> **オートキャプチャ結合の素材で迷ったらまずこのファイル。**
> プロジェクト docs: [`docs/DOCS-GUIDE.md`](../docs/DOCS-GUIDE.md)

最終更新: 2026-06-27 05:12

---

## 2層構成

```
┌─────────────────────────────────────────────────────────┐
│ ① シーン正本          SCENE-CATALOG.md                    │
│    画面バリエーション・golden 有無・実機状態               │
├─────────────────────────────────────────────────────────┤
│ ② 回帰用 golden       golden/ + expectations.json         │
│    Vitest 18/18。cases[].framePaths と 1:1               │
└─────────────────────────────────────────────────────────┘
```

**覚えること**: シーン追加 → **SCENE-CATALOG** → **golden/** に PNG → **expectations.json** 更新 → `npm run stitch:golden`

---

## フォルダ一覧

| パス | 役割 |
|------|------|
| [`SCENE-CATALOG.md`](SCENE-CATALOG.md) | シーン ID・layout・partnerBand・実機状態の正本 |
| [`golden/`](golden/) | オートキャプチャ生フレーム PNG（Vitest 入力） |
| [`../tools/stitch-golden/expectations.json`](../tools/stitch-golden/expectations.json) | scrollStartRatio 等の数値期待値 |

**含めないもの**: 実機ログ・目視用スクショは **チャット報告**（`StitchLayout=...` + `[Capture] ...`）で足りる。design-pack には載せない。

---

## golden/ 命名規則

```
golden/{経路}/{タブ}/frame_{NNN}.png
```

| 例 | シーン ID |
|----|-----------|
| `golden/HOF/skill/frame_000.png` | G-HOF-S |
| `golden/HOF/factor/frame_000.png` | G-HOF-F |
| `golden/CMP/skill/frame_000.png` | G-CMP-S |
| `golden/TRN/frame_000.png` | G-TRN |
| `golden/FRD/skill/frame_000.png` | G-FRD-S（release/register 分割前） |
| `golden/FRD/factor/frame_000.png` | G-FRD-F |
| `golden/FRD/skill-register/frame_000.png` | G-FRD-S-register（M1 以降） |

- 3 桁ゼロ埋め（`frame_000` 始まり）
- `expectations.json` の `framePaths` は **designPackRoot からの相対パス**

---

## 作業フロー

### 新シーンを golden 化するとき

1. [`SCENE-CATALOG.md`](SCENE-CATALOG.md) に行を追加または更新
2. 実機オートキャプチャ → `golden/.../frame_*.png` を commit
3. `expectations.json` に case 追加（または `framePaths` 更新）
4. 計測: `.\tools\stitch-golden\measure-regions.ps1 -FramePath "auto-capture-design-pack/golden/..."`
5. `npm run stitch:golden`（desktop-app で実行）

### 実機 NG の報告（design-pack 不要）

[`docs/CHAT_TEMPLATE.md`](../docs/CHAT_TEMPLATE.md) の NG 報告形式 + 次の 2 行をチャットに貼る:

```
[Capture] scrollRegion=... wheel=... reason=...
StitchLayout=..., tabY=...(0.xxx), scrollStartY=...(0.xxx), scrollRegion=...px
```

---

## 関連リンク

| リンク | パス |
|--------|------|
| 入口 | `auto-capture-design-pack/README.md` |
| Scene Model | `docs/tasks/REQ-stitch-scene-model.md` |
| 結合パイプライン | `docs/tasks/REQ-stitch-rewrite.md` |
