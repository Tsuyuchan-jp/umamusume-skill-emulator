# REQ-race-detail-graph-axis: レース詳細グラフ Y軸・単位改善

> レース詳細グラフの体力・レーン基準位置と速度 m/s 表示。
> 前提: [`REQ-race-detail-graph-phase1.md`](REQ-race-detail-graph-phase1.md) 完了、Cockpit Phase 3 完了。

- **ステータス**: done
- **作成日**: 2026-06-10 21:30
- **関連コミット**: `206b9ee`

---

## 目的

FHD Cockpit 右ペイン運用で、レース詳細グラフの**読み取りやすさ**を改善する。

- 体力 0 の基準が中央寄りで直感と合わない
- レーン（内枠=0%）が下端付近でない
- 速度が % 表示で m/s と乖離している

---

## スコープ

### やること

- [x] `raceGraphBuilder.ts`: 体力・レーンの表示用リマップ（0 をグラフ下端付近へ）
- [x] `RaceDetailChart.tsx`: 複数 Y 軸（速度 m/s 左軸、体力・レーン右軸等）
- [x] Tooltip: 速度は `m/s`、体力・レーンは % または適切な単位
- [x] Phase 2 退行防止: Tooltip `position` / `TOOLTIP_Y_OFFSET` / `initialDimension` / z-index は維持

### やらないこと

- `desktop-app/public/umaemu/`（WASM）
- [`REQ-race-detail-graph-phase2.md`](REQ-race-detail-graph-phase2.md) 以降（区間オーバーレイ、スキル帯、baseline diff）
- Cockpit レイアウト・SkillVerifier の再変更

---

## 仕様（承認済み方針）

### 体力

- HP=0 をグラフ**下から約 5%** の位置にマップ（レーン内枠と揃える）
- 例: `0.05 + 0.95 * normalize(sp, 0, staminaMax)`（負値はクランプ方針を実装時に確定）

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

- [x] 体力 0 がグラフ下端付近（~5%）に表示される
- [x] レーン内枠（0%）がグラフ下端付近に表示される
- [x] 速度軸・Tooltip が m/s 表記
- [x] Tooltip 位置・Legend 重なりに Phase 2 からの退行なし
- [x] DevTools 新規警告なし
- [x] `npm run tauri dev` 実機確認
- [x] REQ ステータス `done` + `docs/TODO.md` 更新 + コミット

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
| 2026-06-10 22:12 | 実装完了: 双 Y 軸・体力床 0.1・レーン床 0.05・速度生値 m/s（`206b9ee`） | Agent mode 実装チャット |
| 2026-06-11 04:29 | 体力床 0.1→0.05（レーン内枠と揃える）・ReferenceLine に yAxisId 追加（`23eaca1`） | 実機確認フィードバック |
| 2026-06-11 04:32 | 体力0位置に薄い横 ReferenceLine 追加・スタート縦線は非表示のまま（`4b1261f`） | ユーザー依頼 |
| 2026-06-11 04:34 | CartesianGrid 縦線（30/60/90秒付近）を一旦非表示（`6a8e8cd`） | ユーザー依頼 |
| 2026-06-11 04:35 | CartesianGrid 縦線を復帰（`12f2ea6`） | ユーザー依頼 |

---

## 設計レビュー起票プロンプト

新チャットを **Ask mode** で開き、以下をコピーして貼る。

```
@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-race-detail-graph-axis.md
@docs/tasks/REQ-race-detail-graph.md
@docs/tasks/REQ-fullscreen-cockpit-layout.md

## チャット種別
設計レビュー（Ask mode）

## 進め方（重要）
- このチャットではコード変更・ファイル編集・コミットを一切しない
- 現状整理 → 方針提案 → 変更範囲 → リスク → 検証手順まで提示する
- 私が「承認」「修正」「見送り」のいずれかを返すまで、実装に進まない
- 承認時は CHAT_TEMPLATE.md パターン A で、実装用の完成プロンプトを1ブロック出力する

## 背景
全画面 Cockpit UI（REQ-fullscreen-cockpit-layout）Phase 1〜3 および UI ポリッシュは完了。
レース詳細グラフは recharts + raceGraphBuilder.ts で 3 系列（速度・体力・レーン）を単一 Y 軸 [0,1]・% 表示で描画している。
実機検証で以下の問題が判明したため、Y 軸・単位の見直しが必要。

- 体力 0 の基準がグラフ中央寄りで直感と合わない（下から約 10% が 0 でよい）
- レーン 0%=内枠が下端付近に来ない（0%=内・100%=外の意味は維持）
- 速度が % 表記で m/s と乖離している

REQ-race-detail-graph-axis.md に方針草案あり。実装前に詳細設計を固めたい。

## ユーザー確定事項（変更不可）
- 体力 0 → グラフ下から約 10%
- レーン 0%（内枠）→ グラフ最下部付近
- 速度 → m/s 表記（Y 軸・Tooltip）
- Phase 2 退行防止: Tooltip position / TOOLTIP_Y_OFFSET / initialDimension / z-index は維持
- Cockpit レイアウト（page.tsx / ResultCard 外枠 / SkillVerifier）は触らない

## 今回決めたいこと
1. raceGraphBuilder.ts のリマップ式（体力・レーン）の具体式とクランプ方針
2. Recharts 多 Y 軸レイアウト（左: 速度 m/s、右: 体力・レーン % 等）の詳細
3. Tooltip / Legend / tickFormatter の表記統一
4. WebView2（Tauri）での描画リスク（SVG レイヤー、backdrop とは別問題）
5. 実装チャット用完成プロンプト（Agent mode に1回で貼れる形式）

## 確認してほしいファイル
- desktop-app/app/lib/raceGraphBuilder.ts
- desktop-app/app/components/RaceDetailChart.tsx
- desktop-app/app/lib/types.ts（RaceDetailDump）
- docs/tasks/REQ-race-detail-graph-axis.md
- docs/tasks/REQ-race-detail-graph.md（Phase 1 MVP / Tooltip 1.5）

## 触らないこと（設計上も変更提案に含めない）
- desktop-app/public/umaemu/
- src-tauri/
- page.tsx / ResultCard レイアウト
- REQ-race-detail-graph Phase 2 以降（区間オーバーレイ、スキル帯、baseline diff）

## 報告形式（この順で）
1. 現状整理（正規化・Y 軸・表示の問題）
2. 目標仕様（体力/レーン/速度それぞれ）
3. 推奨アーキテクチャ（GraphPoint 構造、YAxis 配置）
4. リスクと退行防止チェックリスト
5. 検証手順（FHD Cockpit 右ペイン幅でのグラフ確認）
6. 実装チャット用完成プロンプト（▼ここからコピー / ▲ここまで）

## スコープ（REQ 要約）
### やること
- 体力・レーンの表示用リマップ
- 速度 m/s 多軸表示
- Tooltip 単位更新

### やらないこと
- WASM / OCR / Tauri ウィンドウ API
- Cockpit / SkillVerifier 再変更
- race-detail-graph Phase 2 以降の機能追加
```

### 設計レビュー承認後の返信例

```
承認します。

実装チャット用の完成プロンプトを CHAT_TEMPLATE パターン A で1ブロック出力してください。
```

---

## 実装チャット運用

| 順番 | チャット | モード |
|------|---------|--------|
| 1 | 設計レビュー | Ask |
| 2 | 実装 | Agent |

---

## 参考

- 現状の正規化: `raceGraphBuilder.ts` の `adjustRange`
- 位相ラベル見切れ: `margin.top` + 「中盤へ」「終盤へ」は Cockpit ポリッシュで対応済みの場合あり
