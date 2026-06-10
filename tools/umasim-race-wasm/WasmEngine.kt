/*
 * umasim :race WASM ブリッジ — initializeEngine / runSimulation / runSimulationDetail
 * 配置先: umasim/race/src/wasmJsMain/kotlin/io/github/mee1080/umasim/race/
 */
package io.github.mee1080.umasim.race

import io.github.mee1080.umasim.race.calc2.*
import io.github.mee1080.umasim.race.data.*
import io.github.mee1080.umasim.race.data2.SkillData
import io.github.mee1080.umasim.race.data2.initSkillDataFromJson
import io.github.mee1080.umasim.race.data2.skillData2
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@OptIn(ExperimentalSerializationApi::class, ExperimentalJsExport::class)
private val json = Json {
    allowTrailingComma = true
    encodeDefaults = true
}

private var skillById: Map<String, SkillData> = emptyMap()

@JsExport
fun initializeEngine(skillDataJson: String) {
    initSkillDataFromJson(skillDataJson)
    skillById = skillData2.associateBy { it.id }
}

@JsExport
fun runSimulation(inputJson: String): String {
    val (setting, calculator) = parseInput(inputJson)
    val result = calculator.simulate(setting).first
    return json.encodeToString(result.toSummaryOutput())
}

@JsExport
fun runSimulationDetail(inputJson: String): String {
    val (setting, calculator) = parseInput(inputJson)
    val (summary, state) = calculator.simulate(setting)
    val frames = state.simulation.frames.map { frame ->
        FrameOutput(
            speed = frame.speed,
            sp = frame.sp,
            startPosition = frame.startPosition,
            currentLane = frame.currentLane,
        )
    }
    val detail = RaceDetailResponse(
        summary = summary.toSummaryOutput(),
        frames = frames,
        courseLength = setting.courseLength,
        phase1Start = setting.phase1Start,
        phase2Start = setting.phase2Start,
        gateCount = setting.track.gateCount,
        initialLaneAdjuster = setting.track.initialLaneAdjuster,
    )
    return json.encodeToString(detail)
}

private fun parseInput(inputJson: String): Pair<RaceSetting, RaceCalculator> {
    val request = json.decodeFromString<SimulationRequest>(inputJson)
    val umaStatus = request.umaStatus.toUmaStatus(skillById)
    val track = request.track.toTrack()
    val setting = RaceSetting(
        umaStatus = umaStatus,
        track = track,
        season = request.season,
        weather = request.weather,
        badStart = request.badStart,
    )
    return setting to RaceCalculator(SystemSetting())
}

@Serializable
private data class SimulationRequest(
    val umaStatus: UmaStatusRequest,
    val track: TrackRequest,
    val season: Int = 0,
    val weather: Int = 0,
    val badStart: Boolean = false,
)

@Serializable
private data class UmaStatusRequest(
    val speed: Int = 1800,
    val stamina: Int = 1600,
    val power: Int = 1300,
    val guts: Int = 1200,
    val wisdom: Int = 1300,
    val condition: String = "BEST",
    val style: String = "NIGE",
    val popularity: Int = 1,
    val gateNumber: Int = 0,
    val distanceFit: String = "S",
    val surfaceFit: String = "A",
    val styleFit: String = "A",
    val skillIds: List<String> = emptyList(),
) {
    fun toUmaStatus(skillMap: Map<String, SkillData>): UmaStatus {
        val skills = skillIds.mapNotNull { skillMap[it] }
        return UmaStatus(
            speed = speed,
            stamina = stamina,
            power = power,
            guts = guts,
            wisdom = wisdom,
            condition = Condition.valueOf(condition),
            style = Style.valueOf(style),
            distanceFit = FitRank.valueOf(distanceFit),
            surfaceFit = FitRank.valueOf(surfaceFit),
            styleFit = FitRank.valueOf(styleFit),
            popularity = popularity,
            gateNumber = gateNumber,
            hasSkills = skills,
        )
    }
}

@Serializable
private data class TrackRequest(
    val location: Int,
    val course: Int,
    val condition: String = "GOOD",
    val gateCount: Int = 9,
) {
    fun toTrack(): Track = Track(
        location = location,
        course = course,
        condition = CourseCondition.valueOf(condition),
        gateCount = gateCount,
    )
}

@Serializable
private data class FrameOutput(
    val speed: Double,
    val sp: Double,
    val startPosition: Double,
    val currentLane: Double,
)

@Serializable
private data class SummaryOutput(
    val raceTime: Double,
    val raceTimeDelta: Double,
    val raceTimeWithoutRunUp: Double,
    val maxSpurt: Boolean,
    val spDiff: Double,
    val positionCompetitionCount: Int,
    val staminaKeepDistance: Double,
    val competeFightFinished: Boolean,
    val competeFightTime: Double,
)

private fun RaceSimulationResult.toSummaryOutput() = SummaryOutput(
    raceTime = raceTime,
    raceTimeDelta = raceTimeDelta,
    raceTimeWithoutRunUp = raceTimeWithoutRunUp,
    maxSpurt = maxSpurt,
    spDiff = spDiff,
    positionCompetitionCount = positionCompetitionCount,
    staminaKeepDistance = staminaKeepDistance,
    competeFightFinished = competeFightFinished,
    competeFightTime = competeFightTime,
)

@Serializable
private data class RaceDetailResponse(
    val summary: SummaryOutput,
    val frames: List<FrameOutput>,
    val courseLength: Int,
    val phase1Start: Double,
    val phase2Start: Double,
    val gateCount: Int,
    val initialLaneAdjuster: Double,
)
