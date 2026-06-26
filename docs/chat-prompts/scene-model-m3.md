# 起票プロンプト: Scene Model M3

> Agent mode の **新チャット** に、下のコードブロック右上の **Copy** で一括コピーして貼り付け。
> 正本: [`REQ-stitch-scene-model.md`](../tasks/REQ-stitch-scene-model.md) M3

```
@docs/TODO.md
@docs/tasks/REQ-stitch-scene-model.md
@docs/CONCEPT-MAP.md
@auto-capture-design-pack/SCENE-CATALOG.md
@tools/stitch-golden/expectations.json

## 読者
非エンジニア共同開発者。説明は「結論→構造図/表→用語の日本語定義→詳細」。初出の英語・関数名には必ず日本語を添える。

## チャット種別
実装（Agent mode）— **Scene Model M3 のみ**（M4/M5/M6 は触らない）

## 引き継ぎ元
前チャット群 — M0〜M2 完了
- M2: expectations `sceneSpec`（partnerBand / tabRow / scrollStart / wheel）・Catalog/REQ 同期（`028221f`）
- CONCEPT-MAP 新設・種別列（`db7969f`）
- golden 現状: **19 passed + 1 expected fail**（G-FRD-S-register の tabY≈0.44 NG を `it.fails` で記録）

## 今回やること（M3: 計測パイプライン強化 / golden 駆動化）

REQ「M3: expectations に partner/tab/scroll/wheel 中間値。シーン別 Vitest」に従い、**Vitest を `sceneSpec` 正本で駆動**する。

### 1. expectations / 型の正本化
- `expectations.ts`: `sceneSpec` を必須化（全7 case）。`scrollStartRatio` / `tabRowRatio` との同期ヘルパーまたは読み取り正本を `sceneSpec.*` に寄せる
- ロード時またはテストで **sceneSpec と移行期フィールドの不整合を検出**（同期ズレ防止）
- `wheel`・`partnerBand.variant` は expectations から読める状態を維持（計測不能な項目はテスト方針を REQ 決定ログに明記）

### 2. golden.test.ts の JSON / sceneSpec 駆動化
- ケースごとにハードコードされた ratio 帯・シーン ID の重複を減らし、`getGoldenCase` + `sceneSpec` から期待値を引く
- R0 スキーマ検証: 全 case に `sceneSpec` 必須、帯の妥当性、INV-1（scrollStart.min > tabRow.max + margin）のメタ検証を追加可
- 既存 describe（R1 scrollStart / R2 layout 等）は **挙動退行しない** よう `sceneSpec.tabRow` / `sceneSpec.scrollStart` 参照へ移行
- **G-FRD-S-register の `it.fails` は維持**（M6 で通常 assert 昇格。今回は触らない）

### 3. docs 同期
- REQ Phase 表: M3 を in-progress → done、決定ログに着手・完了（Get-Date 日時）
- TODO 着手時・完了時更新
- 新用語が出たら `CONCEPT-MAP.md` を同一コミットで更新（`concept-map.mdc` 準拠）

## 触るファイル（想定）
- `desktop-app/app/lib/stitch/expectations.ts`
- `desktop-app/app/lib/stitch/golden.test.ts`
- （必要なら）`desktop-app/app/lib/stitch/goldenMeasure.ts` — **計測インターフェースの参照整理のみ**。アルゴリズム変更は M4
- `tools/stitch-golden/expectations.json` — スキーマ整合の微修正のみ可
- `docs/tasks/REQ-stitch-scene-model.md`
- `docs/TODO.md`
- （必要なら）`docs/CONCEPT-MAP.md`

## 触らない（M3 スコープ外）
- `partnerDetectCore` 新設・`capture.rs`・`tabDetectCore` / `regionsCore` の **検出アルゴリズム変更**（**M4**）
- `G-FRD-S-register` の `it.fails` → 通常 assert 昇格（**M6**）
- wheel の Rust 実装・IPC 契約（**M5**）
- 新 golden PNG 収録・アーモンドアイ別シーン行化
- `G-FRD-I`（R4 スコープ外）

## 完了条件
- [ ] Vitest が `sceneSpec` を正本として期待帯を参照（ハードコード ratio 帯の重複が整理されている）
- [ ] 全7 case で `sceneSpec` 必須・スキーマ検証 PASS
- [ ] `npm run stitch:golden` が **退行しない**（19+1 expected fail 維持）
- [ ] REQ M3 完了・Phase 表更新・決定ログ追記
- [ ] **着手時**: TODO 進行中 = M3、`最終更新:` Get-Date
- [ ] **完了時**: TODO 完了済み + コミット（push しない）
- [ ] コミットメッセージ例: `feat: Scene Model M3 golden sceneSpec 駆動化`

## 検証
cd desktop-app
npm run stitch:golden

## 人間がやること（本 Phase）
- **基本なし**（実機キャプチャ不要）
- 完了後、テストが sceneSpec と対応しているか軽くレビュー

## エージェント必須
- 着手時: `@docs/TODO.md` 読む・進行中更新・`Get-Date -Format "yyyy-MM-dd HH:mm"`
- docs 日時は PowerShell で取得（`&&` 禁止）
- `git add .` と `git commit` は別ステップ
- `.cursor/rules/communication.mdc`・`concept-map.mdc` に従う
```
