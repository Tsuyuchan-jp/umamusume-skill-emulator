# REQ-race-detail-graph-phase2: 直近レース詳細グラフ — Phase 2 区間オーバーレイ

> **レース詳細グラフ実装シリーズ** Phase 2（コース区間の背景オーバーレイ）。
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)

- **ステータス**: done
- **作成日**: 2026-06-11 04:54
- **関連コミット**: `0af28c7`

---

## 開発フロー（シリーズ内の位置）

| 項目 | 内容 |
|------|------|
| **前** | [`REQ-race-detail-graph-phase1.md`](REQ-race-detail-graph-phase1.md)（**完了**）+ [`REQ-race-detail-graph-axis.md`](REQ-race-detail-graph-axis.md)（Y軸改善・**完了**） |
| **本 Phase** | 直線 / コーナー / 上り坂 / 下り坂の区間オーバーレイ + `trackDetail` データ |
| **次** | [`REQ-race-detail-graph-phase3.md`](REQ-race-detail-graph-phase3.md)（スキル帯・表示切替） |
| **着手順** | **Ask mode 設計レビュー** → 承認 → **Agent mode 実装**（CHAT_TEMPLATE パターン A） |

---

## 目的

Phase 1 の 3 本線グラフに、**コース形状・区間種別**を視覚的に重ね、走行の文脈（直線加速、コーナー位置等）を読み取りやすくする。

参考 UI: umasim 本家 `RaceOperation.toGraphData(frames, trackDetail)` の区間オーバーレイ相当。

---

## 背景・現状

| 項目 | 内容 |
|------|------|
| グラフ UI | Phase 1 + axis 完了 — 速度 m/s・体力/レーン %・フェーズ縦線 |
| trackData | id / name / dist / type のみ。**区間 detail なし** |
| 必要データ | 直線・コーナー・坂の区間境界（距離 or 時間軸） |

---

## スコープ

### やること

- [x] 直線 / コーナー / 上り坂 / 下り坂の区間オーバーレイ（背景色 or 帯）
- [x] `trackDetail` データ整備（WASM 出力 or 抽出 JSON）
- [x] `raceGraphBuilder.ts` / `RaceDetailChart.tsx` への区間データ組み込み

### やらないこと

- Phase 3（スキル発動帯、表示切替）— [`REQ-race-detail-graph-phase3.md`](REQ-race-detail-graph-phase3.md)
- Phase 4（baseline diff）— [`REQ-race-detail-graph-phase4.md`](REQ-race-detail-graph-phase4.md)
- Cockpit レイアウト再変更（[`REQ-fullscreen-cockpit-layout.md`](REQ-fullscreen-cockpit-layout.md) 完了済み）
- axis REQ の Y 軸・Tooltip 退行

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `public/umaemu/`（WASM） | `trackDetail` 出力拡張（要設計） |
| `app/lib/raceGraphBuilder.ts` | 区間データ変換 |
| `app/components/RaceDetailChart.tsx` | オーバーレイ描画 |
| `app/lib/types.ts` | 区間型追加（要設計） |
| 抽出 JSON / tools | trackDetail 生成（mdb 等） |

---

## 完了条件

- [x] グラフ背景に区間種別が視認できる
- [x] Phase 1 / axis のグラフ表示に退行なし
- [x] DevTools 新規警告なし
- [x] `npm run tauri dev` 実機確認
- [x] REQ ステータス `done` + `docs/TODO.md` 更新 + コミット

---

## 検証手順（草案）

1. シミュ実行後、グラフ上で直線/コーナー/坂区間が区別できる
2. コース変更時に区間が追従する
3. Tooltip・Legend・フェーズ縦線に退行なし

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-11 04:54 | Phase 2 を単体 REQ として起票（draft） | 開発フロー明確化 |
| 2026-06-11 05:45 | 案 A（WASM `setting.trackDetail` 出力）採用。静的 JSON フォールバックなし。欠落時 graceful degrade | Ask mode 設計レビュー承認 |
| 2026-06-11 07:07 | 実装完了: WasmEngine trackDetail + buildAreaBands + ReferenceArea + 左下2行ラベル。WASM 再ビルド反映（`726a1578312749b3e717.wasm`） | Agent mode 実装チャット |

---

## 参考

- 親ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
- Phase 1: [`REQ-race-detail-graph-phase1.md`](REQ-race-detail-graph-phase1.md)
- upstream: `compose/.../GraphOutput.kt`
