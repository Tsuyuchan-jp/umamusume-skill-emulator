import { describe, expect, it } from "vitest";
import {
  STITCH_SHIFT_CONTENT_WIDTH_RATIO,
  STITCH_SHIFT_S_MIN,
  STITCH_SHIFT_TERMINAL_MICRO_MAX,
  STITCH_SHIFT_TERMINAL_NO_SCROLL_MAX,
} from "./constants";
import {
  overlapAvgDiff,
  estimatePairShiftRgba,
  estimateShiftFramesRgba,
  runTerminalReprobeForPair,
} from "./shiftEstimateCore";
import type { RgbaImage } from "./rgba";

const STRIP_W = 80;
const STRIP_H = 900;
const FOOTER_ROWS = Math.floor(STRIP_H * 0.15);
const SCROLLABLE_H = STRIP_H - FOOTER_ROWS;
const ROW_PERIOD = 27;
const SESSION_SHIFT = 192;
const TRUE_TERMINAL_SHIFT = 8;

function fillPattern(x: number, y: number): [number, number, number] {
  const band = Math.floor(y / ROW_PERIOD);
  const v = ((y % ROW_PERIOD) * 7 + band * 31 + x * 3) % 256;
  return [v, (v + 40) % 256, (v + 80) % 256];
}

function footerColor(y: number): [number, number, number] {
  return [18, 22, 28 + (y % 5)];
}

function makePatternStrip(height: number): RgbaImage {
  const data = new Uint8Array(STRIP_W * height * 4);
  for (let y = 0; y < height; y++) {
    const inFooter = y >= SCROLLABLE_H;
    for (let x = 0; x < STRIP_W; x++) {
      const [r, g, b] = inFooter ? footerColor(y) : fillPattern(x, y);
      const i = (y * STRIP_W + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width: STRIP_W, height };
}

function shiftScrollRegion(prev: RgbaImage, scrollAmount: number): RgbaImage {
  const { width: w, height: h } = prev;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (y >= SCROLLABLE_H) {
        const si = (y * w + x) * 4;
        data[i] = prev.data[si]!;
        data[i + 1] = prev.data[si + 1]!;
        data[i + 2] = prev.data[si + 2]!;
        data[i + 3] = 255;
        continue;
      }
      const srcY = y + scrollAmount;
      if (srcY >= SCROLLABLE_H) {
        const [r, g, b] = footerColor(y);
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      } else {
        const si = (srcY * w + x) * 4;
        data[i] = prev.data[si]!;
        data[i + 1] = prev.data[si + 1]!;
        data[i + 2] = prev.data[si + 2]!;
        data[i + 3] = 255;
      }
    }
  }
  return { data, width: w, height: h };
}

function buildSessionStrips(terminalShift: number, sessionPairs: number): RgbaImage[] {
  const strips: RgbaImage[] = [makePatternStrip(STRIP_H)];
  for (let i = 0; i < sessionPairs; i++) {
    const shift = i === sessionPairs - 1 ? terminalShift : SESSION_SHIFT;
    strips.push(shiftScrollRegion(strips[strips.length - 1]!, shift));
  }
  return strips;
}

function buildCustomSessionStrips(shifts: number[]): RgbaImage[] {
  const strips: RgbaImage[] = [makePatternStrip(STRIP_H)];
  for (const shift of shifts) {
    strips.push(shiftScrollRegion(strips[strips.length - 1]!, shift));
  }
  return strips;
}

describe("shiftEstimateCore terminal micro", () => {
  it("定数: MICRO_MAX=S_MIN、NO_SCROLL 域は S_MIN 未満", () => {
    expect(STITCH_SHIFT_TERMINAL_MICRO_MAX).toBe(STITCH_SHIFT_S_MIN);
    expect(STITCH_SHIFT_TERMINAL_NO_SCROLL_MAX).toBeLessThan(
      STITCH_SHIFT_TERMINAL_MICRO_MAX
    );
  });

  it("coarse は S_MIN 未満を探索せず真値より periodic 誤ピークを採用しうる", () => {
    const prev = makePatternStrip(STRIP_H);
    const curr = shiftScrollRegion(prev, TRUE_TERMINAL_SHIFT);
    const coarse = estimatePairShiftRgba(prev, curr);
    const contentWidth = Math.floor(STRIP_W * STITCH_SHIFT_CONTENT_WIDTH_RATIO);
    const trueDiff = overlapAvgDiff(prev, curr, TRUE_TERMINAL_SHIFT, contentWidth);
    const coarseDiff = overlapAvgDiff(prev, curr, coarse.scrollAmount, contentWidth);

    expect(coarse.scrollAmount).toBeGreaterThanOrEqual(STITCH_SHIFT_S_MIN);
    expect(coarse.scrollAmount).not.toBe(TRUE_TERMINAL_SHIFT);
    expect(trueDiff).toBeLessThan(1);
    expect(coarseDiff).toBeGreaterThan(trueDiff);
  });

  it("最終ペア: 微探索≈0 → skip（coarse 誤ピークを抑止）", () => {
    const strips = buildSessionStrips(TRUE_TERMINAL_SHIFT, 4);
    for (let i = 0; i < 3; i++) {
      const pair = estimatePairShiftRgba(strips[i]!, strips[i + 1]!);
      expect(Math.abs(pair.scrollAmount - SESSION_SHIFT)).toBeLessThanOrEqual(2);
    }

    const result = estimateShiftFramesRgba(strips);
    expect(result.representative).toBe(SESSION_SHIFT);

    const last = result.frames[3]!;
    expect(last.method).toBe("skip");
    expect(last.scrollAmount).toBe(0);
    expect(last.rawScrollAmount).toBeGreaterThanOrEqual(STITCH_SHIFT_S_MIN);
    expect(result.overlaps[3]).toBe(0);
  });

  it("正当な terminal 短シフト（119px）は micro 非採用で維持", () => {
    const TRN_TERMINAL = 119;
    const strips = buildSessionStrips(TRN_TERMINAL, 3);

    const result = estimateShiftFramesRgba(strips);
    const last = result.frames[2]!;
    expect(last.method).toBe("terminal");
    expect(last.scrollAmount).toBe(TRN_TERMINAL);
  });
});

describe("shiftEstimateCore terminal coarse re-probe（案 A2a）", () => {
  const NARROW_SESSION_SHIFT = 143;
  /** 狭帯末端: わずかに残スクロール（非ゼロ） */
  const NARROW_TERMINAL_SHIFT = 55;

  it("最終ペア coarse≈S* でも短帯再探索で正当な小シフトを採用", () => {
    const shifts = [...Array(11).fill(NARROW_SESSION_SHIFT), NARROW_TERMINAL_SHIFT];
    const strips = buildCustomSessionStrips(shifts);
    const prev = strips[strips.length - 2]!;
    const curr = strips[strips.length - 1]!;
    const wrongCoarse = NARROW_SESSION_SHIFT + 2;
    const contentWidth = Math.floor(prev.width * STITCH_SHIFT_CONTENT_WIDTH_RATIO);
    const coarseAvgDiff = overlapAvgDiff(prev, curr, wrongCoarse, contentWidth);

    const reprobe = runTerminalReprobeForPair(
      prev,
      curr,
      coarseAvgDiff,
      NARROW_SESSION_SHIFT,
      false,
      false
    );

    expect(reprobe.kind).toBe("terminal");
    if (reprobe.kind !== "terminal") return;
    expect(reprobe.scrollAmount).toBe(NARROW_TERMINAL_SHIFT);
    expect(reprobe.scrollAmount).toBeLessThan(
      Math.floor(NARROW_SESSION_SHIFT * 0.85)
    );
  });

  it("正当な最終フルノッチ（≈S*）は短帯で改善がなければ coarse 維持", () => {
    const shifts = [...Array(5).fill(NARROW_SESSION_SHIFT), NARROW_SESSION_SHIFT];
    const strips = buildCustomSessionStrips(shifts);

    const result = estimateShiftFramesRgba(strips);
    const last = result.frames[result.frames.length - 1]!;

    expect(last.scrollAmount).toBe(NARROW_SESSION_SHIFT);
    expect(["ssd", "ssd-refined"]).toContain(last.method);
    expect(result.overlaps[result.overlaps.length - 1]).toBe(NARROW_SESSION_SHIFT);
  });
});

describe("shiftEstimateCore terminal exact-bottom refine skip（案 A′）", () => {
  it("最終ペアの短 raw は refine せず terminal 経路へ（修正前は raw=60→ssd-refined 232）", () => {
    const TERMINAL_SHIFT = 60;
    const shifts = [...Array(6).fill(SESSION_SHIFT), TERMINAL_SHIFT];
    const strips = buildCustomSessionStrips(shifts);

    for (let i = 0; i < 3; i++) {
      const pair = estimatePairShiftRgba(strips[i]!, strips[i + 1]!);
      expect(Math.abs(pair.scrollAmount - SESSION_SHIFT)).toBeLessThanOrEqual(2);
    }

    const lastRaw = estimatePairShiftRgba(
      strips[strips.length - 2]!,
      strips[strips.length - 1]!
    );
    expect(lastRaw.scrollAmount).toBe(TERMINAL_SHIFT);

    const result = estimateShiftFramesRgba(strips);
    expect(result.representative).toBe(SESSION_SHIFT);

    const penult = result.frames[result.frames.length - 2]!;
    expect(penult.method).toBe("ssd-refined");
    expect(penult.scrollAmount).toBe(SESSION_SHIFT);
    expect(penult.rawScrollAmount).toBeGreaterThan(SESSION_SHIFT);

    const last = result.frames[result.frames.length - 1]!;
    expect(last.method).toBe("terminal");
    expect(last.scrollAmount).toBe(TERMINAL_SHIFT);
    expect(last.method).not.toBe("ssd-refined");
    expect(result.overlaps[result.overlaps.length - 1]).toBe(TERMINAL_SHIFT);
  });
});
