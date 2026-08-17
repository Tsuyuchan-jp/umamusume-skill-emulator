# 第三者コンポーネントについて（NOTICE）

本アプリのレースシミュレーションは、次のソフトウェアを利用しています。

## umasim

- 作者: mee1080
- リポジトリ: https://github.com/mee1080/umasim
- ライセンス: GNU Affero General Public License v3.0（AGPLv3）
- ライセンス全文: [licenses/AGPL-3.0.txt](licenses/AGPL-3.0.txt)

umasim の README によると、`race` 配下は Romulus Urakagi Tsai（@urakagi）による [uma-clock-emu](https://github.com/urakagi/uma-clock-emu) からの移植を含みます。

### 本アプリが同梱・利用しているもの

- umasim `:race` をビルドした `race.js` および WebAssembly（`desktop-app/public/umaemu/`）
- umasim の `data/skill_data.txt` に由来するスキル定義（実行時取得および同梱フォールバック）
- コースデータの生成元（`rawCourseData`）

### 本アプリ側の改変

WASM を呼び出すための薄い橋（ブリッジ）です。umasim 本体のレース計算ロジックの丸ごとコピーではありません。

- `tools/umasim-race-wasm/WasmEngine.kt`
- `tools/umasim-race-wasm/SkillData.patch.md`

## ソースコードの提供

本アプリは公開 GitHub リポジトリとしては配布していません。

AGPLv3 に従い、**配布を受けた方からの求めがあれば**、対応するソース（上記の改変分を含む）を提供します。umasim 本体のソースは、上流リポジトリから入手できます。

- 上流: https://github.com/mee1080/umasim
