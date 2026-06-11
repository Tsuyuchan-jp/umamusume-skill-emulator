# REQ-race-detail-graph-phase3-ux: Phase 3 UX ポリッシュ（ラベル位置・Legend・スクロール）

> Phase 3 実機検証後の UI 改善。親: [`REQ-race-detail-graph-phase3.md`](REQ-race-detail-graph-phase3.md)（本体は done）

- **ステータス**: done
- **作成日**: 2026-06-11 15:12
- **関連コミット**: `7a91cb7` / `447d25e`（B案 下ライン・28px・ピル）

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

- [x] ラベル左端と赤線左端が `startTime` で揃う（`textAnchor="start"` + TopLeft 相当）
- [x] 赤線がラベル行の中〜下を通る → **B案: 下ライン**（ピル下 + gap、非接触）に変更（`2b753be` 以降）
- [x] 枠: ピル試行後 **不要と判断・削除**（色文字のみで十分）

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

**C-1** — Legend クリック無効 OK、UX-3/4 再確認 OK

**UX-1 B案レイアウト** — 下ライン・OFF ドメイン詰め・ON 19px 行 — 全 OK（2026-06-11 実機）

**D 表示・連携** — 全 OK（2026-06-11 実機。D-2/D-3 は実運用上ほぼ検証不可だが問題なしと判断）

### 残課題（本 REQ で解消）

- [x] C-1: グラフクリック時の上下白線（UX-3）
- [x] C-1: Legend が OFF 系列を白文字で残す（UX-4）
- [x] UX-1: 下ライン・縦拡大 OFF/ON レイアウト（ピルなし・最終 19px 行）

### D 以降（ユーザー検証 2026-06-11）

> 現代ウマ娘: 所持 50〜70+。グラフは **発動イベント数**（20〜40+ あり得る）で評価。

#### D-1 スキル多数（推奨: 発動 20 件以上）

- [x] 多スキルビルド（50+ 所持）で sim → 発動スキル名+赤線が表示される
- [x] 縦拡大 ON で行が重ならず、スクロールで全件追える
- [x] 縦拡大 OFF で枠内に収まる（重なりは仕様 OK）
- [x] 下ライン・左端揃えが崩れていない

#### D-2 スキル少数（発動 2〜3 件）

- [x] 発動が少ないレースでも区間・名前が読める（直接検証不可・問題なしと推定）
- [x] 縦拡大 OFF で過度に縦長にならない

#### D-3 skillEvents 欠落耐性

- [x] 発動 0 件（実運用ほぼ無し・直接検証不可）
- [x] `skillEvents` 無し（同上）

#### D-4 SkillVerifier 連携

- [x] スキル ON/OFF → 再 sim 後グラフ更新
- [x] KPI 退行なし

#### D-5 コース差

- [x] 短距離（1200m 系）
- [x] 中距離（2000m 系）
- [x] 長距離（2400m+ 系）

#### E パフォーマンス / コンソール

- [x] sim 完了 → グラフ表示まで体感許容
- [ ] **操作レスポンス** — スキル表示 ON 時に全体がもたつく → **別 REQ** [`REQ-race-detail-graph-performance.md`](REQ-race-detail-graph-performance.md)
- [x] スキル表示 OFF 時はもたつきなし
- [x] Phase 3 起因の新規 ERROR / WARNING なし
- [ ] （副次）縦拡大 OFF→ON で X 軸スクロールバーが一瞬表示 — 性能 REQ で任意対応

#### F 判定

- [x] A 全 OK
- [x] B 全 OK（B-3 は N/A 可）
- [x] C 全 OK
- [x] D 全 OK
- [ ] E 全 OK — **操作レスポンス NG のみ未達**（性能 REQ へ委譲）

---

## 完了条件（本 REQ）

- [x] UX-1〜4 実装
- [x] `npm run build` 通過
- [x] ユーザー: C-1 残り2項目 + UX-1 ラベル位置の再確認 OK
- [x] コミット（push しない）
- [x] 本 REQ `done` + 親 REQ 決定ログ追記 + `docs/TODO.md` 更新

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-11 15:12 | Phase 3 UX を sibling REQ として起票 | 新 Agent チャット引き継ぎ。検証 checklist は本 REQ に集約 |
| 2026-06-11 15:15 | UX-1〜4 実装完了 | ReferenceDot カスタムラベル（TopLeft）、ダーク scrollbar、フォーカス outline 除去、SyncedChartLegend |
| 2026-06-11 15:23 | UX-1 退行修正: label props を cx/cy 優先に | 実機でラベル消滅。Recharts 3.8 は x/y ではなく cx/cy を渡す |
| 2026-06-11 15:51 | UX-1 B案: 下ライン + 28px 行 + ピル | 用語統一（上端/下端/上ライン/下ライン）。`layoutSkillMarkers` で縦拡大 ON/OFF 一貫 |
| 2026-06-11 15:58 | ピル削除 + 縦拡大 OFF 行圧縮 | 実機: ピル不要。OFF 時 28px 固定で行オーバー → `expanded:false` で行高自動縮小（min 16px） |
| 2026-06-11 16:03 | OFF: skillMargin ドメイン詰めに戻す / ON: 24px | OFF は重なり OK・0% 下はみ出し禁止。ON 行高 28→24 |
| 2026-06-11 16:06 | 縦拡大 ON 行高 24→20px | 実機調整 |
| 2026-06-11 16:09 | UX-1 B案レイアウト実機 OK（20px 確定） | OFF: skillMargin 詰め・枠内。ON: 20px 下ライン。ピルなし |
| 2026-06-11 16:37 | D 全 OK / E 操作レスポンス NG | 性能は [`REQ-race-detail-graph-performance.md`](REQ-race-detail-graph-performance.md) へ分離 |

---

## 参考

- 親: [`REQ-race-detail-graph-phase3.md`](REQ-race-detail-graph-phase3.md)
- 性能（E 未達）: [`REQ-race-detail-graph-performance.md`](REQ-race-detail-graph-performance.md)
- 最新コミット: `1949800`（19px 行）/ `63bf2bd`（赤線 1px 上）
- 本家: `umasim-temp/compose/.../GraphOutput.kt`
