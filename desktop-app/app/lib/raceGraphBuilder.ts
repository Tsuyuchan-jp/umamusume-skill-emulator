import { getSkillNameById, getSkillRarityInfoById, SkillDisplayRarity } from "./umasimSkillData";
import { RaceDetailDump, RaceFrameDump, SkillEventDump, SkillEventKind, TrackDetailDump } from "./types";

/** umasim RaceOperation.toGraphData 相当の定数 */
const FRAME_PER_SECOND = 15;
export const SPEED_MIN = 13;
export const SPEED_MAX = 30;
const STAMINA_MIN = -200;
const HORSE_LANE = 11.25 / 18;
export const STAMINA_PLOT_FLOOR = 0.05;
const LANE_PLOT_FLOOR = 0.05;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface GraphPoint {
  time: number;
  /** 生値 m/s */
  speed: number;
  /** プロット座標 [0.05, 1] */
  stamina: number;
  /** プロット座標 [0.05, 1] */
  lane: number;
  /** Tooltip 用: 初期体力比 % */
  staminaPct: number;
  /** Tooltip 用: レーン位置 %（0%=内枠 100%=外枠） */
  lanePct: number;
  /** baseline 比較時: 生値 m/s */
  baselineSpeed?: number;
  /** baseline 比較時: プロット座標 [0.05, 1] */
  baselineStamina?: number;
  /** baseline 比較時: プロット座標 [0.05, 1] */
  baselineLane?: number;
  /** baseline 比較時: Tooltip 用 初期体力比 % */
  baselineStaminaPct?: number;
  /** baseline 比較時: Tooltip 用 レーン位置 % */
  baselineLanePct?: number;
}

/** 本家 GraphOutput.kt 準拠の区間帯（ReferenceArea 用） */
export interface AreaBand {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  fill: string;
  /** 上端ボーダー色（直線/コーナーの色弱対策） */
  stroke?: string;
  /** 上端ボーダー線種。未指定は実線 */
  strokeDasharray?: string;
  /** 帯の不透明度。未指定は 0.15 */
  fillOpacity?: number;
}

/** 明るめシアン（直線）— 速度線 #3b82f6 と被りにくいトーン */
const AREA_STRAIGHT_FILL = "#5BA8E8";
/** 暗め赤紫（コーナー）— 直線帯と明度差で区別 */
const AREA_CORNER_FILL = "#9B5FB8";
/** 落ち着いたティール（上り）— レーン緑 #22c55e と被りにくい */
const AREA_UPSLOPE_FILL = "#4A9E7A";
/** 落ち着いた琥珀（下り） */
const AREA_DOWNSLOPE_FILL = "#C9A227";
/** 坂帯は半分高さのためやや濃く */
const AREA_SLOPE_FILL_OPACITY = 0.18;

export interface GraphDisplayState {
  showSpeed: boolean;
  showStamina: boolean;
  showLane: boolean;
  showAreas: boolean;
  showSkills: boolean;
  showDebuffs: boolean;
  expandSkillRows: boolean;
}

export const DEFAULT_GRAPH_DISPLAY_STATE: GraphDisplayState = {
  showSpeed: true,
  showStamina: true,
  showLane: true,
  showAreas: true,
  showSkills: true,
  showDebuffs: true,
  expandSkillRows: false,
};

/** 本家 GraphOutput.kt 準拠: スキル名ラベル + 赤い発動線 */
export interface SkillMarker {
  skillId: string;
  label: string;
  startTime: number;
  endTime: number;
  /** ラベル上端 y（percent 軸・下ライン配置） */
  y: number;
  /** 発動区間の水平線 y（スキル名の下・非接触） */
  lineY: number;
  labelColor: string;
  kind: SkillEventKind;
  row: number;
  /** hover 一意キー（skillId + startTime） */
  tooltipKey: string;
  /** Tooltip 本文（GraphSkill.description 相当。WASM effectText 優先） */
  effectText: string;
}

/** 縦拡大時のチャート高さ */
export const SKILL_CHART_BASE_HEIGHT = 360;
/** 1 スキル行の高さ（px）— 縦拡大 ON 時 */
export const SKILL_ROW_HEIGHT = 19;
export const SKILL_FONT_SIZE = 10;
export const SKILL_LINE_GAP = 3;
/** 赤線を上方向へ寄せる微調整（px） */
export const SKILL_LINE_Y_NUDGE_UP = 1;
export const SKILL_ROW_TOP_PAD = 4;
/** LineChart margin と同期（layoutSkillMarkers 用） */
export const SKILL_CHART_MARGIN_TOP = 24;
export const SKILL_CHART_MARGIN_BOTTOM = 4;

/** 縦拡大 ON 時に全スキル行を収める chartHeight（margin + 行高の単一ソース） */
export function computeExpandedChartHeight(eventCount: number): number {
  return Math.max(
    SKILL_CHART_BASE_HEIGHT,
    SKILL_CHART_MARGIN_TOP +
      SKILL_ROW_TOP_PAD +
      eventCount * SKILL_ROW_HEIGHT +
      SKILL_CHART_MARGIN_BOTTOM,
  );
}

export interface SkillLayoutOptions {
  /** true: 19px 固定行。false: skillMargin ドメイン詰め（重なり OK・枠内収納） */
  expanded?: boolean;
}

/** 下ライン行レイアウトを percent 軸 y に変換 */
export function layoutSkillMarkers(
  markers: SkillMarker[],
  chartHeightPx: number,
  options: SkillLayoutOptions = {},
): SkillMarker[] {
  const { expanded = true } = options;
  const plotHeight = chartHeightPx - SKILL_CHART_MARGIN_TOP - SKILL_CHART_MARGIN_BOTTOM;
  if (plotHeight <= 0 || markers.length === 0) return markers;

  const eventCount = markers.length;
  const lineOffsetDomain = (SKILL_FONT_SIZE + SKILL_LINE_GAP - SKILL_LINE_Y_NUDGE_UP) / plotHeight;

  if (!expanded) {
    const skillMargin = Math.min(0.1, 0.8 / eventCount);
    return markers.map((marker) => {
      const labelY = 1 - skillMargin * marker.row;
      return {
        ...marker,
        y: labelY,
        lineY: labelY - lineOffsetDomain,
      };
    });
  }

  return markers.map((marker) => {
    const labelTopPx = SKILL_ROW_TOP_PAD + marker.row * SKILL_ROW_HEIGHT;
    const lineTopPx = labelTopPx + SKILL_FONT_SIZE + SKILL_LINE_GAP - SKILL_LINE_Y_NUDGE_UP;
    return {
      ...marker,
      y: 1 - labelTopPx / plotHeight,
      lineY: 1 - lineTopPx / plotHeight,
    };
  });
}

/** overlay SVG 座標変換用: Recharts LineChart の固定マージン＋軸幅 */
export const OVERLAY_MARGIN_LEFT = 52; // chart margin.left(4) + left YAxis width(48)
export const OVERLAY_MARGIN_RIGHT = 88; // chart margin.right(48) + right YAxis width(40)

/** overlay SVG 上のスキルマーカーのピクセル座標 */
export interface SkillMarkerPx {
  skillId: string;
  label: string;
  labelColor: string;
  kind: SkillEventKind;
  startTime: number;
  tooltipKey: string;
  effectText: string;
  /** ラベル・赤線の開始 x（px） */
  startX: number;
  /** 赤線の終了 x（px） */
  endX: number;
  /** ラベル上端 y（px、dominantBaseline="hanging" 用） */
  labelY: number;
  /** 赤線 y（px） */
  lineY: number;
  /** ラベル hit area 幅（px） */
  hitWidth: number;
  /** ラベル hit area 高さ（px） */
  hitHeight: number;
}

/**
 * layoutSkillMarkers の domain 座標を overlay SVG ピクセル座標に変換する
 *   x = (time / maxTime) * plotWidth + OVERLAY_MARGIN_LEFT
 *   y = (1 - domainY) * plotHeight + SKILL_CHART_MARGIN_TOP
 */
export function skillMarkersToPx(
  markers: SkillMarker[],
  chartHeightPx: number,
  chartWidthPx: number,
  maxTime: number,
): SkillMarkerPx[] {
  if (!markers.length || maxTime <= 0 || chartWidthPx <= 0 || chartHeightPx <= 0) return [];

  const plotHeight = chartHeightPx - SKILL_CHART_MARGIN_TOP - SKILL_CHART_MARGIN_BOTTOM;
  const plotWidth = chartWidthPx - OVERLAY_MARGIN_LEFT - OVERLAY_MARGIN_RIGHT;
  if (plotHeight <= 0 || plotWidth <= 0) return [];

  return markers.map((m) => {
    const hitWidth = Math.max(m.label.length * SKILL_FONT_SIZE * 0.55, SKILL_FONT_SIZE * 2) + 4;
    return {
      skillId: m.skillId,
      label: m.label,
      labelColor: m.labelColor,
      kind: m.kind,
      startTime: m.startTime,
      tooltipKey: m.tooltipKey,
      effectText: m.effectText,
      startX: (m.startTime / maxTime) * plotWidth + OVERLAY_MARGIN_LEFT,
      endX: (m.endTime / maxTime) * plotWidth + OVERLAY_MARGIN_LEFT,
      labelY: (1 - m.y) * plotHeight + SKILL_CHART_MARGIN_TOP,
      lineY: (1 - m.lineY) * plotHeight + SKILL_CHART_MARGIN_TOP,
      hitWidth,
      hitHeight: SKILL_FONT_SIZE + 4,
    };
  });
}

/** PROJECT.md スキル色分け正本に合わせたラベル文字色 */
const RARITY_LABEL_COLORS: Record<SkillDisplayRarity, string> = {
  unique: "#60a5fa",
  inherit: "#34d399",
  evo: "#f87171",
  rare: "#fbbf24",
  white: "#e4e4e7",
};

const DEBUFF_LABEL_COLOR = "#a78bfa";

function getSkillLabelColorById(skillId: string): string {
  const info = getSkillRarityInfoById(skillId);
  return RARITY_LABEL_COLORS[info.rarity];
}

/** フレーム index から発動位置％文字列を生成（本家 startRate/endRate 相当） */
function frameIndexToPositionRate(frames: RaceFrameDump[], index: number, courseLength: number): string {
  if (!frames.length || courseLength <= 0) return "0.0%";
  const clamped = Math.min(Math.max(index, 0), frames.length - 1);
  return ((frames[clamped].startPosition / courseLength) * 100).toFixed(1) + "%";
}

/** startTime/endTime から発動位置％範囲文字列（WASM 未更新時の暫定） */
export function buildActivatePositionText(
  frames: RaceFrameDump[],
  courseLength: number,
  startTime: number,
  endTime: number,
  hasEnd: boolean,
): string {
  if (!frames.length || courseLength <= 0) return "";
  const startIndex = Math.min(Math.round(startTime * FRAME_PER_SECOND), frames.length - 1);
  const startRate = frameIndexToPositionRate(frames, startIndex, courseLength);
  if (!hasEnd) return startRate;
  const endIndex = Math.min(Math.round(endTime * FRAME_PER_SECOND), frames.length - 1);
  const endRate = frameIndexToPositionRate(frames, endIndex, courseLength);
  return `${startRate}〜${endRate}`;
}

/** WASM effectText が無い場合の暫定 Tooltip 本文（発動位置％のみ） */
function buildProvisionalEffectText(
  event: SkillEventDump,
  frames: RaceFrameDump[],
  courseLength: number,
): string {
  if (event.effectText) return event.effectText;
  const hasEnd = event.kind !== "debuff" && event.endTime > event.startTime;
  return buildActivatePositionText(frames, courseLength, event.startTime, event.endTime, hasEnd);
}

function makeTooltipKey(skillId: string, startTime: number): string {
  return `${skillId}@${startTime.toFixed(4)}`;
}

export interface RaceGraphData {
  points: GraphPoint[];
  phaseLines: { label: string; time: number }[];
  staminaMax: number;
  areaBands: AreaBand[];
  skillMarkers: SkillMarker[];
  /** 縦拡大 ON 時のみ使用: max(360, 発動数 × 19) */
  expandedChartHeight: number;
}

/** 距離 m → 経過秒（frameIndex / 15） */
function distanceToTime(frames: RaceFrameDump[], positionM: number): number {
  const index = frames.findIndex((f) => f.startPosition >= positionM);
  if (index < 0) return (frames.length - 1) / FRAME_PER_SECOND;
  return index / FRAME_PER_SECOND;
}

/** 本家 RaceOperation.toGraphData(areas, frameList) 相当 — ReferenceArea 用に変換 */
function buildAreaBands(
  trackDetail: TrackDetailDump | undefined,
  frames: RaceFrameDump[],
): AreaBand[] {
  if (!trackDetail || !frames.length) return [];

  const { straights, corners, slopes } = trackDetail;
  if (!straights.length && !corners.length && !slopes.length) return [];

  const toBands = (
    areas: { start: number; end: number }[],
    y1: number,
    y2: number,
    fill: string,
    stroke?: string,
    strokeDasharray?: string,
    fillOpacity?: number,
  ): AreaBand[] =>
    areas
      .filter((a) => a.end > a.start)
      .map((area) => {
        const x1 = distanceToTime(frames, area.start);
        const x2 = distanceToTime(frames, area.end);
        if (x1 >= x2) return null;
        const band: AreaBand = { x1, x2, y1, y2, fill };
        if (stroke) band.stroke = stroke;
        if (strokeDasharray) band.strokeDasharray = strokeDasharray;
        if (fillOpacity !== undefined) band.fillOpacity = fillOpacity;
        return band;
      })
      .filter((band): band is AreaBand => band !== null);

  return [
    ...toBands(straights, 0, 0.1, AREA_STRAIGHT_FILL, AREA_STRAIGHT_FILL),
    ...toBands(corners, 0, 0.1, AREA_CORNER_FILL, AREA_CORNER_FILL, "3 2"),
    ...toBands(
      slopes.filter((s) => s.slope > 0),
      0.15,
      0.2,
      AREA_UPSLOPE_FILL,
      undefined,
      undefined,
      AREA_SLOPE_FILL_OPACITY,
    ),
    ...toBands(
      slopes.filter((s) => s.slope < 0),
      0.1,
      0.15,
      AREA_DOWNSLOPE_FILL,
      undefined,
      undefined,
      AREA_SLOPE_FILL_OPACITY,
    ),
  ];
}

/** skillEvents から本家準拠のスキルマーカー（発動ごと 1 行）を生成 */
export function buildSkillMarkers(
  skillEvents: SkillEventDump[] | undefined,
  displayState: GraphDisplayState,
  detail?: Pick<RaceDetailDump, "frames" | "courseLength">,
): Pick<RaceGraphData, "skillMarkers" | "expandedChartHeight"> {
  if (!skillEvents?.length) {
    return { skillMarkers: [], expandedChartHeight: SKILL_CHART_BASE_HEIGHT };
  }

  const filtered = skillEvents
    .filter((event) => (event.kind === "debuff" ? displayState.showDebuffs : displayState.showSkills))
    .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);

  if (!filtered.length) {
    return { skillMarkers: [], expandedChartHeight: SKILL_CHART_BASE_HEIGHT };
  }

  const eventCount = filtered.length;
  const expandedChartHeight = computeExpandedChartHeight(eventCount);
  const frames = detail?.frames ?? [];
  const courseLength = detail?.courseLength ?? 0;

  const baseMarkers: SkillMarker[] = filtered.map((event, index) => ({
    skillId: event.skillId,
    label: getSkillNameById(event.skillId),
    startTime: event.startTime,
    endTime: event.endTime,
    y: 1,
    lineY: 1,
    labelColor: event.kind === "debuff" ? DEBUFF_LABEL_COLOR : getSkillLabelColorById(event.skillId),
    kind: event.kind,
    row: index,
    tooltipKey: makeTooltipKey(event.skillId, event.startTime),
    effectText: buildProvisionalEffectText(event, frames, courseLength),
  }));

  const skillMarkers = layoutSkillMarkers(baseMarkers, expandedChartHeight, { expanded: true });
  return { skillMarkers, expandedChartHeight };
}

/** detail 固定部分（frames 依存）のみを計算する — displayState に依存しない */
export interface RaceGraphPoints {
  points: GraphPoint[];
  phaseLines: { label: string; time: number }[];
  staminaMax: number;
  areaBands: AreaBand[];
}

/**
 * RaceDetailDump から detail 固定の描画データを生成する。
 * displayState（checkbox）が変わっても再計算されないよう分離。
 * skillMarkers は buildSkillMarkers() で別途計算する。
 */
export function buildRaceGraphPoints(detail: RaceDetailDump): RaceGraphPoints {
  const { frames, phase1Start, phase2Start, gateCount, initialLaneAdjuster, trackDetail } = detail;
  if (!frames.length) {
    return { points: [], phaseLines: [], staminaMax: 0, areaBands: [] };
  }

  const staminaMax = frames[0].sp;
  const laneMax = Math.max(gateCount + 1, 11) * HORSE_LANE + initialLaneAdjuster;
  const laneMin = HORSE_LANE / 2;

  const points: GraphPoint[] = frames.map((frame, index) => {
    const spNorm = staminaMax > 0 ? clamp01(frame.sp / staminaMax) : 0;
    const laneRaw = frame.currentLane + HORSE_LANE / 2;
    const laneNorm = clamp01((laneRaw - laneMin) / (laneMax - laneMin));

    return {
      time: index / FRAME_PER_SECOND,
      speed: frame.speed,
      stamina: STAMINA_PLOT_FLOOR + (1 - STAMINA_PLOT_FLOOR) * spNorm,
      lane: LANE_PLOT_FLOOR + (1 - LANE_PLOT_FLOOR) * laneNorm,
      staminaPct: staminaMax > 0 ? (frame.sp / staminaMax) * 100 : 0,
      lanePct: laneNorm * 100,
    };
  });

  const phase0Index = frames.findIndex((f) => f.startPosition >= 0);
  const phase1Index = frames.findIndex((f) => f.startPosition >= phase1Start);
  const phase2Index = frames.findIndex((f) => f.startPosition >= phase2Start);

  const toTime = (index: number) => (index >= 0 ? index / FRAME_PER_SECOND : 0);

  const phaseLines = [
    { label: "スタート", time: toTime(phase0Index) },
    { label: "中盤へ", time: toTime(phase1Index) },
    { label: "終盤へ", time: toTime(phase2Index) },
  ].filter((p) => p.time > 0);

  const areaBands = buildAreaBands(trackDetail, frames);

  return { points, phaseLines, staminaMax, areaBands };
}

/** baseline の1フレームを current と同じ正規化でプロット値に変換 */
function frameToBaselineFields(
  frame: RaceFrameDump,
  staminaMax: number,
  laneMin: number,
  laneMax: number,
): Pick<
  GraphPoint,
  "baselineSpeed" | "baselineStamina" | "baselineLane" | "baselineStaminaPct" | "baselineLanePct"
> {
  const spNorm = staminaMax > 0 ? clamp01(frame.sp / staminaMax) : 0;
  const laneRaw = frame.currentLane + HORSE_LANE / 2;
  const laneNorm = clamp01((laneRaw - laneMin) / (laneMax - laneMin));

  return {
    baselineSpeed: frame.speed,
    baselineStamina: STAMINA_PLOT_FLOOR + (1 - STAMINA_PLOT_FLOOR) * spNorm,
    baselineLane: LANE_PLOT_FLOOR + (1 - LANE_PLOT_FLOOR) * laneNorm,
    baselineStaminaPct: staminaMax > 0 ? (frame.sp / staminaMax) * 100 : 0,
    baselineLanePct: laneNorm * 100,
  };
}

/**
 * current の points に baseline detail を index 基準でマージする。
 * current frames 長を正とし、区間帯・phaseLines は current 正本のまま。
 */
export function mergeBaselineGraphPoints(
  current: RaceGraphPoints,
  baselineDetail: RaceDetailDump | null | undefined,
): RaceGraphPoints {
  if (!baselineDetail?.frames.length || !current.points.length) {
    return current;
  }

  const baselineFrames = baselineDetail.frames;
  const baselineStaminaMax = baselineFrames[0].sp;
  const laneMax =
    Math.max(baselineDetail.gateCount + 1, 11) * HORSE_LANE + baselineDetail.initialLaneAdjuster;
  const laneMin = HORSE_LANE / 2;

  const points = current.points.map((point, index) => {
    const baselineFrame = baselineFrames[index];
    if (!baselineFrame) return point;
    return {
      ...point,
      ...frameToBaselineFields(baselineFrame, baselineStaminaMax, laneMin, laneMax),
    };
  });

  return { ...current, points };
}

/**
 * RaceDetailDump からグラフ描画用データを生成する薄いラッパー。
 * buildRaceGraphPoints + buildSkillMarkers を合成する。
 * 既存の呼び出し元との互換性維持用。
 */
export function buildRaceGraphData(
  detail: RaceDetailDump,
  displayState: GraphDisplayState = DEFAULT_GRAPH_DISPLAY_STATE,
): RaceGraphData {
  if (!detail.frames.length) {
    return {
      points: [],
      phaseLines: [],
      staminaMax: 0,
      areaBands: [],
      skillMarkers: [],
      expandedChartHeight: SKILL_CHART_BASE_HEIGHT,
    };
  }

  const { points, phaseLines, staminaMax, areaBands } = buildRaceGraphPoints(detail);
  const { skillMarkers, expandedChartHeight } = buildSkillMarkers(detail.skillEvents, displayState, detail);

  return { points, phaseLines, staminaMax, areaBands, skillMarkers, expandedChartHeight };
}
