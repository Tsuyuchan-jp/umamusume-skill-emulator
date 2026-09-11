# SkillData.kt への追記

本家に `loadLocalSkillData` / `loadLocalSkillDatatring`（wasm 実体は TODO）があっても、JS から JSON 文字列を渡す `initSkillDataFromJson` は残す（置き換えない）。

`umasim/race/src/commonMain/kotlin/.../data2/SkillData.kt` の `skillData2` 定義直後に追加:

```kotlin
/** WASM エンジン起動時に skill_data.txt JSON を読み込む */
fun initSkillDataFromJson(json: String) {
    skillData2 = jsonParser.decodeFromString(json)
}
```
