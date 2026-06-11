# REQ-race-detail-graph-phase3-ux: Phase 3 UX ポリッシュ（ラベル位置・Legend・スクロール）

> Phase 3 実機検証後の UI 改善。親: [`REQ-race-detail-graph-phase3.md`](REQ-race-detail-graph-phase3.md)（本体は done）

- **ステータス**: draft
- **作成日**: 2026-06-11 15:12
- **関連コミット**: （完了後に記入）

---

## 目的

Phase 3 本家準拠スキル表示（名前+赤線）の **UX 仕上げ**。実機検証 B〜C で判明した残課題を解消し、D 以降の検証に進める。

---

## スコープ

### やること（UX-1〜4）

| ID | 内容 | 触る想定 |
|----|------|---------|
| UX-1 | スキルラベル位置を本家準拠に（左端揃え・赤線との縦関係） | `RaceDetailChart.tsx` |
| UX-2 | 縦拡大スクロールバーをダークトーン化 | `RaceDetailChart.tsx` |
| UX-3 | グラフクリック時の上下白線（フォーカスノイズ）除去 | `RaceDetailChart.tsx`, 必要なら `globals.css` |
| UX-4 | Legend を checkbox 状態と同期（非表示 or 打ち消し線） | `RaceDetailChart.tsx` |

### やらないこと

- B-3 デバフ検証（[`docs/TODO.md`](../TODO.md) P2 別タスク）
- Phase 4 baseline diff
- WASM / `ResultCard` 外枠 / `raceGraphBuilder.ts`（UX-1 で座標変更不要なら触らない）

---

## UX-1 詳細（本家ラベル位置）

### 本家仕様（`GraphOutput.kt`）

- ラベル: `XYAnnotation(Point(skill.start, top), AnchorPoint.TopLeft)` — **左端＝発動開始 x**
- 赤線: `y = top - 0.003`（ラベル行のやや下）
- 枠: `TooltipSurface`（半透明ダーク背景）— **任意**。まず位置を正し、枠は `bg-black/50` 程度で試す可

### 現状の問題

- `ReferenceDot` + `label.position: "top"` → 名前が赤線より **上** に浮く
- 左端 x 揃えは概ね OK

### 完了条件

- [ ] ラベル左端と赤線左端が `startTime` で揃う
- [ ] 赤線がラベル行の中〜下を通る（本家添付画像に近い縦関係）
- [ ] 枠の有無は実装後ユーザー確認（必須ではない）

---

## UX-2〜4 詳細

### UX-2 スクロールバー

- 現状: 縦拡大親は `overflow-y-auto` のみ → **白いスクロールバー**
- 参考: `SkillVerifier.tsx` の `scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent`

### UX-3 クリック時白線

- 症状: グラフエリアクリックで枠上下に白い線（フォーカスアウトライン）
- 対策候補: `outline-none` / `.recharts-wrapper:focus { outline: none }` / `tabIndex={-1}` 等

### UX-4 Legend

- 現状: `Line hide={!showXxx}` で折れ線は消えるが、Legend は **白文字で残る**
- 方針: `displayState` 連動のカスタム Legend（非表示 or 打ち消し線）。checkbox が正本、Legend クリック無効は維持

---

## 実機検証状況（2026-06-11 時点）

### 完了済み

**A 退行防止** — 全 OK

**B-1** — 基本 OK（ラベル位置微調整は UX-1）

**B-2** — 機能 OK（スクロールバー見た目は UX-2）

**B-3** — N/A（別タスク）

**C 表示切替** — 各 checkbox 個別 OK、全 OFF→ON 復帰 OK

**C-1** — Legend クリック無効 OK

### 残課題（本 REQ で解消）

- [ ] C-1: グラフクリック時の上下白線（UX-3）
- [ ] C-1: Legend が OFF 系列を白文字で残す（UX-4）

### D 以降（本 REQ 完了後にユーザー検証）

#### D-1 スキル多数（8 件以上）

- [ ] 東京 2400m 等 → 名前+赤線が複数確認できる
- [ ] 縦拡大 ON で重なりが解消され読める

#### D-2 スキル少数（2〜3 件）

- [ ] コンパクトでも発動区間とスキル名が読める
- [ ] 縦拡大 OFF で過度に縦長にならない

#### D-3 skillEvents 欠落耐性

- [ ] スキル 0 件 → 3 本線+区間帯のみ、エラーなし
- [ ] `skillEvents` 無しでもクラッシュしない

#### D-4 SkillVerifier 連携

- [ ] スキル ON/OFF → 再 sim 後グラフ・スキル表示更新
- [ ] KPI 退行なし

#### D-5 コース差

- [ ] 短距離（1200m 系）— 区間帯+スキル表示 OK
- [ ] 中距離（2000m 系）— 同上
- [ ] 長距離（2400m+ 系）— 同上

#### E パフォーマンス / コンソール

- [ ] 体感で Phase 2 以前と大きく遅くない
- [ ] Phase 3 起因の新規 ERROR なし
- [ ] Phase 3 起因の新規 WARNING なし（既存は除外可）

#### F 判定

- [ ] A 全 OK（済）
- [ ] B 全 OK（B-3 は N/A 可）
- [ ] C 全 OK（本 REQ 完了後）
- [ ] D 全 OK
- [ ] E 全 OK

---

## 完了条件（本 REQ）

- [ ] UX-1〜4 実装
- [ ] `npm run build` 通過
- [ ] ユーザー: C-1 残り2項目 + UX-1 ラベル位置の再確認 OK
- [ ] コミット（push しない）
- [ ] 本 REQ `done` + 親 REQ 決定ログ追記 + `docs/TODO.md` 更新

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-11 15:12 | Phase 3 UX を sibling REQ として起票 | 新 Agent チャット引き継ぎ。検証 checklist は本 REQ に集約 |

---

## 参考

- 親: [`REQ-race-detail-graph-phase3.md`](REQ-race-detail-graph-phase3.md)
- 最新コミット: `f74cdaf`（ReferenceDot ラベル）
- 本家: `umasim-temp/compose/.../GraphOutput.kt`
