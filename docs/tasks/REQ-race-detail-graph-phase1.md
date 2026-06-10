# REQ-race-detail-graph-phase1: 直近レース詳細グラフ — Phase 1 MVP

> **レース詳細グラフ実装シリーズ** Phase 1（3本線グラフの初回実装）。
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)

- **ステータス**: done
- **作成日**: 2026-06-10 15:55
- **関連コミット**: `2abda5a`

---

## 開発フロー（シリーズ内の位置）

| 項目 | 内容 |
|------|------|
| **前** | （なし — シリーズ起点） |
| **本 Phase** | WASM 詳細1走 + 速度・体力・レーン 3本線 + 折りたたみ UI |
| **次** | [`REQ-race-detail-graph-axis.md`](REQ-race-detail-graph-axis.md)（Y軸改善・**完了**）→ [`REQ-race-detail-graph-phase2.md`](REQ-race-detail-graph-phase2.md) |
| **着手順** | 設計レビュー（Ask）→ 実装（Agent）— 本 Phase は完了済み |

---

## 目的

シミュレーション結果を平均数字（タイム・スタミナ等）だけでなく、**直近1走の走行イメージ**（速度・体力・レーン）で把握できるようにする。

参考 UI: [umasim レースエミュレータ](https://mee1080.github.io/umasim/race/) の「直近レース詳細」相当。

---

## スコープ

### やること

- [x] umasim `:race` WASM に詳細出力 API 追加（`runSimulationDetail` 等）
- [x] `worker.js` — `SIMULATE_DETAIL` メッセージ型
- [x] `umaemuAdapter.ts` — **N 走完了後、詳細1走を自動取得**（ボタン操作なし）
- [x] `raceGraphBuilder.ts` — `toGraphData` 相当（TS 移植）
- [x] `RaceDetailChart.tsx` — 速度（青）・体力（赤）・レーン（緑）、フェーズ縦線
- [x] `ResultCard` 直下 — 折りたたみ「直近レース詳細」（デフォルト閉）
- [x] `SimResultDump.raceDetail` 型追加

### やらないこと

- N 走分のグラフ平均化
- Phase 2 以降（区間オーバーレイ、スキル帯、baseline diff）— 各 Phase REQ 参照
- OCR / `fuzzyMatcher.ts` / `src-tauri/` キャプチャの変更

---

## 仕様

### 詳細取得タイミング

- `runMultipleSimulations` 成功後、**同一 payload で詳細1走を自動実行**
- SkillVerifier の比較 sim 完了後も同様に raceDetail を更新

### UI

- ResultCard KPI の下に折りたたみセクション（後に Cockpit 常時表示へ移行）
- rawSample / raceDetail 未取得時はセクション非表示 or ローディング

### 横軸

- `frameIndex / 15`（秒相当）

---

## 触るファイル

| ファイル | 変更内容 |
|---------|---------|
| umasim `:race` | 詳細 API |
| `public/umaemu/race.js`, `*.wasm` | ビルド成果物 |
| `public/umaemu/worker.js` | `SIMULATE_DETAIL` |
| `app/lib/engine/umaemuAdapter.ts` | 詳細取得 |
| `app/lib/types.ts` | `RaceDetailDump` |
| `app/lib/raceGraphBuilder.ts` | graph データ変換 |
| `app/components/RaceDetailChart.tsx` | チャート UI |
| `app/components/ResultCard.tsx` | 折りたたみ配置 |

---

## 完了条件

- [x] N 走 sim 後、グラフ（速度・体力・レーン）表示
- [x] 既存 ResultCard KPI に退行なし
- [x] SkillVerifier 再 sim 後 raceDetail 更新
- [x] `docs/TODO.md` 更新
- [x] 本 REQ ステータス `done`、関連コミット記載

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-10 15:55 | Phase 1 MVP から着手（速度・体力・レーン） | ユーザー承認 |
| 2026-06-10 15:55 | 詳細1走はシミュ完了後 **自動取得**（ボタンなし） | ユーザー承認 |
| 2026-06-10 15:55 | グラフ baseline diff は Phase 4。核機能として最優先設計 | ユーザー承認 |
| 2026-06-10 15:55 | 技術方針: 案 A（WASM 詳細 API + React グラフ） | 設計レビュー |
| 2026-06-10 16:12 | Phase 1 実装完了（WASM ビルド・UI 統合） | Agent 実装 |
| 2026-06-11 04:54 | 親 REQ から Phase 1 単体 REQ に分割 | 開発フロー明確化 |

---

## 参考

- upstream: `compose/.../RaceOperation.kt` — `toGraphData`
- WASM ブリッジ: `tools/umasim-race-wasm/`
- データ更新: `UPDATE_SKILLS.md` 手順 7
