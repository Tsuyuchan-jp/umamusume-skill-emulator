import { describe, expect, it } from "vitest";
import { STITCH_WHITESPACE_STD_THRESHOLD } from "../constants";
import {
  hideScrollbarRgba,
  trimBottomWhitespaceRgba,
} from "./postProcessCore";

describe("postProcessCore", () => {
  it("hideScrollbarRgba: 右端列を左隣で塗りつぶす", () => {
    const width = 100;
    const height = 200;
    const scrollStartY = 50;
    const scrollContentBottomY = 150;
    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        data[i] = x < 90 ? 10 : 200;
        data[i + 1] = 20;
        data[i + 2] = 30;
        data[i + 3] = 255;
      }
    }

    hideScrollbarRgba(data, width, height, scrollStartY, scrollContentBottomY);

    const safeX = width - Math.ceil(width * 0.03) - 1;
    const sbIdx = (scrollStartY * width + safeX + 1) * 4;
    const srcIdx = (scrollStartY * width + safeX) * 4;
    expect(data[sbIdx]).toBe(data[srcIdx]);
    expect(data[sbIdx + 1]).toBe(data[srcIdx + 1]);
  });

  it("trimBottomWhitespaceRgba: 下端の均一余白を除去する", () => {
    const width = 40;
    const height = 100;
    const scrollDrawY = 80;
    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const isContent = y < scrollDrawY;
        const v = isContent ? ((x + y) % 200) + 30 : 128;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
    }

    const trimmed = trimBottomWhitespaceRgba(data, width, height, scrollDrawY);
    expect(trimmed.cropped).toBe(true);
    expect(trimmed.height).toBeLessThan(height);
    expect(trimmed.height).toBeGreaterThanOrEqual(scrollDrawY - 20);

    const flatStd = rowStdForTest(data, width, height - 10, 10);
    expect(flatStd).toBeLessThan(STITCH_WHITESPACE_STD_THRESHOLD);
  });
});

function rowStdForTest(
  data: Uint8Array,
  width: number,
  startY: number,
  rowH: number
): number {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = startY; y < startY + rowH; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      sum += gray;
      sumSq += gray * gray;
      n++;
    }
  }
  const mean = sum / n;
  return Math.sqrt(Math.max(sumSq / n - mean * mean, 0));
}
