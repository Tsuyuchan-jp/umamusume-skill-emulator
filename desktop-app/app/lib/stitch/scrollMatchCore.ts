import {
  STITCH_MATCH_SCORE_THRESHOLD,
  STITCH_SEARCH_WIDTH_RATIO,
  STITCH_TEMPLATE_HEIGHT_RATIO,
} from "./constants";
import type { RgbaImage } from "./rgba";

export type ScrollMatchMethod = "ncc" | "absdiff" | "skip" | "bound";

export interface ScrollFrameMatch {
  index: number;
  scrollAmount: number;
  score: number;
  method: ScrollMatchMethod;
}

export interface ScrollMatchResult {
  overlaps: number[];
  frames: ScrollFrameMatch[];
}

/** スクロール帯 ROI 同士で NCC + absdiff（S-4）フォールバック */
export function matchScrollPairRgba(
  prev: RgbaImage,
  curr: RgbaImage
): { scrollAmount: number; score: number; method: "ncc" | "absdiff" } {
  const scrollHeight = prev.height;
  const searchWidth = Math.floor(prev.width * STITCH_SEARCH_WIDTH_RATIO);

  const ncc = matchScrollByNccRgba(prev, curr, searchWidth, scrollHeight);
  if (ncc.score >= STITCH_MATCH_SCORE_THRESHOLD && ncc.scrollAmount > 0) {
    return { ...ncc, method: "ncc" };
  }

  const abs = matchScrollByAbsdiffRgba(prev, curr, searchWidth, scrollHeight);
  if (abs.scrollAmount > 0) {
    return { ...abs, method: "absdiff" };
  }

  return { scrollAmount: ncc.scrollAmount > 0 ? ncc.scrollAmount : 0, score: ncc.score, method: "ncc" };
}

/** 全スクロール帯フレームの overlap 列を算出 */
export function matchScrollFramesRgba(strips: RgbaImage[]): ScrollMatchResult {
  const overlaps: number[] = [];
  const frames: ScrollFrameMatch[] = [];

  for (let i = 0; i < strips.length - 1; i++) {
    const prev = strips[i]!;
    const curr = strips[i + 1]!;
    let { scrollAmount, score, method } = matchScrollPairRgba(prev, curr);

    if (score < STITCH_MATCH_SCORE_THRESHOLD && scrollAmount <= 0) {
      frames.push({ index: i, scrollAmount: 0, score, method: "bound" });
      return { overlaps, frames };
    }

    if (scrollAmount <= 0) {
      frames.push({ index: i, scrollAmount: 0, score, method: "skip" });
      overlaps.push(0);
      continue;
    }

    frames.push({ index: i, scrollAmount, score, method });
    overlaps.push(scrollAmount);
  }

  return { overlaps, frames };
}

function matchScrollByNccRgba(
  prev: RgbaImage,
  curr: RgbaImage,
  searchWidth: number,
  scrollHeight: number
): { scrollAmount: number; score: number } {
  const templateHeight = Math.floor(scrollHeight * STITCH_TEMPLATE_HEIGHT_RATIO);
  const templateY = scrollHeight - templateHeight;

  let bestShift = 0;
  let bestScore = -Infinity;

  for (let matchedY = 0; matchedY <= templateY; matchedY++) {
    const scrollAmount = templateY - matchedY;
    if (scrollAmount <= 0) continue;

    const ncc = computeTemplateNccRgba(
      prev,
      curr,
      searchWidth,
      templateY,
      templateHeight,
      matchedY
    );

    if (ncc > bestScore) {
      bestScore = ncc;
      bestShift = scrollAmount;
    }
  }

  return {
    scrollAmount: bestShift,
    score: bestScore === -Infinity ? 0 : bestScore,
  };
}

function matchScrollByAbsdiffRgba(
  prev: RgbaImage,
  curr: RgbaImage,
  searchWidth: number,
  scrollHeight: number
): { scrollAmount: number; score: number } {
  const templateHeight = Math.floor(scrollHeight * STITCH_TEMPLATE_HEIGHT_RATIO);
  const templateY = scrollHeight - templateHeight;

  let bestShift = 0;
  let bestDiff = Infinity;

  for (let matchedY = 0; matchedY <= templateY; matchedY++) {
    const scrollAmount = templateY - matchedY;
    if (scrollAmount <= 0) continue;

    let totalDiff = 0;
    let pixels = 0;

    for (let dy = 0; dy < templateHeight; dy++) {
      const prevY = templateY + dy;
      const currY = matchedY + dy;
      if (currY >= scrollHeight) break;
      for (let x = 0; x < searchWidth; x++) {
        totalDiff += Math.abs(rgbaGray(prev, x, prevY) - rgbaGray(curr, x, currY));
        pixels++;
      }
    }

    if (pixels === 0) continue;
    const avgDiff = totalDiff / pixels;
    if (avgDiff < bestDiff) {
      bestDiff = avgDiff;
      bestShift = scrollAmount;
    }
  }

  const score = bestDiff < Infinity ? Math.max(0, 1 - bestDiff / 128) : 0;
  return { scrollAmount: bestShift, score };
}

function computeTemplateNccRgba(
  prev: RgbaImage,
  curr: RgbaImage,
  width: number,
  templateY: number,
  templateHeight: number,
  matchedY: number
): number {
  let sumA = 0;
  let sumB = 0;
  let sumAB = 0;
  let sumA2 = 0;
  let sumB2 = 0;
  let n = 0;

  for (let dy = 0; dy < templateHeight; dy++) {
    const y0 = templateY + dy;
    const y1 = matchedY + dy;
    for (let x = 0; x < width; x++) {
      const a = rgbaGray(prev, x, y0);
      const b = rgbaGray(curr, x, y1);
      sumA += a;
      sumB += b;
      sumAB += a * b;
      sumA2 += a * a;
      sumB2 += b * b;
      n++;
    }
  }

  if (n === 0) return -Infinity;
  const meanA = sumA / n;
  const meanB = sumB / n;
  const varA = sumA2 / n - meanA * meanA;
  const varB = sumB2 / n - meanB * meanB;
  const cov = sumAB / n - meanA * meanB;
  const denom = Math.sqrt(Math.max(varA, 0) * Math.max(varB, 0));
  if (denom < 1e-6) return -Infinity;
  return cov / denom;
}

function rgbaGray(img: RgbaImage, x: number, y: number): number {
  const i = (y * img.width + x) * 4;
  const r = img.data[i]!;
  const g = img.data[i + 1]!;
  const b = img.data[i + 2]!;
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}
