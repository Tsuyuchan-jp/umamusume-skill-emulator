# REQ-sidebar-compact-layout: サイドバー狭幅 UI 整備

> [`REQ-fullscreen-cockpit-layout.md`](REQ-fullscreen-cockpit-layout.md) Phase 1 完了後の独立タスク。
> 右カラム Phase 2/3 とは別チャットで進める。
> 起票: `@docs/tasks/REQ-sidebar-compact-layout.md`

- **ステータス**: in-progress（Phase S1 完了）
- **作成日**: 2026-06-10 18:56
- **関連コミット**: （Phase S1 コミット後に記入）
- **前提**: Cockpit Phase 1（`98c8739`）+ minWidth 1150（`41b6e77`）

---

## 目的

サイドバー 380px（リサイズ min 320px）運用時に、左カラムの設定 UI が窮屈・クリップされる問題を解消する。

- 「変更」ボタンが `overflow-hidden` で欠ける
- CapturePanel / SettingsPanel の二重カードで実効幅が狭い
- viewport 基準の `sm:` ブレークポイントが狭サイドバーと矛盾

---

## 背景・現状

| 項目 | 内容 |
|------|------|
| サイドバー幅 | デフォルト 380px、min 320 / max 480（Cockpit Phase 1） |
| ウィンドウ minWidth | 1150px（`tauri.conf.json`） |
| 顕在バグ | 保存先フォルダ行の「変更」ボタンが右端でクリップ（実機確認済み） |
| 根本原因 | `SettingsPanel` の `sm:flex-row` が viewport 640px+ で有効になり、380px カラム内で横並びになる |
| 副次要因 | sidebar `p-6` + CapturePanel `p-5` + SettingsPanel 内枠で実効幅 ~252px |

### 実効幅の目安（380px 時）

```
380px
  - sidebar p-6 (48px)
  - CapturePanel p-5 (40px)
  - SettingsPanel px-5 p-4 (~40px)
  ≈ 252px（コントロール領域）
```

---

## ユーザー確定事項（変更不可）

- **独立タスク**: Cockpit 右カラム Phase 2/3 と混ぜない
- **対象**: 左サイドバー UI のみ（キャプチャ設定を最優先）
- **機能退行なし**: キャプチャ・OCR・シミュ・タブの挙動は変えない

---

## スコープ案（設計レビューで Phase 確定）

### Phase S1 — SettingsPanel 即効修正（案）

- [x] 設定行を常に縦積み（`sm:flex-row` 廃止または sidebar 専用に変更）
- [x] 入力グループの `overflow-hidden` 見直し（「変更」ボタンを `shrink-0` で常時表示）
- [x] 「設定」ヘッダーと自動コピー checkbox を別行に分離
- [x] 狭幅時の文言短縮（自動コピー / APIキーボタン）

**触る想定**: `SettingsPanel.tsx`

### Phase S2 — 枠の整理・padding 圧縮（案）

- [ ] SettingsPanel の内側カードを廃止し CapturePanel 内フラットセクション化
- [ ] sidebar `p-6` → `p-4`、各パネル padding 圧縮
- [ ] `page.tsx` タイトル行の狭幅対応（フォント縮小 or 短縮表示）

**触る想定**: `SettingsPanel.tsx`, `CapturePanel.tsx`, `page.tsx`（sidebar padding のみ）

### Phase S3 — コンテナクエリ（任意・案）

- [ ] sidebar ルートに `@container/sidebar`
- [ ] 320〜480px リサイズに連動した行レイアウト切替

**触る想定**: `page.tsx` + 各サイドバーパネル

### やらないこと

- [`REQ-fullscreen-cockpit-layout.md`](REQ-fullscreen-cockpit-layout.md) Phase 2/3（右カラム KPI・グラフ・SkillVerifier 配置）
- `ResultCard.tsx` / `RaceDetailChart.tsx` / `TabBar.tsx`（右カラム）
- `app/lib/geminiOcr.ts` / `app/lib/fuzzyMatcher.ts`
- `src-tauri/`（minWidth 以外のウィンドウ API）
- `desktop-app/public/umaemu/`
- OCR 後パネル（`StatusPanel` / `SkillPanel` / `RaceConditionSelector`）の大規模リデザイン — S1/S2 完了後に必要なら別 Phase

---

## 設計レビューで決める未決事項

| # | 項目 | 候補 | 備考 |
|---|------|------|------|
| 1 | Phase 分割 | S1 のみ / S1+S2 / S1〜S3 | 実装チャット数に影響 |
| 2 | 行レイアウト | 常に縦積み / コンテナクエリで横並び復帰 | 480px リサイズ時の見え方 |
| 3 | ネスト解消 | S1 で Settings のみ / S2 で Capture 統合 | 見た目の変化量 |
| 4 | sidebar padding | p-6 維持 / p-4 へ | 全パネルへの波及 |
| 5 | タイトル行 | 現状維持 / text-base 短縮 | 380px での折り返し |
| 6 | OCR 後パネル | S2 まで対象外 / RaceCondition 等も padding 統一 | スコープ拡大の可否 |

---

## 触るファイル（予定）

| ファイル | Phase | 変更内容 |
|---------|-------|---------|
| `desktop-app/app/components/SettingsPanel.tsx` | S1, S2 | 行レイアウト・overflow・ネスト解消 |
| `desktop-app/app/components/CapturePanel.tsx` | S2 | Settings 統合・padding |
| `desktop-app/app/(main)/page.tsx` | S2, S3 | sidebar padding・container・タイトル |
| `desktop-app/app/components/RaceConditionSelector.tsx` | （任意） | padding 統一 |
| `desktop-app/app/components/SimulationLauncher.tsx` | （任意） | 試行回数行の狭幅対応 |

---

## 完了条件（全体）

- [ ] 380px で「変更」ボタンが欠けない（保存先・ショートカット・APIキー）
- [ ] 320px（sidebar min）でも横クリップ・要素重なりなし
- [ ] キャプチャ・OCR・シミュ・タブに退行なし
- [ ] `npm run tauri dev` 実機確認
- [ ] 各 Phase 完了ごとに REQ チェック + `docs/TODO.md` 更新 + コミット（push なし）

---

## 検証手順

1. `npm run tauri dev` → サイドバー 380px（デフォルト）
2. 設定セクション: 保存先・ショートカット・APIキーの「変更」がすべて表示・クリック可能
3. サイドバーを 320px まで縮小 → 同様にクリップなし
4. サイドバー 480px に拡大 → レイアウトが自然（S3 採用時は横並び復帰を確認）
5. 自動キャプチャ → OCR → シミュ → タブ操作の退行なし

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-10 18:56 | Cockpit 右カラム Phase 2/3 から独立タスクとして切り出し | スコープ分離・並行管理 |
| 2026-06-10 18:56 | 実機検証で 380px 時の Settings クリップを確認 | ユーザー報告 |
| 2026-06-10 19:45 | Phase S1 実装: SettingsPanel 行レイアウト常時縦積み・ヘッダー分離・文言短縮 | viewport `sm:` 廃止で 380px カラム内クリップ解消 |

---

## 設計レビュー起票プロンプト

新チャットを **Ask mode** で開き、以下をコピーして貼る。

```
@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-sidebar-compact-layout.md
@docs/tasks/REQ-fullscreen-cockpit-layout.md

## チャット種別
設計レビュー（Ask mode）

## 進め方（重要）
- このチャットではコード変更・ファイル編集・コミットを一切しない
- 現状整理 → 方針提案 → 変更範囲 → リスク → 検証手順まで提示する
- 私が「承認」「修正」「見送り」のいずれかを返すまで、実装に進まない
- 承認時は CHAT_TEMPLATE.md パターン A で、Phase S1 実装用の完成プロンプトを1ブロック出力する

## 背景
Cockpit Phase 1 完了後（サイドバー 380px デフォルト・折りたたみ 56px・右カラム全幅化）。
実機検証で左カラム 380px 時に SettingsPanel の「変更」ボタンがクリップされる・二重カードで窮屈、と判明。
原因は viewport 基準 sm: ブレークポイントと 380px サイドバーのミスマッチ（調査済み）。
本タスクは REQ-fullscreen-cockpit-layout の Phase 2/3（右カラム）とは独立。

## ユーザー確定事項（変更不可）
- 左サイドバー UI のみ対象（キャプチャ設定最優先）
- Cockpit 右カラム Phase 2/3 と混ぜない
- キャプチャ・OCR・シミュ・タブの機能退行なし

## 今回決めたいこと
1. Phase S1 / S2 / S3 の採用範囲と詳細仕様（REQ 未決事項の推奨回答）
2. SettingsPanel 行レイアウト方針（常に縦積み vs コンテナクエリ）
3. CapturePanel / SettingsPanel ネスト解消の有無と padding 値
4. Phase S1 実装チャット用完成プロンプト（Agent mode に1回で貼れる形式）

## 確認してほしいファイル
- desktop-app/app/components/SettingsPanel.tsx
- desktop-app/app/components/CapturePanel.tsx
- desktop-app/app/(main)/page.tsx（sidebar 部分のみ）
- desktop-app/app/components/RaceConditionSelector.tsx（任意・padding 参考）
- desktop-app/app/components/SimulationLauncher.tsx（任意・狭幅参考）
- docs/tasks/REQ-sidebar-compact-layout.md
- docs/tasks/REQ-fullscreen-cockpit-layout.md（Phase 1 完了範囲の参照用）

## 触らないこと（設計上も変更提案に含めない）
- desktop-app/app/components/ResultCard.tsx
- desktop-app/app/components/RaceDetailChart.tsx
- desktop-app/app/components/SkillVerifier.tsx（Cockpit Phase 3 用）
- desktop-app/app/components/TabBar.tsx
- desktop-app/public/umaemu/
- app/lib/geminiOcr.ts / app/lib/fuzzyMatcher.ts
- src-tauri/（minWidth 1150 は維持・変更提案不要）
- REQ-fullscreen-cockpit-layout Phase 2/3 の右カラムレイアウト

## 報告形式（この順で）
1. 現状整理（実効幅・sm: 問題・二重カード構造）
2. 選択肢比較（案 A 最小 / 案 B 枠整理 / 案 C コンテナクエリ）
3. Phase S1 / S2 / S3 推奨仕様（寸法・クラス方針）
4. 未決事項（推奨回答付き）
5. リスク
6. 検証手順
7. Phase S1 実装チャット用完成プロンプト（▼ここからコピー / ▲ここまで）

## スコープ（REQ 要約）
### やること
- 380px サイドバーで Settings「変更」ボタンが欠けない
- 二重カード・過剰 padding の整理（Phase による）
- 320px min リサイズでも横クリップなし

### やらないこと
- 右カラム Cockpit Phase 2/3
- OCR / WASM / キャプチャロジック変更
- StatusPanel / SkillPanel の大規模リデザイン（別 Phase 扱い）
```

### 設計レビュー承認後の返信例

```
承認します。

Phase S1 実装用の完成プロンプトを CHAT_TEMPLATE パターン A で1ブロック出力してください。
```

---

## 実装チャット運用

| 順番 | チャット | REQ Phase | モード |
|------|---------|-----------|--------|
| 1 | 設計レビュー | — | Ask |
| 2 | 実装 | Phase S1 | Agent |
| 3 | 検証（任意） | Phase S1 | Agent |
| 4 | 実装 | Phase S2 | Agent |
| 5 | 実装 | Phase S3（任意） | Agent |

---

## 参考

- Cockpit Phase 1: [`REQ-fullscreen-cockpit-layout.md`](REQ-fullscreen-cockpit-layout.md)（`98c8739`）
- 調査・改善案: Phase 1 実装後の Ask チャット（viewport sm: と二重カードの分析）
- チャット起票: [`docs/CHAT_TEMPLATE.md`](../CHAT_TEMPLATE.md)
