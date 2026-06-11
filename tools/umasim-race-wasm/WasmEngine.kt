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
import io.github.mee1080.utility.roundToString
import io.github.mee1080.utility.toPercentString
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

private const val FRAME_PER_SECOND = 15.0

@JsExport
fun runSimulationDetail(inputJson: String): String {
    val (setting, calculator) = parseInput(inputJson)
    val (summary, state) = calculator.simulate(setting)
    val rawFrames = state.simulation.frames
    val frames = rawFrames.map { frame ->
        FrameOutput(
            speed = frame.speed,
            sp = frame.sp,
            startPosition = frame.startPosition,
            currentLane = frame.currentLane,
        )
    }
    val trackDetail = setting.trackDetail
    val detail = RaceDetailResponse(
        summary = summary.toSummaryOutput(),
        frames = frames,
        courseLength = setting.courseLength,
        phase1Start = setting.phase1Start,
        phase2Start = setting.phase2Start,
        gateCount = setting.track.gateCount,
        initialLaneAdjuster = setting.track.initialLaneAdjuster,
        trackDetail = TrackDetailOutput(
            straights = trackDetail.straights.map { SectionOutput(it.start, it.end) },
            corners = trackDetail.corners.map { SectionOutput(it.start, it.end) },
            slopes = trackDetail.slopes.map { SlopeOutput(it.start, it.end, it.slope) },
        ),
        skillEvents = buildSkillEvents(rawFrames, setting.courseLength),
    )
    return json.encodeToString(detail)
}

/** フレーム走査で発動区間を組み立て（フレーム毎 activeSkillIds 全量は出力しない） */
private fun buildSkillEvents(frames: List<RaceFrame>, courseLength: Int): List<SkillEventOutput> {
    if (frames.isEmpty()) return emptyList()
    val events = mutableListOf<SkillEventOutput>()
    frames.forEachIndexed { index, frame ->
        frame.triggeredSkills.forEach { triggered ->
            val skill = triggered.invoke.skill
            val skillId = skill.id
            val kind = if (skill.rarity == "minus") "debuff" else "skill"
            val endIndex = (index + 1 until frames.size).firstOrNull { i ->
                frames[i].endedSkills.any { it.data.skill.id == skillId }
            }
            val startRate = frame.startPosition / courseLength
            val endRate = endIndex?.let { frames[it].startPosition / courseLength }
            val effectText = buildGraphSkillDescription(triggered, kind, startRate, endRate)
            events.add(
                SkillEventOutput(
                    skillId = skillId,
                    startTime = index / FRAME_PER_SECOND,
                    endTime = (endIndex ?: (frames.size - 1)) / FRAME_PER_SECOND,
                    kind = kind,
                    effectText = effectText,
                )
            )
        }
    }
    return events
}

/** AppState.kt GraphSkill.description 相当 */
private fun buildGraphSkillDescription(
    effect: TriggeredSkill,
    kind: String,
    startRate: Double,
    endRate: Double?,
): String = buildString {
    val heal = effect.heal
    if (heal != null) {
        val waste = effect.waste ?: 0.0
        if (waste > 0.0) {
            appendLine("体力：${heal.roundToString(2)} (溢れ：${waste.roundToString(2)})")
        } else {
            appendLine("体力：${heal.roundToString(2)}")
        }
    }
    val operating = effect.operating
    if (operating != null) {
        if (operating.targetSpeed > 0.0) {
            appendLine("目標速度：${operating.targetSpeed.roundToString(2)}")
        }
        if (operating.speedWithDecel > 0.0) {
            appendLine("現在速度：${operating.speedWithDecel.roundToString(2)}")
        }
        if (operating.currentSpeed > 0.0) {
            appendLine("現在速度：${operating.currentSpeed.roundToString(2)}")
        }
        if (operating.acceleration > 0.0) {
            appendLine("加速度：${operating.acceleration.roundToString(2)}")
        }
        if (operating.laneChangeSpeed > 0.0) {
            appendLine("レーン移動速度：${operating.laneChangeSpeed.roundToString(2)}")
        }
        if (operating.duration > 0.0) {
            appendLine("持続時間：${operating.duration.roundToString(2)}")
        }
    }
    val startPercent = startRate.toPercentString(1)
    if (kind == "debuff" || endRate == null) {
        appendLine(startPercent)
    } else {
        appendLine("${startPercent}〜${endRate.toPercentString(1)}")
    }
}.trim()

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
private data class SectionOutput(
    val start: Double,
    val end: Double,
)

@Serializable
private data class SlopeOutput(
    val start: Double,
    val end: Double,
    val slope: Double,
)

@Serializable
private data class TrackDetailOutput(
    val straights: List<SectionOutput>,
    val corners: List<SectionOutput>,
    val slopes: List<SlopeOutput>,
)

@Serializable
private data class SkillEventOutput(
    val skillId: String,
    val startTime: Double,
    val endTime: Double,
    val kind: String,
    val effectText: String = "",
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
    val trackDetail: TrackDetailOutput? = null,
    val skillEvents: List<SkillEventOutput> = emptyList(),
)
