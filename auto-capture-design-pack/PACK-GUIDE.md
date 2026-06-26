# design-pack 運用ガイド（PACK-GUIDE）

> **人間も AI も、オートキャプチャの素材で迷ったらまずこのファイル。**
> シーン定義の正本は [`SCENE-CATALOG.md`](SCENE-CATALOG.md)。**フォルダ役割・命名・収集手順の地図はここ。**
> プロジェクト全体の docs 入口: [`docs/DOCS-GUIDE.md`](../docs/DOCS-GUIDE.md)

最終更新: 2026-06-27 04:48

---

## 30秒でわかる3層

```
┌─────────────────────────────────────────────────────────┐
│ ① シーン正本          SCENE-CATALOG.md                    │
│    画面バリエーション一覧・golden 有無・実機状態。           │
├─────────────────────────────────────────────────────────┤
│ ② 回帰用 golden       golden/ + expectations.json         │
│    Vitest 18/18。cases[].framePaths と 1:1 で対応。        │
├─────────────────────────────────────────────────────────┤
│ ③ 目視・実機証跡      screenshots/ + logs/                │
│    結合結果の目視確認・コンソール/Rust ログ・NG 再現用。     │
└─────────────────────────────────────────────────────────┘
```

**覚えることは1つでよい**: シーン追加・NG 調査 → **`SCENE-CATALOG.md`** → 必要なら **golden / screenshots / logs** を揃える → **`expectations.json`** を更新（M3 以降）。

---

## フォルダ役割

| フォルダ | 層 | 役割 | 正本性 |
|---------|-----|------|--------|
| [`SCENE-CATALOG.md`](SCENE-CATALOG.md) | ① | シーン ID・経路・タブ・partnerBand・layout・golden 有無・実機状態 | **シーン定義の唯一の正本** |
| [`golden/`](golden/) | ② | オートキャプチャ生フレーム PNG。`npm run stitch:golden` の入力 | expectations.json と 1:1 |
| [`../tools/stitch-golden/expectations.json`](../tools/stitch-golden/expectations.json) | ② | scrollStartRatio / tabRowRatio 等の計測期待値 | golden の数値正本 |
| [`screenshots/`](screenshots/) | ③ | 手動キャプチャ・結合結果・S0/S1/S2 目視用。Vitest **非参照** | 目視・設計メモ用 |
| [`logs/`](logs/) | ③ | 実機コンソール全文・Rust `[Capture]` 行・StitchLayout ログ | 実機検証・NG 再現用 |

### golden/ の現状（整理前）

| パス | expectations 参照 | 備考 |
|------|-------------------|------|
| `golden/TRN/` | G-TRN（frame_000, frame_001） | 4 枚中 2 枚が Vitest 入力 |
| `golden/FRD/skill/` | G-FRD-S（frame_000） | release 系。register 分割は **未実施** |
| `golden/FRD/factor/` | G-FRD-F（frame_000） | |
| `golden/FRD/info/` | **なし** | PNG のみ。Catalog G-FRD-I は「欠落」。**P2 で整理** |

### screenshots/ の現状

- 経路別サブフォルダ: `HOF/`, `TRN/`, `CMP/`, `FRD/`, `fullscreen/`
- 命名例: `S0-top.png`, `S1-mid.png`, `S2-bottom.png`, `stitched-OK.png`, `stitched-NG.png`
- HOF/CMP の一部ケースは **screenshots のみ**（golden 未整備）。expectations の `framePaths` がここを指す

### logs/ の現状

- **フラット命名**（例: `FRD-skill-console.txt`, `TRN-rust.txt`）
- フルスクリーン検証: `logs/fullscreen/`
- Catalog のシーン ID（`G-FRD-S-register` 等）との対応は **未整理** — P2 で `logs/G-FRD-S-register/` 形式へ移行予定

---

## 命名規則（今後の新規追加）

既存ファイルの **一括リネーム・移動は P2 以降**。以下は **新規収集時** の目標形。

### golden/

```
golden/{経路}/{タブ種別}/frame_{NNN}.png
```

| 例 | シーン ID | 意味 |
|----|-----------|------|
| `golden/FRD/skill-register/frame_000.png` | G-FRD-S-register | 緑「登録」ボタン帯あり |
| `golden/FRD/skill-release/frame_000.png` | G-FRD-S-release | 灰「解除」ボタン帯あり |
| `golden/FRD/skill/frame_000.png` | G-FRD-S（暫定） | **現状**。release/register 未分割 |
| `golden/TRN/frame_000.png` | G-TRN | 育成中 2 タブ |

- フレーム番号は `frame_000` 始まり・3 桁ゼロ埋め
- expectations.json の `framePaths` は **designPackRoot からの相対パス**

### logs/

```
logs/{シーンID}/{種別}.txt
```

| 例 | 内容 |
|----|------|
| `logs/G-FRD-S-register/console.txt` | ブラウザコンソール全文 |
| `logs/G-FRD-S-register/rust.txt` | Rust `[Capture]` 行 |
| `logs/G-FRD-S-register/stitch-layout.txt` | StitchLayout 1 行（あれば） |

シーン ID は [`SCENE-CATALOG.md`](SCENE-CATALOG.md) の `G-*` 形式に合わせる。

### screenshots/

目視用のため厳密な規則は緩いが、新規は可能な限り:

```
screenshots/{経路}/{タブ}/S{段}-.{top|mid|bottom}.png
```

結合結果: `stitched-OK.png` / `stitched-NG.png`

---

## 作業フロー

### 実機 NG を発見したとき

1. **SCENE-CATALOG** に行があるか確認。なければ **新規行追加**（上書きだけにしない）
2. `screenshots/` + `logs/` に証跡を保存（③）
3. 再現用フレームが取れるなら `golden/` に追加（②）
4. M3 以降: `expectations.json` に case 追加 → `npm run stitch:golden`

### golden 期待値を計測するとき

```powershell
# リポジトリルートから
.\tools\stitch-golden\measure-regions.ps1 -FramePath "auto-capture-design-pack/golden/FRD/skill/frame_000.png"
npm run stitch:golden
```

### AI エージェントの `@` 目安（キャプチャ結合）

| 種別 | 典型 `@` |
|------|---------|
| シーン追加・Catalog | `SCENE-CATALOG.md` + `PACK-GUIDE.md` |
| golden / 計測 | 上記 + `expectations.json` + 着手 REQ |
| 実装 | `docs/TODO.md` + REQ + `SCENE-CATALOG.md` |

詳細: [`docs/DOCS-GUIDE.md`](../docs/DOCS-GUIDE.md)

---

## P2 以降（本ガイドでは触らない）

| 項目 | 内容 |
|------|------|
| **一括リネーム** | 既存 `golden/`・`logs/`・`screenshots/` の PNG/txt 移動・リネーム |
| **Catalog とフォルダの分割** | G-FRD-S-register / G-FRD-S-release に合わせた `golden/FRD/skill-register/` 等 |
| **expectations 分割** | G-FRD-S を register/release の 2 case に |
| **未参照フォルダ整理** | `golden/FRD/info/`（expectations 未参照）、フラット logs のシーン ID 化 |
| **G-FRD-I** | 育成情報タブ — R4 スコープ |

---

## 関連リンク

| リンク | パス |
|--------|------|
| design-pack 入口 | `auto-capture-design-pack/README.md` |
| 本ガイド | `auto-capture-design-pack/PACK-GUIDE.md` |
| シーン正本 | `auto-capture-design-pack/SCENE-CATALOG.md` |
| golden 期待値 | `tools/stitch-golden/expectations.json` |
| Scene Model ロードマップ | `docs/tasks/REQ-stitch-scene-model.md` |
| 結合パイプライン REQ | `docs/tasks/REQ-stitch-rewrite.md` |
| docs 運用入口 | `docs/DOCS-GUIDE.md` |

---

## 歴史メモ（旧 README チェックリスト）

2026-06 以前、`README.md` に手作業チェックリストと方針回答 F-1〜F-5 が載っていた。内容は **記録用** にここへ移した。日常の入口には使わない。

### 収集環境（当時）

- クライアント: steam
- 表示: ウィンドウ 1602×932 px（検証中にサイズを微調整）
- フルスクリーン FHD: HOF skill + TRN skill のオートキャプチャ各 1 回（1920×1080）

### 手作業チェックリスト（2026-06 以前）

**HOF（殿堂入りステータス）**

- [x] HOF-S0.png / S1 / S2 / S3(因子)
- [x] コンソールログ / Rust ログ
- [ ] Y1〜Y10: （px）

**TRN（育成中 2 タブ）**

- [x] TRN-S0〜S3, 失敗結合, フレーム 4 枚
- [x] コンソールログ（最重要）
- [x] GOLDEN-TRN フレーム PNG

**CMP（育成完了）**

- [x] CMP-S0〜S2, 入口メモ

**FRD（フレンド）**

- [x] FRD-S0〜S2, 入口別 S0

### 方針回答 F-1〜F-5

| ID | 質問 | 回答 |
|----|------|------|
| F-1 | キャプチャ開始時、常に **スキルタブを手動で開く** 運用でよいか | はい |
| F-2 | 因子・継承・育成情報タブの中身は **今回スコープ外** でよいか | いいえ。継承タブが存在する場所では継承タブもスコープ内 |
| F-3 | 結合修正を capture プロファイルと **同時** にやるか、**結合だけ先** にやるか | 結合先 |
| F-4 | プロファイル判定不能時は **汎用（安全側）** と **殿堂入り** どちらに倒すか | 汎用（安全側） |
| F-5 | 対象環境は **1 解像度のみ** でよいか | フルスクリーンとウィンドウ両方。FS は FHD のみ。ウィンドウ解像度は未確定 |
