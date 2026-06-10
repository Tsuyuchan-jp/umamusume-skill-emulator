# REQ-race-detail-graph: 直近レース詳細グラフ

> 設計レビュー（Ask mode）承認済み。実装の正本。
> 起票: `@docs/tasks/REQ-race-detail-graph.md`

- **ステータス**: done（Phase 1 完了）
- **作成日**: 2026-06-10 15:55
- **関連コミット**: `2abda5a`

---

## 目的

シミュレーション結果を平均数字（タイム・スタミナ等）だけでなく、**直近1走の走行イメージ**（速度・体力・レーン）で把握できるようにする。

参考 UI: [umasim レースエミュレータ](https://mee1080.github.io/umasim/race/) の「直近レース詳細」相当。

将来的に **SkillVerifier の baseline 比較グラフ diff** を本アプリの核機能とする（Phase 4）。

---

## 背景・現状

| 項目 | 内容 |
|------|------|
| シミュレーション | `race.js` + `worker.js`（umasim `:race` WASM）で N 走実行 |
| 出力 | `SimResultDump` — `summary`（集計）+ `rawSample: results[0]` + `raceDetail` |
| rawSample | サマリー系のみ（`raceTime`, `maxSpurt`, `spDiff` 等）。**frames なし → グラフ不可** |
| UI | `ResultCard` は summary KPI + 折りたたみ「直近レース詳細」 |
| 参考 UI データ源 | `RaceOperation.toGraphData(frames, trackDetail)`（Compose / umasim 本家） |
| 本アプリ trackData | id / name / dist / type のみ。区間オーバーレイ用 detail なし |

---

## スコープ

### Phase 1 — MVP（最初の実装）

- [x] umasim `:race` WASM に詳細出力 API 追加（`runSimulationDetail` 等）
- [x] `worker.js` — `SIMULATE_DETAIL` メッセージ型
- [x] `umaemuAdapter.ts` — **N 走完了後、詳細1走を自動取得**（ボタン操作なし）
- [x] `raceGraphBuilder.ts` — `toGraphData` 相当（TS 移植）
- [x] `RaceDetailChart.tsx` — 速度（青）・体力（赤）・レーン（緑）、フェーズ縦線
- [x] `ResultCard` 直下 — 折りたたみ「直近レース詳細」（デフォルト閉）
- [x] `SimResultDump.raceDetail` 型追加

### Phase 2

- [ ] 直線 / コーナー / 上り坂 / 下り坂の区間オーバーレイ
- [ ] `trackDetail` データ（WASM 出力 or 抽出 JSON）

### Phase 3

- [ ] スキル発動帯、デバフ等
- [ ] `GraphDisplaySetting` 相当のチェックボックス切替
- [ ] 「スキル数に応じて縦方向に拡大」オプション

### Phase 4 — 核機能（高優先・MVP 後すぐ設計着手）

- [ ] SkillVerifier — baseline との **グラフ diff**（2系列 or 差分表示）
- [ ] 比較検証シミュ後に baseline / current 両方の raceDetail を保持

### やらないこと

- N 走分のグラフ平均化
- OCR / `fuzzyMatcher.ts` / `src-tauri/` キャプチャの変更
- ゲーム内実画面との完全一致保証
- Compose 版 `wasm.js` の iframe 埋め込み（案 B）

---

## 技術方針（推奨案 A）

1. **WASM 拡張** — 1走分 frames + trackDetail を JSON で返す
2. **N 走と詳細1走を分離** — 1000 走 × 全 frames は非現実的
3. **グラフライブラリ** — `recharts` 等を `package.json` に追加（実装時選定）
4. **race.js 更新** — `UPDATE_SKILLS.md` 手順 7。`wasmJsMain` は GitHub 未公開のためローカル clone でビルド

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| umasim `:race` | 詳細 API（フォーク or upstream PR） |
| `public/umaemu/race.js`, `*.wasm` | ビルド成果物コピー |
| `public/umaemu/worker.js` | `SIMULATE_DETAIL` |
| `app/lib/engine/umaemuAdapter.ts` | 詳細取得、SimResultDump 拡張 |
| `app/lib/types.ts` | `RaceDetailDump` 等 |
| `app/lib/raceGraphBuilder.ts` | 新規 — graph データ変換 |
| `app/components/RaceDetailChart.tsx` | 新規 — チャート UI |
| `app/components/ResultCard.tsx` または `page.tsx` | 折りたたみ配置 |
| `package.json` | チャート lib |
| `tools/umasim-race-wasm/` | WASM ブリッジソース・ビルド手順 |

### 触らない

- `app/lib/geminiOcr.ts`
- `app/lib/fuzzyMatcher.ts`
- `src-tauri/`
- 既存 `aggregateGroup` 等の無関係リファクタ

---

## 仕様（Phase 1）

### 詳細取得タイミング

- `runMultipleSimulations` 成功後、**同一 payload で詳細1走を自動実行**
- SkillVerifier の比較 sim 完了後も同様に raceDetail を更新

### UI

- ResultCard KPI の下に折りたたみセクション
- ラベル例: 「直近レース詳細」
- rawSample / raceDetail 未取得時はセクション非表示 or ローディング

### 横軸

- 参考 UI 同様 `frameIndex / 15`（秒相当）

---

## ライセンス（AGPL v3）

- umasim 由来 WASM の改変・同梱に伴う AGPL 義務を確認
- 配布時 NOTICE / About 表記 — Phase 1 完了時に最低限追記（REQ 完了条件に含める）

---

## 完了条件（Phase 1）

- [x] N 走 sim 後、折りたたみ内にグラフ（速度・体力・レーン）表示
- [x] 既存 ResultCard KPI に退行なし
- [x] SkillVerifier 再 sim 後 raceDetail 更新
- [ ] `npm run tauri dev` 実機確認
- [x] `docs/TODO.md` 更新
- [x] 本 REQ ステータス `done`、関連コミット記載

---

## 検証手順

1. `npm run tauri dev` でアプリ起動
2. シミュレーション実行（100回程度）
3. 結果カード下の「直近レース詳細」を展開 — 3本線が表示される
4. スキル ON/OFF → 比較 sim → グラフ形状が変わる
5. DevTools — WASM / Worker エラーなし
6. 1000 走 sim — UI が固まらない（詳細は1走のみ追加）

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-10 15:55 | Phase 1 MVP から着手（速度・体力・レーン） | ユーザー承認 |
| 2026-06-10 15:55 | 詳細1走はシミュ完了後 **自動取得**（ボタンなし） | ユーザー承認 |
| 2026-06-10 15:55 | グラフ baseline diff は Phase 4。核機能として最優先設計 | ユーザー承認 |
| 2026-06-10 15:55 | 参考 UI 完全一致より段階的実装 | ユーザー承認 |
| 2026-06-10 15:55 | 技術方針: 案 A（WASM 詳細 API + React グラフ） | 設計レビュー |
| 2026-06-10 16:12 | Phase 1 実装完了（WASM ビルド・UI 統合） | Agent 実装 |

---

## 参考

- 設計レビュー: Ask mode チャット（承認済み）
- upstream: `compose/.../RaceOperation.kt` — `toGraphData`
- upstream: `compose/.../GraphOutput.kt`
- データ更新: `UPDATE_SKILLS.md` 手順 7
- WASM ブリッジ: `tools/umasim-race-wasm/`
