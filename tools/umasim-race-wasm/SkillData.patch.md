# SkillData.kt への追記

`umasim/race/src/commonMain/kotlin/.../data2/SkillData.kt` の `skillData2` 定義直後に追加:

```kotlin
/** WASM エンジン起動時に skill_data.txt JSON を読み込む */
fun initSkillDataFromJson(json: String) {
    skillData2 = jsonParser.decodeFromString(json)
}
```
