import { describe, expect, it } from "vitest";
import {
  percentValueToCanvasY,
  speedToCanvasY,
  timeToCanvasX,
} from "./chartLineRenderer";
import type { CartesianRect, GraphPoint, VisibleWindow } from "./raceGraphBuilder";
import {
  createChartPlotMetrics,
  createInitialChartViewState,
  getSpeedAtTime,
  speedToSvgY,
  timeToSvgX,
  visibleWindowFromViewState,
} from "./raceGraphBuilder";

const COORD_TOLERANCE_PX = 1;

const SAMPLE_CARTESIAN: CartesianRect = {
  left: 52,
  top: 24,
  width: 640,
  height: 308,
};

function makeSamplePoints(count: number): GraphPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const t = index / 15;
    const wave = Math.sin(t * 0.7);
    return {
      time: t,
      speed: 20 + wave * 3,
      stamina: 0.05 + (0.95 * (1 + wave)) / 2,
      lane: 0.05 + (0.95 * (1 - wave)) / 2,
      staminaPct: 50 + wave * 20,
      lanePct: 50 - wave * 15,
      baselineSpeed: 19 + wave * 2.5,
      baselineStamina: 0.05 + (0.95 * (0.9 + wave)) / 2,
      baselineLane: 0.05 + (0.95 * (0.8 - wave)) / 2,
      baselineStaminaPct: 48 + wave * 18,
      baselineLanePct: 52 - wave * 12,
    };
  });
}

function sampleWindows(raceEnd: number): VisibleWindow[] {
  const base = createInitialChartViewState(raceEnd);
  return [
    visibleWindowFromViewState(base, raceEnd),
    visibleWindowFromViewState({ ...base, scale: 4, centerTime: raceEnd * 0.6 }, raceEnd),
    visibleWindowFromViewState(
      { ...base, scale: 8, centerTime: raceEnd * 0.3, centerSpeed: 24, centerPercent: 0.7 },
      raceEnd,
    ),
  ];
}

describe("chartLineRenderer coordinates", () => {
  const points = makeSamplePoints(180);
  const raceEnd = points[points.length - 1].time;

  for (const window of sampleWindows(raceEnd)) {
    const label = `scale window t=[${window.timeMin.toFixed(1)},${window.timeMax.toFixed(1)}]`;

    it(`time/speed/percent transforms match Recharts linear scales (${label})`, () => {
      const metrics = createChartPlotMetrics(
        SAMPLE_CARTESIAN,
        window,
        createInitialChartViewState(raceEnd),
      );

      const sampleTimes = [window.timeMin, window.timeMax, (window.timeMin + window.timeMax) / 2];
      for (const time of sampleTimes) {
        const canvasX = timeToCanvasX(time, window, SAMPLE_CARTESIAN);
        const rechartsX = timeToSvgX(time, metrics);
        expect(Math.abs(canvasX - rechartsX)).toBeLessThanOrEqual(COORD_TOLERANCE_PX);
      }

      const sampleSpeeds = [window.speedMin, window.speedMax, (window.speedMin + window.speedMax) / 2];
      for (const speed of sampleSpeeds) {
        const canvasY = speedToCanvasY(speed, window, SAMPLE_CARTESIAN);
        const rechartsY = speedToSvgY(speed, metrics);
        expect(Math.abs(canvasY - rechartsY)).toBeLessThanOrEqual(COORD_TOLERANCE_PX);
      }

      const samplePercents = [
        window.percentMin,
        window.percentMax,
        (window.percentMin + window.percentMax) / 2,
      ];
      for (const percent of samplePercents) {
        const canvasY = percentValueToCanvasY(percent, window, SAMPLE_CARTESIAN);
        const normalized = (percent - window.percentMin) / (window.percentMax - window.percentMin);
        const rechartsY =
          SAMPLE_CARTESIAN.top + (1 - normalized) * SAMPLE_CARTESIAN.height;
        expect(Math.abs(canvasY - rechartsY)).toBeLessThanOrEqual(COORD_TOLERANCE_PX);
      }
    });
  }

  it("skill activation dot anchors match stack 0 speed line (getSpeedAtTime)", () => {
    const window = visibleWindowFromViewState(
      { ...createInitialChartViewState(raceEnd), scale: 3, centerTime: raceEnd * 0.5 },
      raceEnd,
    );
    const metrics = createChartPlotMetrics(
      SAMPLE_CARTESIAN,
      window,
      createInitialChartViewState(raceEnd),
    );

    const markerTimes = [2.5, 5.0, 8.3, 10.7];
    for (const startTime of markerTimes) {
      const speed = getSpeedAtTime(points, startTime);
      const dotX = timeToCanvasX(startTime, window, SAMPLE_CARTESIAN);
      const dotY = speedToCanvasY(speed, window, SAMPLE_CARTESIAN);

      const anchorX = timeToSvgX(startTime, metrics);
      const anchorY = speedToSvgY(speed, metrics);

      expect(Math.abs(dotX - anchorX)).toBeLessThanOrEqual(COORD_TOLERANCE_PX);
      expect(Math.abs(dotY - anchorY)).toBeLessThanOrEqual(COORD_TOLERANCE_PX);
    }
  });

  it("data point samples stay within 1px on speed/stamina/lane series", () => {
    const window = visibleWindowFromViewState(createInitialChartViewState(raceEnd), raceEnd);
    const metrics = createChartPlotMetrics(
      SAMPLE_CARTESIAN,
      window,
      createInitialChartViewState(raceEnd),
    );

    for (const point of points) {
      const speedX = timeToCanvasX(point.time, window, SAMPLE_CARTESIAN);
      const speedY = speedToCanvasY(point.speed, window, SAMPLE_CARTESIAN);
      expect(Math.abs(speedX - timeToSvgX(point.time, metrics))).toBeLessThanOrEqual(
        COORD_TOLERANCE_PX,
      );
      expect(Math.abs(speedY - speedToSvgY(point.speed, metrics))).toBeLessThanOrEqual(
        COORD_TOLERANCE_PX,
      );

      const staminaY = percentValueToCanvasY(point.stamina, window, SAMPLE_CARTESIAN);
      const staminaNorm = (point.stamina - window.percentMin) / (window.percentMax - window.percentMin);
      const staminaRechartsY =
        SAMPLE_CARTESIAN.top + (1 - staminaNorm) * SAMPLE_CARTESIAN.height;
      expect(Math.abs(staminaY - staminaRechartsY)).toBeLessThanOrEqual(COORD_TOLERANCE_PX);

      const laneY = percentValueToCanvasY(point.lane, window, SAMPLE_CARTESIAN);
      const laneNorm = (point.lane - window.percentMin) / (window.percentMax - window.percentMin);
      const laneRechartsY = SAMPLE_CARTESIAN.top + (1 - laneNorm) * SAMPLE_CARTESIAN.height;
      expect(Math.abs(laneY - laneRechartsY)).toBeLessThanOrEqual(COORD_TOLERANCE_PX);
    }
  });
});
