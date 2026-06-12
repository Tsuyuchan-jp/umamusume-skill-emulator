# REQ-race-detail-graph-skill-layout-sync: スキル帯を速度折れ線グラフに連動させるレイアウト

> **レース詳細グラフ実装シリーズ** Phase 5（スキル Y 配置・速度線との視覚連動）。
> ロードマップ: [`REQ-race-detail-graph.md`](REQ-race-detail-graph.md)

- **ステータス**: draft
- **作成日**: 2026-06-12 18:10
- **関連コミット**: （完了後に記入）

---

## 開発フロー（シリーズ内の位置）

| 項目 | 内容 |
|------|------|
| **前** | Phase 4 baseline diff（**完了**）、4+ スキル hover Tooltip（**完了**）、Phase 3-P 性能（**完了**） |
| **本 Phase** | スキルラベル/赤線の Y 配置を速度折れ線と視覚的に連動させ、同一視野で発動タイミングと速度変化を読み取りやすくする |
| **着手順** | **Ask mode 設計レビュー** → 承認 → **Agent mode 実装**（Phase 分割の要否は設計で決定） |

---

## 目的

レース終盤などスキル発動が密集する区間で、**速度折れ線（上部）とスキルラベル帯（下部）が縦方向に離れ**、発動タイミングと速度変化の対応分析がしづらい。スキル表示の Y 配置・スクロール/sync を見直し、ユーザーが同一視野で詳細分析できる UI にする。

---

## 背景（現状の技術）

### アーキテクチャ

- `RaceDetailChart.tsx`: Recharts `LineChart`（速度/体力/レーン、Y domain 0–1）+ overlay SVG（スキルラベル・赤線・hover ピル）
- `raceGraphBuilder.ts`: `buildSkillMarkers` → `layoutSkillMarkers` → `skillMarkersToPx`
- スキル Y: **下ライン行レイアウト**（Phase 3 UX B 案）。`expandSkillRows` ON 時は 19px 固定行で下から積み上げ
- 速度線: プロット座標 0–1 の上部域。区間帯（直線/コーナー/坂）は y=0〜0.2 付近
- 縦拡大: `computeExpandedChartHeight` で chart 高さを伸ばし、親 `overflow-y-auto` でスクロール

### ユーザーが感じる問題

- 終盤はスキル行が chart 下部に集中し、速度線は上部 → **縦距離が大きく視線移動が必要**
- X（時間）は共有しているが、Y が独立した「帯」配置のため **速度変化とスキル発動の因果を追いにくい**

### 本家参考

- umasim `GraphOutput.kt` — 現行実装は本家準拠ラベル+赤線だが、**速度線連動 Y** は未移植の可能性（設計レビューで要確認）

---

## スコープ

### やること（設計レビューで具体化）

- [ ] スキルラベル/赤線の Y 配置方針を決定（速度値連動・近接配置・ハイブリッド等）
- [ ] `layoutSkillMarkers` / overlay 座標変換 / 縦拡大・スクロールとの整合
- [ ] 重なり・可読性・50+ スキル時のフォールバック
- [ ] Phase 1〜4 / Tooltip / baseline compare / 性能最適化への退行防止

### やらないこと（初期スコープ外・設計で確定）

- WASM `skillEvents` スキーマ変更（必要なら別 REQ）
- OCR / パレット / TabBar / `src-tauri/`
- 本家 Compose iframe 埋め込み
- minus デバフ帯の検証データ整備（[`docs/TODO.md`](../TODO.md) B-3 別タスク）

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/components/RaceDetailChart.tsx` | overlay 描画・スクロール/sync・checkbox 連動 |
| `desktop-app/app/lib/raceGraphBuilder.ts` | `layoutSkillMarkers`、高さ計算、座標変換 |
| `docs/TODO.md` | ライフサイクル |
| `docs/tasks/REQ-race-detail-graph.md` | ロードマップ行更新 |

### 触らない想定（設計レビューで例外があれば記載）

- `tools/umasim-race-wasm/`（WASM 変更が不要なら）
- `SkillVerifier.tsx` / `ResultCard.tsx`（props 変更が不要なら）
- `geminiOcr.ts` / `fuzzyMatcher.ts`

---

## 設計レビューで決めること（チェックリスト）

1. **Y 配置モデル** — 速度値 at startTime にスナップ / 速度線オフセット固定 / 区間ごとレーン / 現行下帯の改善のみ、など
2. **縦拡大 ON/OFF** — 連動レイアウト時の chart 高さ・スクロール挙動
3. **重なり解決** — ラベル衝突時の stagger / 省略 / hover 優先
4. **baseline compare** — 破線速度線とスキル overlay の Z 順・色
5. **性能** — overlay SVG 再計算頻度（[`REQ-race-detail-graph-performance.md`](REQ-race-detail-graph-performance.md) 退行）
6. **Phase 分割** — 1 REQ で完結 vs UX ポリッシュ sibling REQ

---

## 完了条件

- [ ] `docs/TODO.md` Backlog に起票と同時に REQ リンク（`draft` 起票時必須）
- [ ] 設計レビュー合意 → 決定事項ログ追記
- [ ] 実装後: 終盤密集レース（50+ スキル想定）で速度変化とスキル発動の対応が読み取りやすい
- [ ] 縦拡大 / Tooltip / Phase 4 compare / checkbox 表示切替に退行なし
- [ ] `npm run tauri dev` 実機確認
- [ ] REQ `done` + TODO 完了 + コミット

---

## 検証手順（草案）

1. 50+ スキル・sim 済みタブで終盤区間を表示
2. スキル発動 X と速度折れ線の変化が **縦スクロールなし or 最小** で追えること
3. `expandSkillRows` ON/OFF 両方
4. baseline compare ON + スキル hover Tooltip
5. タブ切替・SkillVerifier 操作後もレイアウト崩れなし

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-06-12 18:10 | draft 起票。Ask mode 設計レビュー先行 | TODO P2。実装難度高。Phase 3 下帯レイアウトの限界 |
