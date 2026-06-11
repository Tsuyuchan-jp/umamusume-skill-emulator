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

/** スキル発動帯（ReferenceArea 用） */
export interface SkillBand {
  skillId: string;
  label: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  fill: string;
  kind: SkillEventKind;
  row: number;
}

/** PROJECT.md スキル色分け正本に合わせたグラフ用 fill */
const RARITY_FILL_COLORS: Record<SkillDisplayRarity, string> = {
  unique: "#60a5fa",
  inherit: "#34d399",
  evo: "#f87171",
  rare: "#fbbf24",
  white: "#e4e4e7",
};

/** デバフ（minus 系）帯の色 */
const DEBUFF_FILL_COLOR = "#a78bfa";

function getSkillFillById(skillId: string): string {
  const info = getSkillRarityInfoById(skillId);
  return RARITY_FILL_COLORS[info.rarity];
}

export interface RaceGraphData {
  points: GraphPoint[];
  phaseLines: { label: string; time: number }[];
  staminaMax: number;
  areaBands: AreaBand[];
  skillBands: SkillBand[];
  skillRowCount: number;
  yDomainMax: number;
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

/** skillEvents からスキル発動帯を生成 */
export function buildSkillBands(
  skillEvents: SkillEventDump[] | undefined,
  displayState: GraphDisplayState,
): Pick<RaceGraphData, "skillBands" | "skillRowCount" | "yDomainMax"> {
  if (!skillEvents?.length) {
    return { skillBands: [], skillRowCount: 0, yDomainMax: 1 };
  }

  const filtered = skillEvents.filter((event) =>
    event.kind === "debuff" ? displayState.showDebuffs : displayState.showSkills,
  );
  if (!filtered.length) {
    return { skillBands: [], skillRowCount: 0, yDomainMax: 1 };
  }

  const uniqueSkillIds = [...new Set(filtered.map((event) => event.skillId))];
  const rowBySkillId = new Map(uniqueSkillIds.map((skillId, index) => [skillId, index]));
  const skillRowCount = displayState.expandSkillRows ? uniqueSkillIds.length : 0;
  const yDomainMax = displayState.expandSkillRows ? 1 + skillRowCount * 0.04 : 1;

  const skillBands: SkillBand[] = filtered.map((event) => {
    const row = displayState.expandSkillRows ? (rowBySkillId.get(event.skillId) ?? 0) : 0;
    const [y1, y2] = displayState.expandSkillRows
      ? [1.02 + row * 0.04, 1.02 + row * 0.04 + 0.035]
      : [0.94, 0.99];

    return {
      skillId: event.skillId,
      label: getSkillNameById(event.skillId),
      x1: event.startTime,
      x2: event.endTime,
      y1,
      y2,
      fill: event.kind === "debuff" ? DEBUFF_FILL_COLOR : getSkillFillById(event.skillId),
      kind: event.kind,
      row,
    };
  });

  return { skillBands, skillRowCount, yDomainMax };
}

/** RaceDetailDump からグラフ描画用データを生成 */
export function buildRaceGraphData(
  detail: RaceDetailDump,
  displayState: GraphDisplayState = DEFAULT_GRAPH_DISPLAY_STATE,
): RaceGraphData {
  const { frames, phase1Start, phase2Start, gateCount, initialLaneAdjuster, trackDetail, skillEvents } = detail;
  if (!frames.length) {
    return { points: [], phaseLines: [], staminaMax: 0, areaBands: [], skillBands: [], skillRowCount: 0, yDomainMax: 1 };
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
  const { skillBands, skillRowCount, yDomainMax } = buildSkillBands(skillEvents, displayState);

  return { points, phaseLines, staminaMax, areaBands, skillBands, skillRowCount, yDomainMax };
}
