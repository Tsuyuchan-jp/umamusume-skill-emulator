# REQ-race-detail-graph-phase4: 直近レース詳細グラフ — Phase 4 baseline diff（核機能）

> **レース詳細グラフ実装シリーズ** Phase 4（SkillVerifier baseline 比較 — **本アプリの核機能**）。
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)

- **ステータス**: done
- **作成日**: 2026-06-11 04:54
- **関連コミット**: （完了コミット後に記入）

---

## 開発フロー（シリーズ内の位置）

| 項目 | 内容 |
|------|------|
| **前** | [`REQ-race-detail-graph-phase3.md`](REQ-race-detail-graph-phase3.md)（スキル帯・表示切替） |
| **本 Phase** | baseline / current の **グラフ diff**（2系列オーバーレイ） |
| **次** | （シリーズ本線完了 — 以降は改善 REQ または新機能として起票） |
| **着手順** | Ask mode 設計レビュー（完了）→ Agent mode 実装 |

---

## 目的

SkillVerifier でスキル ON/OFF を比較したとき、数値 KPI だけでなく**走行グラフの差**を視覚的に確認できるようにする。本アプリの差別化・核機能。

---

## スコープ

### やること

- [x] グラフ 2系列オーバーレイ（current 実線 / baseline 破線・opacity 0.5）
- [x] 比較検証シミュ後に baseline / current 両方の `raceDetail` を表示
- [x] 初回 sim 時 `baselineResult = structuredClone(simResult)`
- [x] `raceGraphBuilder` index 基準マージ・Tooltip baseline 併記・Legend 線種凡例
- [x] 比較前・リセット後は単一系列（`graphCompareActive` + applied スキル状態）

### やらないこと

- 差分線のみ・手動 compare トグル
- SkillVerifier UI 変更
- Phase 3 UX（スキル帯・checkbox・縦拡大）変更
- OCR / キャプチャ / 因子 DB

---

## 触ったファイル

| ファイル | 変更内容 |
|---------|---------|
| `app/lib/raceGraphBuilder.ts` | `mergeBaselineGraphPoints`・GraphPoint baseline フィールド |
| `app/components/RaceDetailChart.tsx` | 破線3系列・Tooltip・Legend・memo 比較 |
| `app/components/ResultCard.tsx` | `baseline.raceDetail` 渡し・subtitle・`graphCompareActive` |
| `app/components/SimulationLauncher.tsx` | 初回 `structuredClone` |
| `app/(main)/page.tsx` | `graphCompareActive` 算出（最小変更） |

---

## 完了条件

- [x] 比較 sim 後、baseline と current のグラフ差が確認できる
- [x] 比較前・リセット後は単一系列のみ
- [x] 既存 SkillVerifier KPI 比較・Phase 3 UX に退行なし（コード上）
- [x] `npm run build` 通過
- [ ] `npm run tauri dev` 実機確認（50+ スキル・比較検証フロー）— ユーザー確認待ち
- [x] REQ ステータス `done` + `docs/TODO.md` 更新 + コミット

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-10 15:55 | baseline diff を Phase 4・核機能として計画 | 設計レビュー承認（phase1 REQ より継承） |
| 2026-06-11 04:54 | Phase 4 を単体 REQ として起票（draft） | 開発フロー明確化 |
| 2026-06-12 01:04 | 2系列オーバーレイのみ・compare 自動 ON・index マージ・スキルは current のみ | Ask mode Q1〜Q7 推奨案で確定 |
| 2026-06-12 01:04 | `graphCompareActive` = simResult≠baseline かつ applied スキル変更あり | 初回 structuredClone 後も比較前は単一系列を維持 |

---

## 参考

- 親ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
- Phase 1 決定: 詳細1走は自動取得 — Phase 4 では baseline はキャッシュ、current のみ WASM detail 1回
