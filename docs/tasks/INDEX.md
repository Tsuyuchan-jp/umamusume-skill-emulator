# REQ 索引（全要件カタログ）

> **TODO の代替ではない。** 次にやることの正本は [`docs/TODO.md`](../TODO.md)。
> 本ファイルは `docs/tasks/REQ-*.md`（テンプレ除く）の **一覧・ステータス・辿りやすさ** を目的とする。
> ステータスは各 REQ の `**ステータス**:` 行を正とする。最終更新: 2026-07-23 07:35

## 使い方

| 目的 | 参照先 |
|------|--------|
| 次の作業・優先度 | [`docs/TODO.md`](../TODO.md) Backlog |
| シリーズ全体の Phase 順 | 各 **ロードマップ REQ**（例: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)） |
| 個別仕様・完了条件 | 各 REQ 本文 |
| リリース exe ビルド | [`docs/RELEASE_BUILD.md`](../RELEASE_BUILD.md) |

**INDEX 更新タイミング**: REQ を `draft` 起票または `done` にした同一コミット内で、該当行を1行追加・更新する。

---

## リリース / インフラ

| REQ | ステータス | TODO掲載 | 備考 |
|-----|-----------|---------|------|
| [`REQ-release-v1.2.0.md`](REQ-release-v1.2.0.md) | done | 完了済み | v1.2.0 リリース（2026-07-18）。長距離 sim は 2026-07-23 クローズ |
| [`REQ-release-v1.1.0.md`](REQ-release-v1.1.0.md) | done | 完了済み | v1.1.0（R1/R2.5/R3）。配布: [`RELEASE_BUILD.md`](../RELEASE_BUILD.md) |
| [`REQ-secure-api-key.md`](REQ-secure-api-key.md) | done | 完了済み | Gemini API キー → Windows 資格情報マネージャー |
| [`REQ-skill-data-fetch-fallback.md`](REQ-skill-data-fetch-fallback.md) | done | 完了済み | fetch フォールバック・sim エラー区別・AppData キャッシュ。**実機検証クローズ**（2026-07-23） |
| [`REQ-long-distance-sim-error.md`](REQ-long-distance-sim-error.md) | done | 完了済み | 失敗走スキップ＋ヘッダー完走表示。**実機検証クローズ**（2026-07-23 / `a138908`） |

---

## Cockpit / UI

| REQ | ステータス | TODO掲載 | 備考 |
|-----|-----------|---------|------|
| [`REQ-fullscreen-cockpit-layout.md`](REQ-fullscreen-cockpit-layout.md) | done | Backlog・完了済み | Phase 1〜3 完了。Backlog: サムネイル飛翔アニメ削除 |
| [`REQ-sidebar-compact-layout.md`](REQ-sidebar-compact-layout.md) | done | 完了済み | Phase S1+S2。S3 コンテナクエリは見送り |
| [`REQ-tab-switch-performance.md`](REQ-tab-switch-performance.md) | done | 完了済み | keep-alive + TabBar 刷新。Backlog: 非アクティブタブ負荷軽減（将来） |

---

## レース詳細グラフ

**ロードマップ**: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md) — Phase 1〜5 本線 **done**。Backlog に overlay 改善候補あり（REQ 未起票）。

### ロードマップ

| REQ | ステータス | TODO掲載 | 備考 |
|-----|-----------|---------|------|
| [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md) | done（Phase 5 完了） | 完了済み | シリーズ索引。Phase 表は子 REQ を参照 |

### Phase 1〜4（本線）

| REQ | ステータス | TODO掲載 | 備考 |
|-----|-----------|---------|------|
| [`REQ-race-detail-graph-phase1.md`](REQ-race-detail-graph-phase1.md) | done | 完了済み | MVP（3本線） |
| [`REQ-race-detail-graph-axis.md`](REQ-race-detail-graph-axis.md) | done | 完了済み | Y軸・単位改善 |
| [`REQ-race-detail-graph-phase2.md`](REQ-race-detail-graph-phase2.md) | done | 完了済み | 区間オーバーレイ |
| [`REQ-race-detail-graph-phase3.md`](REQ-race-detail-graph-phase3.md) | done | Backlog・完了済み | スキル帯・表示切替。Backlog: デバフ帯実機検証 |
| [`REQ-race-detail-graph-phase3-ux.md`](REQ-race-detail-graph-phase3-ux.md) | done | 完了済み | UX ポリッシュ |
| [`REQ-race-detail-graph-performance.md`](REQ-race-detail-graph-performance.md) | done | 完了済み | UI レスポンス Phase 1+2 |
| [`REQ-race-detail-graph-phase4.md`](REQ-race-detail-graph-phase4.md) | done | 完了済み | baseline diff（核機能） |
| [`REQ-race-detail-graph-skill-tooltip.md`](REQ-race-detail-graph-skill-tooltip.md) | done | 完了済み | スキル hover Tooltip |

### Phase 5（Google Map 型 + Engine）

| REQ | ステータス | TODO掲載 | 備考 |
|-----|-----------|---------|------|
| [`REQ-race-detail-graph-skill-layout-sync.md`](REQ-race-detail-graph-skill-layout-sync.md) | superseded | 完了済み | → [`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md) |
| [`REQ-race-detail-graph-analysis-revert.md`](REQ-race-detail-graph-analysis-revert.md) | done | 完了済み | 5-R1 分析モード revert |
| [`REQ-race-detail-graph-same-time-stack-compact.md`](REQ-race-detail-graph-same-time-stack-compact.md) | done | 完了済み | 5-R1b 同時刻スタック圧縮 |
| [`REQ-race-detail-graph-time-window.md`](REQ-race-detail-graph-time-window.md) | superseded | — | → [`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md) |
| [`REQ-race-detail-graph-pan-zoom.md`](REQ-race-detail-graph-pan-zoom.md) | superseded | — | → [`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md) |
| [`REQ-race-detail-graph-map-view.md`](REQ-race-detail-graph-map-view.md) | done | Backlog・完了済み | **Phase 5 実装正本**。Backlog: overlay 中間/理想レベル |
| [`REQ-race-detail-graph-map-view-perf-fallback.md`](REQ-race-detail-graph-map-view-perf-fallback.md) | done | 完了済み | domain 30fps cap |
| [`REQ-race-detail-graph-interaction-engine.md`](REQ-race-detail-graph-interaction-engine.md) | done | 完了済み | Dual-Viewport Canvas Engine Phase 1〜4 |
| [`REQ-race-detail-graph-wheel-continuous-zoom.md`](REQ-race-detail-graph-wheel-continuous-zoom.md) | done | 完了済み | 連続ホイール idle 調整 |
| [`REQ-race-detail-graph-overlay-handoff-latency.md`](REQ-race-detail-graph-overlay-handoff-latency.md) | done | 完了済み | ホイール停止後 overlay 復帰 latency |

### 個別 Fix（Phase 表外）

| REQ | ステータス | TODO掲載 | 備考 |
|-----|-----------|---------|------|
| [`REQ-race-detail-graph-stamina-keep-line.md`](REQ-race-detail-graph-stamina-keep-line.md) | done | 完了済み | スタミナキープ持続線異常 |
| [`REQ-race-detail-graph-vertical-clip.md`](REQ-race-detail-graph-vertical-clip.md) | done | 完了済み | 縦拡大 ON 時末尾スキル帯クリップ |

---

## キャプチャ / OCR 前処理

| REQ | ステータス | TODO掲載 | 備考 |
|-----|-----------|---------|------|
| [`REQ-file-ocr-status.md`](REQ-file-ocr-status.md) | done | 完了済み | 過去キャプチャ画像のファイル選択 → 既存 OCR。autoCopy/再保存なし（`528bce2`） |
| [`REQ-ocr-cancel.md`](REQ-ocr-cancel.md) | done | 完了済み | AbortController + CapturePanel「停止」。**実機検証クローズ**（2026-07-23 06:04 / `bac51e7`） |
| [`REQ-auto-capture-multi-screen.md`](REQ-auto-capture-multi-screen.md) | done | 完了済み | Phase 1/1b/3 本線 done。Phase 2 は任意見送り |
| [`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md) | done | 完了済み | R0–R5 完了（R5: `opencvStitcher.ts` 削除・`stitchImages` 一本化） |
| [`REQ-stitch-scene-model.md`](REQ-stitch-scene-model.md) | in-progress | 進行中 **M1** | シーンモデル正本化ロードマップ。Catalog: `SCENE-CATALOG.md` |
| [`REQ-stitch-terminal-exact-bottom.md`](REQ-stitch-terminal-exact-bottom.md) | done | 完了済み | 最下部びったし二重結合。案 A′ + 実機クローズ（2026-07-11） |
| [`REQ-stitch-terminal-coarse-reprobe.md`](REQ-stitch-terminal-coarse-reprobe.md) | done | 完了済み | 最終 coarse≈S* 誤採用。案 A2a + 実機クローズ（2026-07-14） |

---

## スキル表示 / データ

| REQ | ステータス | TODO掲載 | 備考 |
|-----|-----------|---------|------|
| [`REQ-skill-display.md`](REQ-skill-display.md) | done | Backlog | 5色表示等。Backlog: StatusPanel 色分け（任意） |
| [`REQ-palette-local-skill-data.md`](REQ-palette-local-skill-data.md) | done | Backlog・完了済み | パレットローカル参照。Backlog: レアリティ段階別並び |

---

## 統計

| 項目 | 件数 |
|------|------|
| REQ 総数（テンプレ除く） | 36 |
| done | 27 |
| draft | 4 |
| in-progress | 3 |
| superseded | 3 |
| ロードマップ（親） | 1（`REQ-race-detail-graph.md`） |
