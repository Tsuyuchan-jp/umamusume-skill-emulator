import { RaceDetailDump } from "./types";

/** umasim RaceOperation.toGraphData 相当の定数 */
const FRAME_PER_SECOND = 15;
export const SPEED_MIN = 13;
export const SPEED_MAX = 30;
const STAMINA_MIN = -200;
const HORSE_LANE = 11.25 / 18;
const STAMINA_PLOT_FLOOR = 0.1;
const LANE_PLOT_FLOOR = 0.05;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface GraphPoint {
  time: number;
  /** 生値 m/s */
  speed: number;
  /** プロット座標 [0.1, 1] */
  stamina: number;
  /** プロット座標 [0.05, 1] */
  lane: number;
  /** Tooltip 用: 初期体力比 % */
  staminaPct: number;
  /** Tooltip 用: レーン位置 %（0%=内枠 100%=外枠） */
  lanePct: number;
}

export interface RaceGraphData {
  points: GraphPoint[];
  phaseLines: { label: string; time: number }[];
  staminaMax: number;
}

/** RaceDetailDump からグラフ描画用データを生成 */
export function buildRaceGraphData(detail: RaceDetailDump): RaceGraphData {
  const { frames, phase1Start, phase2Start, gateCount, initialLaneAdjuster } = detail;
  if (!frames.length) {
    return { points: [], phaseLines: [], staminaMax: 0 };
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

  return { points, phaseLines, staminaMax };
}
