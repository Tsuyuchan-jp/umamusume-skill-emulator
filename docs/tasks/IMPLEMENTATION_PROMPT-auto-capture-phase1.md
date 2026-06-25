# オートキャプチャ Phase 1 — 実装チャット用完成プロンプト

> 新チャット（Agent mode）先頭に **「▼ここからコピー」〜「▲ここまで」** をそのまま貼る。
> 設計正本: [`REQ-auto-capture-multi-screen.md`](REQ-auto-capture-multi-screen.md)（D1 完了 2026-06-26）
> 検証データ: `@auto-capture-design-pack/`

---

▼ここからコピー

@docs/PROJECT.md
@docs/TODO.md
@docs/tasks/REQ-auto-capture-multi-screen.md
@auto-capture-design-pack/

## チャット種別
実装（Agent mode）

## 進め方（重要）
- 下記「承認済み方針」に厳密に従って実装する
- Phase 1 は opencvStitcher.ts のみ。capture.rs は触らない
- 方針と異なる大きな変更が必要になったら実装を止めて報告し、再承認を待つ
- 着手時・完了時に docs/TODO.md を更新し、毎作業コミット（push しない）

## 承認済み方針

### 背景（D1 確定）
- 設計パックで全経路（HOF/TRN/CMP/FRD）の Rust オートキャプチャは末端到達済み。キャプチャ4プロファイル分岐は不要
- 不具合は結合（opencvStitcher.ts）。TRN: キャプチャ正常・結合 NG（スクロールバー隠しがタブより上から始まる等）。FRD: 低 score で結合 NG
- F-1: ユーザーが対象タブを手動で開いてからキャプチャ。F-2: スキル・継承・育成情報タブがスコープ。F-3: 結合先。F-4: 汎用

### アーキテクチャ
- CaptureMode: Phase 1 では現行 capture.rs を変更しない（GenericScroll のまま）
- StitchLayout（初回フレーム画像判定）:
  - L2: タブ2つ（コンディション/スキル）→ headerHeight = cropHeight * 0.22
  - L3: タブ3つ → headerHeight = cropHeight * 0.16（現行・回帰正本）
  - L3+Btn: L3 + 練習パートナー解除帯検出 → headerHeight = cropHeight * 0.18
  - footerHeight は全レイアウト cropHeight * 0.15 維持
- StitchTab（開いているタブ）:
  - Skill: 現行スキル一覧結合（修正対象）
  - Inheritance: 継承因子。緑履歴クロップ規則を S-5 で整理（因子ヘッダー Y≈504 誤スキップ回避）
  - TrainingInfo: Phase 1 では未実装可。Phase 1b（別コミット）で S-6
- 判別不能: L3 + Skill + console.warn。殿堂入り専用に倒さない

### 結合修正タスク（Phase 1 必須 S-1〜S-5）
- S-1: trueScrollStartY をタブ下端（headerHeight）以下にクランプ。静的領域にスクロールバー隠しを適用しない
- S-2: スクロールバー隠し（cv.repeat）の Y 範囲を max(trueScrollStartY, headerHeight) 〜 scrollDrawY、幅3%のみ
- S-3: StitchLayout に応じた headerHeight（上記比率）。L3 の 16% で HOF/CMP 回帰が変わらないこと
- S-4: テンプレートマッチで score<0.85 または scrollAmount<=0 のとき、隣接フレーム間で absdiff 縦シフト探索し最良の正の scrollAmount を採用。それでも<=0 のみ overlap=0
- S-5: Inheritance タブ: 緑帯クロップの searchStartY と「因子ヘッダー誤判定」閾値を見直し。FRD-factor ログ（Y=504 スキップ）を解消

### 定数・コード品質
- 比率・閾値（0.85, 0.22, 0.16, 0.18, 0.15, 3% 等）を opencvStitcher.ts 先頭の STITCH_* 定数に集約
- レイアウト/タブ判定は純関数（detectStitchLayout, detectStitchTab）に分離し stitchWithOpenCV から呼ぶ
- console.log に layout / tab / headerHeight / 各 Frame i->i+1 の score・scrollAmount（既存維持）

### 回帰・GOLDEN
- ウィンドウ: HOF skill/factor/info（設計パック stitched-OK 相当）、CMP 各タブ OK 維持
- TRN: auto-capture-design-pack/golden/TRN/ 4フレームで結合テスト可能なら開発中に使用。合格は screenshots/TRN/stitched-expected-memo.txt
- FRD skill: golden/FRD/skill/ で NG→OK
- フルスクリーン: logs/fullscreen/HOF-skill-console.txt 相当の score≈0.98・scroll≈281 パターンを退行させない。TRN fullscreen はユーザー準備後に確認

### Phase 1 でやらないこと
- capture.rs の経路別プロファイル
- geminiOcr.ts / fuzzyMatcher.ts / WASM
- TrainingInfo 結合（Phase 1b / S-6）
- タブ自動切替

## 背景
docs/TODO.md P1「オートキャプチャの複数ゲーム画面対応」/ REQ-auto-capture-multi-screen Phase 1（D1 承認済み）

## 今回やること
opencvStitcher.ts に StitchLayout/StitchTab 分岐と S-1〜S-5 を実装。任意で CapturePanel に「キャプチャ前に対象タブを開いてください」1行。

## 触るファイル
- desktop-app/app/lib/opencvStitcher.ts（主）
- desktop-app/app/hooks/useCapture.ts（任意・ログのみ）
- desktop-app/app/components/CapturePanel.tsx（任意・ヒント文言）
- docs/TODO.md（着手・完了時）
- docs/tasks/REQ-auto-capture-multi-screen.md（Phase 状態・決定ログ）
- docs/tasks/INDEX.md（着手時 in-progress 等）

## 触らないファイル
- desktop-app/src-tauri/src/capture.rs（Phase 1 禁止）
- desktop-app/app/lib/geminiOcr.ts
- desktop-app/app/lib/fuzzyMatcher.ts
- sim / WASM 経路

## 完了条件
- [ ] S-1〜S-5 実装済み
- [ ] TRN: stitched-expected-memo の合格条件（スキル全行・タブ上右端非崩壊）
- [ ] FRD skill 結合 NG 解消（設計パック golden/FRD/skill/）
- [ ] HOF/CMP ウィンドウ結合回帰 OK
- [ ] フルスクリーン HOF skill ログパターン（score≈0.98）退行なし
- [ ] 着手時: TODO Backlog→進行中、最終更新・フォーカス（最初のコミット）
- [ ] 完了時: TODO 完了済みは Phase 3 まで待つ場合は「Phase 1 完了」を進行中→Backlog または REQ に Phase 1 done 記録。少なくとも REQ Phase 1 を done 記録、コミット
- [ ] コミット（push しない）

▲ここまで
