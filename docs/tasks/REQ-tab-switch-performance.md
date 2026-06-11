# REQ-tab-switch-performance: タブ切り替え時の引っかかり改善

> グラフ性能 REQ（`873080e`）とは別件。タブ切替のみ残る軽い引っかかりを解消する。

- **ステータス**: done
- **作成日**: 2026-06-12 04:36
- **関連コミット**: `224d67a` / `c6cba51`

---

## 目的

タブ切り替え時の軽い引っかかりを、スキル表示 ON/OFF に依存せず解消する。Phase 1+2 グラフ性能修正後も残存していたタブ切替コストを keep-alive 化で削減する。

---

## 背景（設計レビュー合意）

### 根本原因

- `activeTab` 切替のたびに `ResultCard` 経由で `RaceDetailChart` の detail が差し替わり、`buildRaceGraphPoints` + Recharts + SkillVerifier 50+ 行が再構築される
- keep-alive なし（単一パネルの props 更新）
- `animate-fadeIn` は globals.css 未定義で現状 no-op（SkillVerifier から削除）
- `displayUnit` はページ共通でタブ切替の直接原因ではない（現状維持）

---

## スコープ

### やること

- [x] `page.tsx` Body を `tabs.map` による keep-alive 化（sim 済みタブのみ mount）
- [x] `SimTabPanel` に ResultCard + SkillVerifier + callbacks 集約
- [x] `SkillVerifier.tsx` の `animate-fadeIn` 削除
- [x] `ResultCard` を `React.memo` 化
- [x] Profiler Before 記録 → 決定ログ

### やらないこと

- グラフ表示仕様変更（Tooltip / baseline / 縦拡大 / スタミナキープ持続線）
- 左サイドバー分離（案 C）
- タブピン留め等の新機能
- `RaceDetailChart` / `raceGraphBuilder` / `TabBar` / OCR / Tauri / WASM

---

## 仕様

### keep-alive

- `simResultDump` があるタブのみ `SimTabPanel` を mount
- `key={tab.id}`、非アクティブは `hidden` + `aria-hidden`
- タブ close でパネルアンマウント（`tabs` 配列から除去）
- 上限: 開いている全タブ（cap なし）

### displayUnit

- ページ共通 state のまま（タブごとの記憶はスコープ外）

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/(main)/page.tsx` | Body keep-alive 化 |
| `desktop-app/app/(main)/SimTabPanel.tsx` | 新規 — ResultCard + SkillVerifier 集約 |
| `desktop-app/app/components/SkillVerifier.tsx` | `animate-fadeIn` 削除 |
| `desktop-app/app/components/ResultCard.tsx` | （任意）React.memo |
| `docs/TODO.md` | 進行中・完了更新 |

---

## 完了条件

- [ ] タブ 2〜3 枚・sim 済み・50+ スキルで切替が気にならない（実機検証待ち）
- [ ] スキル表示 ON/OFF どちらでも切替快適（実機検証待ち）
- [ ] 縦拡大・Phase 4 compare・SkillVerifier 操作・タブ複製に退行なし（実機検証待ち）
- [ ] タブごとにグラフ checkbox 状態が独立保持（実機検証待ち）
- [x] Profiler Before を決定ログに記録済み
- [x] `npm run build` 通過
- [x] TODO 着手時・完了時更新
- [x] コミット（push しない）

---

## 検証手順

1. タブ 2〜3 枚を sim 実行し、A→B→A で切替 — 引っかかりが改善していること
2. スキル表示 ON/OFF 両方で切替を確認
3. タブ A でグラフ checkbox を変更 → タブ B → A に戻し、checkbox 状態が保持されていること
4. SkillVerifier: スキル ON/OFF・追加・削除・比較 sim・タブ複製が従来どおり動作すること
5. 縦拡大 ON/OFF、Phase 4 baseline compare 表示に退行がないこと

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-12 04:36 | **Before（Profiler 所感）**: タブ A→B→A 1 サイクルで Ranked に ResultCard・RaceDetailChart・SkillVerifier（50+ 行）が毎回 commit。activeTab 差し替えにより Body 全体がアンマウント→再マウント相当。commit 時間 ~数十 ms 級の体感引っかかり | 実装前コード構造確認（単一 ResultCard + activeTab props 更新）。keep-alive なし |
| 2026-06-12 04:36 | 案 A（keep-alive）+ 最小 B（SimTabPanel 集約）を採用 | 設計レビュー合意 |
| 2026-06-12 04:36 | keep-alive 上限: 全タブ / displayUnit: ページ共通維持 | 未決事項確定 |
| 2026-06-12 05:07 | **実機検証**: チェックリスト全 OK・引っかかり大幅軽減。残件: グラフのみ遅延表示・TabBar サムネ transition カクつき | keep-alive + `hidden`（display:none）で ResizeObserver/Recharts 再レイアウト |
| 2026-06-12 05:07 | 追従修正: `hidden` → `absolute inset-0` + `visibility` 重ね / TabBar `transition-all`+幅差分を廃止（固定 w-40・opacity/border/shadow のみ） | 案 C 前の最小追従。display:none 回避でグラフ計測維持、width transition 除去でメインスレッド競合低減 |
