# REQ-stitch-twinkle-extra-page3: チャンミ月刊トゥインクル増刊号・3面の偽 bound 修正

> 親文脈: [`REQ-stitch-rewrite.md`](REQ-stitch-rewrite.md) R3.5c-2（最終ペア短 raw 保護）、[`REQ-stitch-terminal-exact-bottom.md`](REQ-stitch-terminal-exact-bottom.md)、[`REQ-stitch-terminal-coarse-reprobe.md`](REQ-stitch-terminal-coarse-reprobe.md)。
> 今回は **非最終ペア** で同じ median 補正破綻が起き、後続フレームが bound で破棄される穴を塞ぐ。

- **ステータス**: in-progress（Phase2 sessionStable 実装済・**実機検証待ち**）
- **作成日**: 2026-07-30 05:35
- **関連コミット**: `1750e69`〜（Phase2 追記予定）
- **シーン ID**: `G-CMT-TWK-P3`

---

## 解くべき問題と目的（Problem Framing）

- **現状の課題**: チャンピオンミーティング「月刊トゥインクル 増刊号」の **3面** で、オートキャプチャのフレーム取得は成功するが、結合時に Frame 4→5 が偽 bound となり Frame 5 以降（9位戦績）が破棄され、最下部が欠ける。
- **目的**: 条件付きフォールバックで偽 bound を止め、結合画像に 9位カード全体（戦績5枠）が欠けずに出るようにする。OCR・ステータス・sim は対象外。

---

## スコープ

### やること

- 非最終ペアで短 raw が median 補正で S* に潰されスコア崩壊したとき、raw / 短帯再探索側が良ければ短シフトを採用し bound early return しない
- **Phase2**: 最終ペアの `sessionStable` を prior の S* 近傍クラスタのみで判定（中盤短シフト後も skip/A2a 発火）
- `stitch.ts` の bound 警告に raw / final / method を出す
- Vitest（既存 terminal / skip / A2a / exact-bottom 維持＋新規ケース）
- `SCENE-CATALOG.md` に `G-CMT-TWK-P3` 行（golden なし）

### やらないこと

- 1面 / 2面対応
- OCR・ステータス・sim
- golden PNG / expectations 追加・期待値緩和
- bound の全廃、「短シフトを常に許す」
- layout / tabDetect / regions の本修正（上流観測は Catalog 備考のみ）
- composeCore / postProcess / capture.rs リファクタ（必須でない限り）

---

## 仕様（条件付きフォールバック）

次を **すべて** 満たすときだけ、median 補正後の bound を回避する（R3.5c-2 と同思想・条件は狭く）:

1. **非最終ペア**
2. **raw が短い**（`raw < 0.85·S*`、既存 `terminalRatio` と整合）
3. median 補正で S* に寄せたあと **スコアが `scoreMin` 未満**（今回の 0.586 型）
4. そのとき **raw（または短帯再探索）側のスコアの方が良く、かつ `scoreMin` 以上**なら raw / 短シフトを採用し、bound early return しない
5. **raw も S* もスコア不良**（いずれも `scoreMin` 未満）なら、従来どおり bound（本当のバウンドを残す）

### 退行ゲート（維持）

- 最終ペアの既存経路: zero-shift skip・terminal coarse re-probe・exact-bottom の短 raw refine 除外・最終ペアは低スコアでも terminal 優先
- G-HOF / G-CMP / FRD を退行させない
- G-FRD 短 raw→正当 refine を守る既存ガード（A2a の `raw ≥ 0.85·S*` 等）は壊さない

---

## 設計制約（契約）

- **事前条件**: 中盤ペアまで S* が安定しているセッション（トゥインクル3面の Frame 0→4 型）
- **事後条件**: 偽 bound で後続フレームを破棄しない。本当に raw/S* 双方不良なら bound を残す
- **不変条件**: 最終ペア terminal / skip / A2a / exact-bottom の振る舞いを変えない。短シフト常時許可・bound 全廃はしない
- **異常時の保証**: フォールバック不発時は従来どおり bound early return。ログに raw/final/method を出す

---

## 触るファイル（予定）

| ファイル | 変更内容 |
|---------|---------|
| `desktop-app/app/lib/stitch/shiftEstimateCore.ts` | 条件付きフォールバック |
| `desktop-app/app/lib/stitch/shiftEstimateCore.test.ts` | 新規 Vitest |
| `desktop-app/app/lib/stitch/stitch.ts` | bound ログ強化 |
| 本 REQ / `TODO.md` / `INDEX.md` | 記録 |
| `auto-capture-design-pack/SCENE-CATALOG.md` | `G-CMT-TWK-P3` 行 |

---

## 永続正本同期（エージェント必須）

| トリガー | 更新先 |
|----------|--------|
| 着手 | `TODO.md` 進行中 |
| 実装完了 | 本 REQ 決定ログ、`TODO.md`、`INDEX.md` |
| Catalog | `SCENE-CATALOG.md`（`G-CMT-TWK-P3`） |
| Phase / REQ 完了 | `CONCEPT-MAP.md`（新用語時のみ・0件可） |

---

## 完了条件

- [ ] 実機で3面再キャプチャし、結合画像に9位戦績5枠まで欠けず **9位が二重でない**（閉じる残存は不問）— **ユーザー確認待ち**
- [x] DevTools: bound する場合は raw/final/method がログに出る
- [x] Phase2: 最終ペアで skip または terminal（167 のまま ssd で終わらない）— Vitest で担保
- [x] 中盤 S* 安定・本当のバウンド bound・最終ペア terminal/skip/A2a が意図どおり（Vitest＋golden）
- [x] `stitch:golden` 退行なし（29/29）
- [x] `shiftEstimateCore` Vitest 10/10 PASS
- [x] SCENE-CATALOG に `G-CMT-TWK-P3`（golden なし）
- [x] TODO / REQ / INDEX 更新・コミット（push しない）

---

## 検証手順

1. `desktop-app` で `shiftEstimateCore` Vitest
2. CHAT_TEMPLATE「検証コマンド（共通）」stitch golden 節
3. 実機: チャンミ月刊トゥインクル増刊号・3面を再キャプチャし、結合画像を目視（OCR 不要）

---

## 決定事項ログ

| 日時 | 決定内容 | 理由 |
|------|---------|------|
| 2026-07-30 05:35 | 設計レビュー承認: 非最終・短 raw・median 補正後スコア崩壊時のみ raw/短帯を条件付き採用。bound 全廃・短シフト常時許可は禁止 | 実機ログで Frame4→5 score=0.586 偽 bound が直接原因。R3.5c-2 を非最終へ最小延長 |
| 2026-07-30 05:35 | 上流（タブ緑未検出→L2 fallback・scrollStart=layout-ratio confidence=low・wheel=stitch_fallback）は Catalog 備考のみ。layout/tabDetect 本修正は必須外 | 結合切れの主因は shift 偽 bound |
| 2026-07-30 05:35 | シーン ID `G-CMT-TWK-P3`。golden / expectations は追加しない | 完了条件は結合画像の目視のみ |
| 2026-07-30 05:45 | **実装完了**。条件付きフォールバック＋bound ログ＋Vitest 2件。golden 29/29・shiftEstimateCore 9/9 PASS | 承認済み方針どおり |
| 2026-07-30 05:45 | CONCEPT-MAP: 追記 0 件（terminal / coarse re-probe 既存カードで十分） | Phase 完了時検討 |
| 2026-07-30 05:45 | REQ `done`。実機クローズはユーザーの3面再キャプチャ目視待ち | CHANGELOG Unreleased は実機クローズ後に追記 |
| 2026-07-30 06:01 | 実機 NG: 9位二重。原因=中盤97採用後 sessionStable 偽→Frame5→6 が167 ssd | ログ確定・全体リファクタは見送り |
| 2026-07-30 06:13 | **Phase2 実装**: 最終ペア sessionStable を S* 近傍クラスタのみで判定。Vitest 10/10・golden 29/29 PASS | 中盤フォールバック維持。実機再キャプチャ待ち |
| 2026-07-30 06:13 | CONCEPT-MAP: 追記 0 件（sessionStable は既存概念の判定拡張） | Phase2 完了時検討 |
