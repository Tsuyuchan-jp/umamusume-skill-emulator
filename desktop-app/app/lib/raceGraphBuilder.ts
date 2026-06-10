import { RaceDetailDump } from "./types";

/** umasim RaceOperation.toGraphData 相当の定数 */
const FRAME_PER_SECOND = 15;
const SPEED_MIN = 13;
const SPEED_MAX = 30;
const STAMINA_MIN = -200;
const HORSE_LANE = 11.25 / 18;

export interface GraphPoint {
  time: number;
  speed: number;
  stamina: number;
  lane: number;
}

export interface RaceGraphData {
  points: GraphPoint[];
  phaseLines: { label: string; time: number }[];
  staminaMax: number;
}

function adjustRange(value: number, min: number, max: number): number {
  return (value - min) / (max - min);
}

/** RaceDetailDump からグラフ描画用データを生成 */
export function buildRaceGraphData(detail: RaceDetailDump): RaceGraphData {
  const { frames, phase1Start, phase2Start, gateCount, initialLaneAdjuster } = detail;
  if (!frames.length) {
    return { points: [], phaseLines: [], staminaMax: 0 };
  }

  const staminaMax = frames[0].sp;
  const laneMax = Math.max(gateCount + 1, 11) * HORSE_LANE + initialLaneAdjuster;

  const points: GraphPoint[] = frames.map((frame, index) => ({
    time: index / FRAME_PER_SECOND,
    speed: adjustRange(frame.speed, SPEED_MIN, SPEED_MAX),
    stamina: adjustRange(frame.sp, STAMINA_MIN, staminaMax),
    lane: adjustRange(frame.currentLane + HORSE_LANE / 2, 0, laneMax),
  }));

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
