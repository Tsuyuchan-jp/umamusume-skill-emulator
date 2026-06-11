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
}

/** 縦拡大時のチャート高さ */
export const SKILL_CHART_BASE_HEIGHT = 360;
/** 1 スキル行の高さ（px）— B案: 28 */
export const SKILL_ROW_HEIGHT = 28;
export const SKILL_FONT_SIZE = 10;
export const SKILL_LINE_GAP = 3;
export const SKILL_ROW_TOP_PAD = 4;
/** 縦拡大 OFF 時の最小行高（px） */
export const SKILL_ROW_HEIGHT_MIN = 16;
/** LineChart margin と同期（layoutSkillMarkers 用） */
export const SKILL_CHART_MARGIN_TOP = 24;
export const SKILL_CHART_MARGIN_BOTTOM = 4;

export interface SkillLayoutOptions {
  /** true: 28px 固定行。false: plotHeight に収まるよう行高を圧縮 */
  expanded?: boolean;
}

/** chartHeightPx に基づき下ライン行レイアウトを percent 軸 y に変換 */
export function layoutSkillMarkers(
  markers: SkillMarker[],
  chartHeightPx: number,
  options: SkillLayoutOptions = {},
): SkillMarker[] {
  const { expanded = true } = options;
  const plotHeight = chartHeightPx - SKILL_CHART_MARGIN_TOP - SKILL_CHART_MARGIN_BOTTOM;
  if (plotHeight <= 0 || markers.length === 0) return markers;

  const eventCount = markers.length;
  const contentTail = SKILL_FONT_SIZE + SKILL_LINE_GAP;
  const availableForRows = plotHeight - SKILL_ROW_TOP_PAD - contentTail;

  let rowHeight = SKILL_ROW_HEIGHT;
  if (!expanded) {
    rowHeight = Math.min(
      SKILL_ROW_HEIGHT,
      Math.max(SKILL_ROW_HEIGHT_MIN, Math.floor(availableForRows / eventCount)),
    );
  }

  return markers.map((marker) => {
    const labelTopPx = SKILL_ROW_TOP_PAD + marker.row * rowHeight;
    const lineTopPx = labelTopPx + SKILL_FONT_SIZE + SKILL_LINE_GAP;
    return {
      ...marker,
      y: 1 - labelTopPx / plotHeight,
      lineY: 1 - lineTopPx / plotHeight,
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

export interface RaceGraphData {
  points: GraphPoint[];
  phaseLines: { label: string; time: number }[];
  staminaMax: number;
  areaBands: AreaBand[];
  skillMarkers: SkillMarker[];
  /** 縦拡大 ON 時のみ使用: max(360, 発動数 × 28) */
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
  const expandedChartHeight = Math.max(SKILL_CHART_BASE_HEIGHT, eventCount * SKILL_ROW_HEIGHT);

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
  }));

  const skillMarkers = layoutSkillMarkers(baseMarkers, expandedChartHeight, { expanded: true });
  return { skillMarkers, expandedChartHeight };
}

/** RaceDetailDump からグラフ描画用データを生成 */
export function buildRaceGraphData(
  detail: RaceDetailDump,
  displayState: GraphDisplayState = DEFAULT_GRAPH_DISPLAY_STATE,
): RaceGraphData {
  const { frames, phase1Start, phase2Start, gateCount, initialLaneAdjuster, trackDetail, skillEvents } = detail;
  if (!frames.length) {
    return {
      points: [],
      phaseLines: [],
      staminaMax: 0,
      areaBands: [],
      skillMarkers: [],
      expandedChartHeight: SKILL_CHART_BASE_HEIGHT,
    };
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
  const { skillMarkers, expandedChartHeight } = buildSkillMarkers(skillEvents, displayState);

  return { points, phaseLines, staminaMax, areaBands, skillMarkers, expandedChartHeight };
}
