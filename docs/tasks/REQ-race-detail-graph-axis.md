# REQ-race-detail-graph-axis: レース詳細グラフ Y軸・単位改善

> レース詳細グラフの体力・レーン基準位置と速度 m/s 表示。
> 前提: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md) Phase 1 完了、Cockpit Phase 3 完了。

- **ステータス**: draft
- **作成日**: 2026-06-10 21:30
- **関連コミット**: （完了後に記入）

---

## 目的

FHD Cockpit 右ペイン運用で、レース詳細グラフの**読み取りやすさ**を改善する。

- 体力 0 の基準が中央寄りで直感と合わない
- レーン（内枠=0%）が下端付近でない
- 速度が % 表示で m/s と乖離している

---

## スコープ

### やること

- [ ] `raceGraphBuilder.ts`: 体力・レーンの表示用リマップ（0 をグラフ下端付近へ）
- [ ] `RaceDetailChart.tsx`: 複数 Y 軸（速度 m/s 左軸、体力・レーン右軸等）
- [ ] Tooltip: 速度は `m/s`、体力・レーンは % または適切な単位
- [ ] Phase 2 退行防止: Tooltip `position` / `TOOLTIP_Y_OFFSET` / `initialDimension` / z-index は維持

### やらないこと

- `desktop-app/public/umaemu/`（WASM）
- [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md) Phase 2 以降（区間オーバーレイ、スキル帯、baseline diff）
- Cockpit レイアウト・SkillVerifier の再変更

---

## 仕様（承認済み方針）

### 体力

- HP=0 をグラフ**下から約 10%** の位置にマップ
- 例: `0.1 + 0.9 * normalize(sp, 0, staminaMax)`（負値はクランプ方針を実装時に確定）

### レーン

- 0%=内枠、100%=外枠（現状の意味は維持）
- 0%（内枠）をグラフ**最下部付近**にマップ
- 例: `0.05 + 0.95 * normalize(lane...)`

### 速度

- Y 軸・Tooltip を **m/s** 表記（`SPEED_MIN=13` / `SPEED_MAX=30` 基準）
- 正規化 0–1 ではなく生値 `frame.speed` を左軸にプロット

### アーキテクチャ

- Recharts **複数 `YAxis`** + `Line` の `yAxisId` 分離
- 左: 速度 m/s、右: 体力・レーン（表示マップ済み %）

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/lib/raceGraphBuilder.ts` | リマップ・生速度フィールド |
| `desktop-app/app/components/RaceDetailChart.tsx` | 多軸・Tooltip・tickFormatter |

### 触らない

- `page.tsx` / `ResultCard.tsx` レイアウト（Phase 4 位相ラベル短縮は別コミット済みの可能性あり）
- `umaemuAdapter.ts` / `raceGraphBuilder` 以外の sim ロジック

---

## 完了条件

- [ ] 体力 0 がグラフ下端付近（~10%）に表示される
- [ ] レーン内枠（0%）がグラフ下端付近に表示される
- [ ] 速度軸・Tooltip が m/s 表記
- [ ] Tooltip 位置・Legend 重なりに Phase 2 からの退行なし
- [ ] DevTools 新規警告なし
- [ ] `npm run tauri dev` 実機確認
- [ ] REQ ステータス `done` + `docs/TODO.md` 更新 + コミット

---

## 検証手順

1. シミュ実行後、グラフで速度が m/s 目盛り
2. スタミナ切れ付近で体力線が下端付近に張り付く
3. 内枠走行時レーン線が下端付近
4. ホバー Tooltip が Legend より前面・折れ線被り軽減維持

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-10 21:30 | 多 Y 軸 + 体力/レーンリマップ + 速度 m/s | ユーザー承認（Ask mode 設計レビュー） |
| 2026-06-10 21:30 | 位相ラベル短縮・margin は別タスク（本 REQ 外で先行実装可） | Cockpit UX チャットで 1–4 対応 |

---

## 参考

- 現状の正規化: `raceGraphBuilder.ts` の `adjustRange`
- 位相ラベル見切れ: `margin.top` + 「中盤へ」「終盤へ」は Cockpit ポリッシュで対応済みの場合あり
