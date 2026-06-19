import { describe, expect, it } from "vitest";
import type { CartesianRect } from "./raceGraphBuilder";
import {
  buildInteractionPlotMetrics,
  createInitialChartViewState,
  svgToTime,
  timeToSvgX,
  visibleWindowFromViewState,
} from "./raceGraphBuilder";

const SAMPLE_CARTESIAN: CartesianRect = {
  left: 52,
  top: 24,
  width: 640,
  height: 308,
};

describe("buildInteractionPlotMetrics", () => {
  const raceEnd = 120;

  it("svgToTime が live window の端点と中心で一致する（俯瞰）", () => {
    const liveView = createInitialChartViewState(raceEnd);
    const metrics = buildInteractionPlotMetrics(SAMPLE_CARTESIAN, liveView, raceEnd);
    const window = visibleWindowFromViewState(liveView, raceEnd);

    expect(metrics.scales).toBeUndefined();

    const leftX = SAMPLE_CARTESIAN.left;
    const rightX = SAMPLE_CARTESIAN.left + SAMPLE_CARTESIAN.width;
    const centerX = SAMPLE_CARTESIAN.left + SAMPLE_CARTESIAN.width / 2;

    expect(svgToTime(leftX, metrics)).toBeCloseTo(window.timeMin, 9);
    expect(svgToTime(rightX, metrics)).toBeCloseTo(window.timeMax, 9);
    expect(svgToTime(centerX, metrics)).toBeCloseTo(
      (window.timeMin + window.timeMax) / 2,
      9,
    );
  });

  it("svgToTime がズーム済み live window と timeToSvgX で往復一致する", () => {
    const liveView = {
      ...createInitialChartViewState(raceEnd),
      scale: 6,
      centerTime: raceEnd * 0.4,
      centerSpeed: 22,
      centerPercent: 0.65,
    };
    const metrics = buildInteractionPlotMetrics(SAMPLE_CARTESIAN, liveView, raceEnd);
    const window = visibleWindowFromViewState(liveView, raceEnd);

    const sampleTimes = [
      window.timeMin,
      window.timeMax,
      window.timeMin + (window.timeMax - window.timeMin) * 0.25,
      window.timeMin + (window.timeMax - window.timeMin) * 0.75,
    ];

    for (const time of sampleTimes) {
      const x = timeToSvgX(time, metrics);
      expect(svgToTime(x, metrics)).toBeCloseTo(time, 9);
    }
  });
});
