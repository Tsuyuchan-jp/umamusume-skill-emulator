import { describe, expect, it } from "vitest";
import {
  MAP_WHEEL_BURST_GAP_MS,
  MAP_WHEEL_SETTLE_MS_LONG,
  MAP_WHEEL_SETTLE_MS_SHORT,
  wheelSettleMsForGap,
} from "./useChartViewInteraction";

describe("wheelSettleMsForGap", () => {
  it("初回 wheel（gap null）は LONG", () => {
    expect(wheelSettleMsForGap(null)).toBe(MAP_WHEEL_SETTLE_MS_LONG);
  });

  it("バースト中（gap <= BURST_GAP）は LONG", () => {
    expect(wheelSettleMsForGap(MAP_WHEEL_BURST_GAP_MS)).toBe(MAP_WHEEL_SETTLE_MS_LONG);
    expect(wheelSettleMsForGap(50)).toBe(MAP_WHEEL_SETTLE_MS_LONG);
  });

  it("単発 notch（gap > BURST_GAP）は SHORT", () => {
    expect(wheelSettleMsForGap(MAP_WHEEL_BURST_GAP_MS + 1)).toBe(MAP_WHEEL_SETTLE_MS_SHORT);
    expect(wheelSettleMsForGap(500)).toBe(MAP_WHEEL_SETTLE_MS_SHORT);
  });

  it("SETTLE_LONG は連続ホイール中 commit を防ぐため 200ms 超", () => {
    expect(MAP_WHEEL_SETTLE_MS_LONG).toBeGreaterThan(200);
  });
});
