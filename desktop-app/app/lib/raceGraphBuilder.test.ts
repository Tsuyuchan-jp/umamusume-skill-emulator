import { describe, expect, it } from "vitest";
import type { CartesianRect } from "./raceGraphBuilder";
import {
  buildInteractionPlotMetrics,
  createChartPlotMetrics,
  createInitialChartViewState,
  plotMetricsHandoffCompatible,
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

describe("plotMetricsHandoffCompatible", () => {
  const raceEnd = 120;
  const cartesian = SAMPLE_CARTESIAN;

  it("線形 handoff と同一 window の Recharts scales measured は互換", () => {
    const view = {
      ...createInitialChartViewState(raceEnd),
      scale: 4,
      centerTime: 50,
      centerSpeed: 20,
    };
    const window = visibleWindowFromViewState(view, raceEnd);
    const handoff = buildInteractionPlotMetrics(cartesian, view, raceEnd);
    const measured = createChartPlotMetrics(cartesian, window, view, {
      timeToX: (time) => {
        const t = (time - window.timeMin) / (window.timeMax - window.timeMin);
        return cartesian.left + t * cartesian.width;
      },
      speedToY: (speed) => {
        const s = (speed - window.speedMin) / (window.speedMax - window.speedMin);
        return cartesian.top + cartesian.height - s * cartesian.height;
      },
    });
    expect(plotMetricsHandoffCompatible(handoff, measured)).toBe(true);
  });

  it("cartesian 幅が異なる measured は非互換", () => {
    const view = createInitialChartViewState(raceEnd);
    const window = visibleWindowFromViewState(view, raceEnd);
    const handoff = buildInteractionPlotMetrics(cartesian, view, raceEnd);
    const shiftedCartesian = { ...cartesian, width: cartesian.width + 40 };
    const measured = createChartPlotMetrics(shiftedCartesian, window, view, {
      timeToX: (time) => {
        const t = (time - window.timeMin) / (window.timeMax - window.timeMin);
        return shiftedCartesian.left + t * shiftedCartesian.width;
      },
      speedToY: (speed) => {
        const s = (speed - window.speedMin) / (window.speedMax - window.speedMin);
        return shiftedCartesian.top + shiftedCartesian.height - s * shiftedCartesian.height;
      },
    });
    expect(plotMetricsHandoffCompatible(handoff, measured)).toBe(false);
  });
});
