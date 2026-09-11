# SkillData.kt への追記

本家に `loadLocalSkillData` / `loadLocalSkillDatatring` があっても、JS から JSON 文字列を渡す `initSkillDataFromJson` は残す（置き換えない）。

wasm 実体（`SkillData.wasmJs.kt`）が `TODO("Not supported")` のままだと、モジュール起動時の `main()` → `loadLocalSkillData()` で落ちる。空 JSON 配列 `"[]"` を返すようにする（実データは `initializeEngine` → `initSkillDataFromJson`）。

`umasim/race/src/commonMain/kotlin/.../data2/SkillData.kt` の `skillData2` 定義直後に追加:

```kotlin
/** WASM エンジン起動時に skill_data.txt JSON を読み込む */
fun initSkillDataFromJson(json: String) {
    skillData2 = jsonParser.decodeFromString(json)
}
```
