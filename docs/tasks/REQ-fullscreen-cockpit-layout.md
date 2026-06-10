# REQ-fullscreen-cockpit-layout: 全画面 Analytics Cockpit UI

> 設計レビュー（Ask mode）起票用。実装の正本。
> 起票: `@docs/tasks/REQ-fullscreen-cockpit-layout.md`

- **ステータス**: done（Phase 3 完了）
- **作成日**: 2026-06-10 17:45
- **関連コミット**: `98c8739`（Phase 1）、`6b8b13b`（Phase 2）、`c9412ee`（Phase 2 高さ修復）
- **前提**: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md) Phase 1 完了 + Tooltip Phase 1.5（`0e25cda`）

---

## 目的

FHD 全画面運用を前提に、**余白を最小化し画面を使い切る** Analytics Cockpit レイアウトへ刷新する。

- グラフを主役に、KPI はコンパクトな計器ストリップ
- SkillVerifier を右ペインに配置し縦スクロールを削減
- サイドバー 380px デフォルト + 折りたたみ可能

参考: 以前試行した max-width 拡大・ゾーン分離・左揃えは UX 期待値に合わずロールバック済み。本 REQ は **案 A（Analytics Cockpit）** で再設計する。

---

## 背景・現状

| 項目 | 内容 |
|------|------|
| レイアウト | 左サイドバー 450px + 右 `p-10` + `max-w-5xl mx-auto` 縦スクロール |
| 結果 UI | `ResultCard` — 大 KPI カード + 折りたたみグラフ（`h-72`） |
| SkillVerifier | `ResultCard` 下に縦積み |
| グラフ | `RaceDetailChart` — Tooltip offset/z-index 済み、`initialDimension` 維持必須 |
| 問題 | FHD 最大化時に左右・上下の死にスペース、KPI 間延び、グラフが小さい |

---

## ユーザー確定事項（変更不可）

- **案 A**: Analytics Cockpit（KPI ストリップ + グラフ主役 + SkillVerifier 右ペイン）
- **サイドバー**: デフォルト **380px**、**折りたたみ可能**
- **グラフ**: **常時表示**（折りたたみ廃止）
- **実装**: **Phase 分割**（Phase 1 から順に別チャット）

---

## 目標レイアウト（案 A）

```
┌─ Sidebar 380px（折り畳み 56px）─┬─ Main flex-1 p-3 ─────────────────────────────┐
│ キャプチャ / レース条件 / シミュ   │ [TabBar] レース情報              [秒|バ身] [状態] │ ~48px
│                                   ├──────────────────────────────────────────────┤
│                                   │ KPI 1行ストリップ（最速|平均|最遅|スパート|サブ）  │ ~52px
│                                   ├──────────────────────────────┬───────────────┤
│                                   │ 直近レース詳細グラフ          │ SkillVerifier │
│                                   │ flex-1 常時表示              │ 右 320-380px  │
│                                   └──────────────────────────────┴───────────────┘
└───────────────────────────────────┴──────────────────────────────────────────────┘
```

FHD 1920×1080 目安（サイドバー 380px）:

- メイン幅: ~1540px（padding 除く）
- グラフエリア: ~1180px × ~720px（ヘッダー・KPI・右ペイン差引）

---

## スコープ

### Phase 1 — レイアウト骨格 + サイドバー

- [x] `sidebarWidth` デフォルト **380**、リサイズ範囲 min 320 / max 480
- [x] `sidebarCollapsed` state + 折りたたみトグル（折り畳み幅 **56px**）
- [x] 右カラム: `max-w-5xl mx-auto` 撤廃 → `w-full min-w-0`
- [x] padding `p-10` → `p-3`
- [x] 右カラム `flex flex-col h-full overflow-hidden` + 子 `flex-1 overflow-y-auto`（暫定縦スクロール）
- [x] 縮小時横はみ出し防止: 右カラム flex チェーン `min-w-0`、レース情報行 `flex-wrap`
- [x] 触るファイル: `desktop-app/app/(main)/page.tsx` のみ

**Phase 1 完了条件**

- [x] サイドバー折りたたみ / 展開が動作
- [x] FHD 最大化で右カラムが max-width 制限なく横に広がる
- [x] 既存 sim / タブ / キャプチャに退行なし（コンポーネント未変更）
- [x] `npm run tauri dev` 実機確認（既存 dev サーバーでコンパイル成功）
- [x] REQ チェック更新 + コミット

### Phase 2 — KPI コンパクト化 + グラフ常時表示

- [x] `ResultCard.tsx`: ヒーロー KPI + サブ KPI + スパートバッジを **1〜2 行 dense ストリップ** に再構成
- [x] 折りたたみ UI 削除（`detailOpen` / Chevron ボタン）
- [x] `RaceDetailChart.tsx`: `h-72` 固定 → 親 `flex-1 min-h-[360px]` + `ResponsiveContainer height="100%"`
- [x] Tooltip / `initialDimension` 修正は **退行させない**（height のみ 360 に変更）
- [x] `raceDetail` 未取得時: プレースホルダー領域を確保

**Phase 2 完了条件**

- [x] グラフが常時表示、折りたたみ UI なし
- [x] FHD でグラフ高が viewport の大部分を使用（実機確認済み）
- [x] Tooltip / Legend 重なり解消が維持（position / offset / z-index 未変更・実機確認済み）
- [x] DevTools 新規警告なし（ResponsiveContainer 含む・実機確認済み）
- [x] REQ チェック更新 + コミット

### Phase 3 — SkillVerifier 右ペイン + ヘッダー整理

- [x] `page.tsx`: Body を 2 列 grid（`grid-cols-[1fr_360px]`、右ペイン 360px 固定）
- [x] `SkillVerifier` を右ペインへ移動、リストのみ内部スクロール
- [x] TabBar / レース情報行をコンパクト化（`mb-8` → `mb-3`、Tab `h-16` → `h-10` 等）
- [x] `ResultsCockpitLayout.tsx` 新規は見送り（`page.tsx` + `ResultCard` 外枠で完結）

**Phase 3 完了条件**

- [x] グラフ + SkillVerifier が横並び、ページ全体の縦スクロール最小
- [x] SkillVerifier 操作（トグル・検証 sim・リセット）に退行なし
- [x] タブ複製アニメ・ハイライトに退行なし
- [x] REQ ステータス `done` + `docs/TODO.md` 更新 + コミット

### やらないこと

- [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md) Phase 2〜4（区間オーバーレイ、スキル帯、baseline diff）
- `desktop-app/public/umaemu/`（race.js, worker.js, wasm）
- `app/lib/geminiOcr.ts` / `app/lib/fuzzyMatcher.ts`
- `src-tauri/` キャプチャ・ウィンドウ API 変更（折りたたみは CSS/React state のみ）
- 参考 UI 完全一致
- サイドバー折りたたみ状態の localStorage 永続化（初回は session のみ。要望あれば将来 Phase）

---

## 設計レビューで決める未決事項

| # | 項目 | 候補 | 備考 |
|---|------|------|------|
| 1 | 折りたたみ時サイドバー幅 | 56px / 48px | アイコンレール |
| 2 | SkillVerifier 右ペイン幅 | 320 / 360 / 380px | リサイズ可否 |
| 3 | KPI ストリップ形式 | 完全インライン / 極小カード | Phase 2 |
| 4 | TabBar | サムネ維持 / テキスト pill のみ | Phase 3 |
| 5 | raceDetail 未取得時 | 空メッセージ / スケルトン | Phase 2 |
| 6 | ページスクロール | Phase 1 で完全廃止 / Phase 3 まで暫定 scroll | Phase 1 |

---

## 触るファイル（予定）

| ファイル | Phase | 変更内容 |
|---------|-------|---------|
| `desktop-app/app/(main)/page.tsx` | 1, 3 | 骨格・サイドバー・2 列 grid・SkillVerifier 配置 |
| `desktop-app/app/components/ResultCard.tsx` | 2 | KPI ストリップ・折りたたみ削除 |
| `desktop-app/app/components/RaceDetailChart.tsx` | 2 | flex-1 高さ対応 |
| `desktop-app/app/components/SkillVerifier.tsx` | 3 | 右ペイン向けスタイル調整 |
| `desktop-app/app/components/TabBar.tsx` | 3 | コンパクト化 |
| `desktop-app/app/components/ResultsCockpitLayout.tsx` | 3 | 新規（任意） |

### 触らない

- `RaceDetailChart.tsx` の Tooltip position / z-index / `initialDimension`（Phase 2 では height のみ変更可）
- `raceGraphBuilder.ts` / `umaemuAdapter.ts`
- `src-tauri/`

---

## 完了条件（全体）

- [x] FHD 最大化でグラフが viewport 高の大部分を使用
- [x] サイドバー折りたたみ / 展開が動作
- [x] KPI・SkillVerifier・Tooltip に退行なし
- [x] DevTools 新規警告なし
- [x] 各 Phase 完了ごとに REQ チェック + コミット（push なし）

---

## 検証手順

### Phase 1

1. `npm run tauri dev` → ウィンドウ最大化（1920×1080）
2. サイドバー 380px デフォルト、折りたたみ / 展開
3. 右カラムが横いっぱい（max-w-5xl 制限なし）
4. シミュ実行 → 既存 ResultCard / SkillVerifier 表示に退行なし

### Phase 2

1. シミュ後グラフが常時表示（折りたたみなし）
2. グラフ高が従来 `h-72` より大幅に増加
3. ホバー Tooltip が Legend より前面、折れ線被り軽減維持
4. raceDetail 未取得タブでレイアウト崩れなし

### Phase 3

1. グラフ左 + SkillVerifier 右の 2 列
2. スキルトグル・検証 sim・リセット・タブ複製
3. ページ縦スクロールが最小（ペイン内スクロールのみ）
4. サイドバー 450→800 リサイズと折りたたみの併用

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-10 17:45 | 案 A Analytics Cockpit で進行 | ユーザー承認 |
| 2026-06-10 17:45 | サイドバー 380px デフォルト + 折りたたみ | ユーザー承認 |
| 2026-06-10 17:45 | グラフ常時表示 | ユーザー承認 |
| 2026-06-10 17:45 | Phase 1→2→3 分割実装 | ユーザー承認（大規模改修） |
| 2026-06-10 20:03 | Phase 2 実機検証完了（FHD グラフ高・Tooltip・DevTools 警告なし） | ユーザー実機確認 |
| 2026-06-10 20:10 | Phase 3 実装完了（SkillVerifier 右ペイン 360px・TabBar コンパクト化・ページスクロール廃止） | Agent 実装 |

---

## 設計レビュー起票プロンプト

新チャットを **Ask mode** で開き、以下をコピーして貼る。

```
@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-fullscreen-cockpit-layout.md

## チャット種別
設計レビュー（Ask mode）

## 進め方（重要）
- このチャットではコード変更・ファイル編集・コミットを一切しない
- 現状整理 → 方針提案 → 変更範囲 → リスク → 検証手順まで提示する
- 私が「承認」「修正」「見送り」のいずれかを返すまで、実装に進まない
- 承認時は CHAT_TEMPLATE.md パターン A で、Phase 1 実装用の完成プロンプトを1ブロック出力する

## 背景
FHD 全画面運用を前提に、右カラムの max-width 拡大・ゾーン分離・左揃え等を試したが UX 期待値に合わずロールバック済み（HEAD: 0e25cda）。
Tooltip Phase 1.5（offset / z-index）は維持。
次は案 A「Analytics Cockpit」で画面を使い切るレイアウトに刷新する。

## ユーザー確定事項（変更不可）
- 案 A: Analytics Cockpit（KPI ストリップ + グラフ主役 + SkillVerifier 右ペイン）
- サイドバー: デフォルト 380px、折りたたみ可能
- グラフ: 常時表示（折りたたみ廃止）
- 実装: REQ の Phase 分割（Phase 1 から順に別チャット）

## 今回決めたいこと
1. Phase 1〜3 の詳細仕様（レイアウト寸法・コンポーネント責務・状態管理）
2. 未決事項（REQ 参照）の推奨回答
3. Phase 1 実装チャット用完成プロンプト（Agent mode に1回で貼れる形式）

## 確認してほしいファイル
- desktop-app/app/(main)/page.tsx
- desktop-app/app/components/ResultCard.tsx
- desktop-app/app/components/RaceDetailChart.tsx
- desktop-app/app/components/SkillVerifier.tsx
- desktop-app/app/components/TabBar.tsx
- docs/tasks/REQ-fullscreen-cockpit-layout.md
- docs/tasks/REQ-race-detail-graph.md

## 触らないこと（設計上も変更提案に含めない）
- desktop-app/public/umaemu/
- app/lib/geminiOcr.ts / app/lib/fuzzyMatcher.ts
- src-tauri/
- REQ-race-detail-graph Phase 2 以降

## 報告形式（この順で）
1. 現状整理
2. 目標レイアウト（FHD 1920x1080 寸法付き）
3. Phase 1 / 2 / 3 詳細仕様
4. 未決事項（推奨回答付き）
5. リスク
6. 検証手順
7. Phase 1 実装チャット用完成プロンプト（▼ここからコピー / ▲ここまで）

## スコープ（REQ 要約）
### やること
- 全画面 Cockpit レイアウト
- サイドバー 380px + 折りたたみ
- SkillVerifier 右ペイン化
- Phase 分割実装

### やらないこと
- グラフデータ / WASM / OCR / Tauri 改修
- race-detail-graph Phase 2 以降
- Phase 単位 revert 可能な最小変更（過剰リファクタ禁止）
```

### 設計レビュー承認後の返信例

```
承認します。

Phase 1 実装用の完成プロンプトを CHAT_TEMPLATE パターン A で1ブロック出力してください。
```

---

## 実装チャット運用

| 順番 | チャット | REQ Phase | モード |
|------|---------|-----------|--------|
| 1 | 設計レビュー | — | Ask |
| 2 | 実装 | Phase 1 | Agent |
| 3 | 検証（任意） | Phase 1 | Agent |
| 4 | 実装 | Phase 2 | Agent |
| 5 | 実装 | Phase 3 | Agent |

---

## 参考

- レイアウト試行ロールバック: `a2006b6`〜`93c821c`（revert 済み、HEAD `0e25cda`）
- グラフ Phase 1: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)
- チャット起票: [`docs/CHAT_TEMPLATE.md`](../CHAT_TEMPLATE.md)
