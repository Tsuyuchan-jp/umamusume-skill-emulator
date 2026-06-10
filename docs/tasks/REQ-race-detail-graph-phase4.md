# REQ-race-detail-graph-phase4: 直近レース詳細グラフ — Phase 4 baseline diff（核機能）

> **レース詳細グラフ実装シリーズ** Phase 4（SkillVerifier baseline 比較 — **本アプリの核機能**）。
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)

- **ステータス**: draft
- **作成日**: 2026-06-11 04:54
- **関連コミット**: （完了後に記入）

---

## 開発フロー（シリーズ内の位置）

| 項目 | 内容 |
|------|------|
| **前** | [`REQ-race-detail-graph-phase3.md`](REQ-race-detail-graph-phase3.md)（スキル帯・表示切替） |
| **本 Phase** | baseline / current の **グラフ diff**（2系列 or 差分表示） |
| **次** | （シリーズ本線完了 — 以降は改善 REQ または新機能として起票） |
| **着手順** | **Ask mode 設計レビュー（必須・高優先）** → 承認 → **Agent mode 実装** |

---

## 目的

SkillVerifier でスキル ON/OFF を比較したとき、数値 KPI だけでなく**走行グラフの差**を視覚的に確認できるようにする。本アプリの差別化・核機能。

---

## スコープ

### やること

- [ ] SkillVerifier — baseline との **グラフ diff**（2系列 or 差分表示）
- [ ] 比較検証シミュ後に baseline / current 両方の `raceDetail` を保持
- [ ] UI: 比較モードでのグラフ表示（Cockpit 右ペイン or SkillVerifier 連携 — 要設計）

### やらないこと

- Phase 2 / 3 の未実装部分を本 Phase に取り込まない（前提 Phase 完了後）
- OCR / キャプチャ / 因子 DB

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `app/components/SkillVerifier.tsx` | baseline/current raceDetail 保持・比較 UI |
| `app/components/RaceDetailChart.tsx` | 2系列 or diff 描画 |
| `app/lib/engine/umaemuAdapter.ts` | 比較 sim 時の詳細2走取得（要設計） |
| `app/lib/types.ts` | 比較用 dump 型 |

---

## 完了条件

- [ ] 比較 sim 後、baseline と current のグラフ差が確認できる
- [ ] 既存 SkillVerifier KPI 比較に退行なし
- [ ] `npm run tauri dev` 実機確認
- [ ] REQ ステータス `done` + `docs/TODO.md` 更新 + コミット

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-10 15:55 | baseline diff を Phase 4・核機能として計画 | 設計レビュー承認（phase1 REQ より継承） |
| 2026-06-11 04:54 | Phase 4 を単体 REQ として起票（draft） | 開発フロー明確化 |

---

## 参考

- 親ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
- Phase 1 決定: 詳細1走は自動取得 — Phase 4 では **2走分** 拡張が必要
