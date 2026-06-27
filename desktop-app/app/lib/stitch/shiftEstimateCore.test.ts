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
