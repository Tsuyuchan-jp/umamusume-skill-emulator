import {
  STITCH_FOOTER_HEIGHT_RATIO,
  STITCH_GREEN_TAB_FALLBACK_SCAN_END,
  STITCH_GREEN_TAB_FALLBACK_SCAN_START,
  STITCH_HEADER_TAB_BOTTOM_MARGIN_RATIO,
  STITCH_L2_GREEN_SCORE_MIN,
  STITCH_L3_GREEN_SEG_MIN,
  STITCH_SCROLL_DIFF_AVG_THRESHOLD,
  STITCH_SCROLL_DIFF_CHECK_WIDTH_RATIO,
  STITCH_SCROLL_DIFF_CONSECUTIVE_ROWS,
  STITCH_MATCH_SCORE_THRESHOLD,
  STITCH_SEARCH_WIDTH_RATIO,
  STITCH_TAB_ROW_HEIGHT_RATIO,
  STITCH_TAB_ROW_Y_SCAN_STEP,
  STITCH_TEMPLATE_HEIGHT_RATIO,
  getLayoutHeaderRatio,
  type StitchLayout,
} from "./constants";
import { detectPartnerBandRgba, shouldExcludePartnerRegisterBand } from "./partnerDetectCore";
import type { RgbaImage } from "./rgba";
import { measureGreenTabProfileRgba } from "./tabDetectCore";
import type { ScrollStartResult } from "./types";

/** frame0↔1 の absdiff で scrollStartY を検出（走査起点 = crop 上端） */
export function detectScrollStartYFromRgba(
  frame0: RgbaImage,
  frame1: RgbaImage,
  layout: StitchLayout
): ScrollStartResult {
  const cropWidth = frame0.width;
  const cropHeight = frame0.height;

  const absdiff = detectScrollStartByAbsdiff(frame0, frame1, cropWidth, cropHeight);
  if (absdiff !== null) {
    return {
      scrollStartY: absdiff,
      ratio: absdiff / cropHeight,
      method: "absdiff",
      confidence: "high",
    };
  }

  const greenTab = detectScrollStartByGreenTab(frame0, cropWidth, cropHeight);
  if (greenTab !== null) {
    return {
      scrollStartY: greenTab,
      ratio: greenTab / cropHeight,
      method: "green-tab",
      confidence: "low",
    };
  }

  const ratio = getLayoutHeaderRatio(layout);
  const scrollStartY = Math.floor(cropHeight * ratio);
  return {
    scrollStartY,
    ratio: scrollStartY / cropHeight,
    method: "layout-ratio",
    confidence: "low",
  };
}

/** 実スクロールが小さいとき absdiff 境界走査に使う下限（golden FRD f0→f1≈26px 対策） */
const STITCH_SMALL_SCROLL_AMOUNT_THRESHOLD = 80;
/** 主経路 ratio がこれを超えたら scrollAmount 走査（TRN 誤ピーク対策） */
const STITCH_SCROLL_START_SCAN_RATIO_HIGH = 0.54;
/** 小スクロール走査時に許容する scrollStartRatio 上限（FRD 目視≈0.55） */
const STITCH_SCROLL_START_SCAN_RATIO_MAX = 0.56;

function detectScrollStartByAbsdiff(
  frame0: RgbaImage,
  frame1: RgbaImage,
  cropWidth: number,
  cropHeight: number
): number | null {
  const footerHeight = Math.floor(cropHeight * STITCH_FOOTER_HEIGHT_RATIO);
  const workHeight = cropHeight - footerHeight;
  if (workHeight < 20) return null;

  const minStatic = Math.floor(cropHeight * 0.15);
  const maxStatic = Math.floor(cropHeight * 0.62);

  const primaryScroll = estimateScrollAmount(frame0, frame1, cropWidth, workHeight);
  const primaryY = detectScrollStartByLowStreak(
    frame0,
    frame1,
    cropWidth,
    cropHeight,
    primaryScroll
  );
  const primaryRatio = primaryY !== null ? primaryY / cropHeight : -1;

  const needScan =
    primaryScroll < STITCH_SMALL_SCROLL_AMOUNT_THRESHOLD ||
    primaryY === null ||
    primaryY < minStatic ||
    primaryY > maxStatic ||
    primaryRatio > STITCH_SCROLL_START_SCAN_RATIO_HIGH;

  if (!needScan && primaryY !== null) {
    return primaryY;
  }

  const scanMaxRatio =
    primaryScroll < STITCH_SMALL_SCROLL_AMOUNT_THRESHOLD
      ? STITCH_SCROLL_START_SCAN_RATIO_MAX
      : STITCH_SCROLL_START_SCAN_RATIO_HIGH;

  const scanned = scanScrollStartByLowStreak(
    frame0,
    frame1,
    cropWidth,
    cropHeight,
    workHeight,
    minStatic,
    maxStatic,
    scanMaxRatio,
    primaryScroll < STITCH_SMALL_SCROLL_AMOUNT_THRESHOLD ? "small-scroll" : "high-ratio"
  );
  if (scanned !== null) {
    return scanned;
  }

  if (!needScan && primaryY !== null) {
    return primaryY;
  }

  return null;
}

/** シフト済み absdiff の最初の LOW 連続行 = 静止ヘッダー下端（opencv S-1 整合） */
function detectScrollStartByLowStreak(
  frame0: RgbaImage,
  frame1: RgbaImage,
  cropWidth: number,
  cropHeight: number,
  scrollAmount: number
): number | null {
  if (scrollAmount <= 0 || scrollAmount >= cropHeight) return null;

  const rowDiffs = computeShiftedRowDiffs(frame0, frame1, cropWidth, cropHeight, scrollAmount);

  let scrollStartY = -1;
  let lowStreak = 0;
  for (let y = 0; y < rowDiffs.length; y++) {
    if (rowDiffs[y] < STITCH_SCROLL_DIFF_AVG_THRESHOLD) {
      lowStreak++;
      if (lowStreak >= STITCH_SCROLL_DIFF_CONSECUTIVE_ROWS && scrollStartY < 0) {
        scrollStartY = y - STITCH_SCROLL_DIFF_CONSECUTIVE_ROWS + 1;
      }
    } else {
      lowStreak = 0;
    }
  }

  return scrollStartY >= 0 ? scrollStartY : null;
}

function computeShiftedRowDiffs(
  frame0: RgbaImage,
  frame1: RgbaImage,
  cropWidth: number,
  cropHeight: number,
  scrollAmount: number
): number[] {
  const overlapH = cropHeight - scrollAmount;
  const checkWidth = Math.floor(cropWidth * STITCH_SCROLL_DIFF_CHECK_WIDTH_RATIO);
  const rowDiffs: number[] = [];

  for (let y = 0; y < overlapH; y++) {
    let diffSum = 0;
    for (let x = 0; x < checkWidth; x++) {
      diffSum += Math.abs(
        rgbaGray(frame0, x, scrollAmount + y) - rgbaGray(frame1, x, y)
      );
    }
    rowDiffs.push(diffSum / checkWidth);
  }

  return rowDiffs;
}

/** scrollAmount 走査 — テンプレート avgDiff 最小の LOW 境界を採用 */
/** 高 ratio 走査時の scrollStartRatio 下限 */
const STITCH_SCROLL_START_SCAN_RATIO_MIN = 0.45;
/** 小スクロール走査時の scrollStartRatio 下限（FRD タブ行より上） */
const STITCH_SMALL_SCROLL_SCAN_RATIO_MIN = 0.5;

function scanScrollStartByLowStreak(
  frame0: RgbaImage,
  frame1: RgbaImage,
  cropWidth: number,
  cropHeight: number,
  workHeight: number,
  minStatic: number,
  maxStatic: number,
  maxRatio: number,
  mode: "small-scroll" | "high-ratio"
): number | null {
  const searchWidth = Math.floor(cropWidth * STITCH_SEARCH_WIDTH_RATIO);
  const templateHeight = Math.floor(workHeight * STITCH_TEMPLATE_HEIGHT_RATIO);
  const templateY = workHeight - templateHeight;
  const scanMax = Math.min(templateY, 250);
  const minRatio =
    mode === "small-scroll"
      ? STITCH_SMALL_SCROLL_SCAN_RATIO_MIN
      : STITCH_SCROLL_START_SCAN_RATIO_MIN;

  type Candidate = { y: number; ratio: number; avgDiff: number };
  const candidates: Candidate[] = [];

  for (let scrollAmount = STITCH_SMALL_SCROLL_AMOUNT_THRESHOLD; scrollAmount <= scanMax; scrollAmount++) {
    const lowY = detectScrollStartByLowStreak(
      frame0,
      frame1,
      cropWidth,
      cropHeight,
      scrollAmount
    );
    if (lowY === null || lowY < minStatic || lowY > maxStatic) continue;

    const ratio = lowY / cropHeight;
    if (ratio < minRatio || ratio > maxRatio) continue;

    const avgDiff = computeTemplateAvgDiff(
      frame0,
      frame1,
      searchWidth,
      templateY,
      templateHeight,
      templateY - scrollAmount
    );
    candidates.push({ y: lowY, ratio, avgDiff });
  }

  if (candidates.length === 0) return null;

  if (mode === "small-scroll") {
    const maxR = Math.max(...candidates.map((c) => c.ratio));
    const top = candidates.filter((c) => c.ratio === maxR);
    top.sort((a, b) => a.avgDiff - b.avgDiff);
    return top[0]!.y;
  }

  candidates.sort((a, b) => a.avgDiff - b.avgDiff);
  return candidates[0]!.y;
}

function computeTemplateAvgDiff(
  frame0: RgbaImage,
  frame1: RgbaImage,
  searchWidth: number,
  templateY: number,
  templateHeight: number,
  matchedY: number
): number {
  let totalDiff = 0;
  let pixels = 0;

  for (let dy = 0; dy < templateHeight; dy++) {
    const prevY = templateY + dy;
    const currY = matchedY + dy;
    for (let x = 0; x < searchWidth; x++) {
      totalDiff += Math.abs(rgbaGray(frame0, x, prevY) - rgbaGray(frame1, x, currY));
      pixels++;
    }
  }

  return pixels > 0 ? totalDiff / pixels : Infinity;
}

/** NCC テンプレートマッチ + 低スコア時 absdiff 最小差分（opencvStitcher S-4 整合） */
function estimateScrollAmount(
  frame0: RgbaImage,
  frame1: RgbaImage,
  cropWidth: number,
  workHeight: number
): number {
  const searchWidth = Math.floor(cropWidth * STITCH_SEARCH_WIDTH_RATIO);
  const { scrollAmount: nccAmount, score: nccScore } = estimateScrollAmountByNcc(
    frame0,
    frame1,
    searchWidth,
    workHeight
  );

  if (nccScore >= STITCH_MATCH_SCORE_THRESHOLD && nccAmount > 0) {
    return nccAmount;
  }

  const absAmount = estimateScrollAmountByAbsdiffMin(
    frame0,
    frame1,
    searchWidth,
    workHeight
  );
  if (absAmount > 0) {
    return absAmount;
  }

  return nccAmount > 0 ? nccAmount : 0;
}

function estimateScrollAmountByNcc(
  frame0: RgbaImage,
  frame1: RgbaImage,
  searchWidth: number,
  workHeight: number
): { scrollAmount: number; score: number } {
  const templateHeight = Math.floor(workHeight * STITCH_TEMPLATE_HEIGHT_RATIO);
  const templateY = workHeight - templateHeight;

  let bestShift = 0;
  let bestScore = -Infinity;

  for (let matchedY = 0; matchedY <= templateY; matchedY++) {
    const scrollAmount = templateY - matchedY;
    if (scrollAmount <= 0) continue;

    const ncc = computeTemplateNcc(
      frame0,
      frame1,
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

/** absdiff 縦シフト探索 — 平均差分最小の scrollAmount（S-4 フォールバック正本） */
function estimateScrollAmountByAbsdiffMin(
  frame0: RgbaImage,
  frame1: RgbaImage,
  searchWidth: number,
  workHeight: number
): number {
  const templateHeight = Math.floor(workHeight * STITCH_TEMPLATE_HEIGHT_RATIO);
  const templateY = workHeight - templateHeight;

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
      if (currY >= workHeight) break;
      for (let x = 0; x < searchWidth; x++) {
        totalDiff += Math.abs(rgbaGray(frame0, x, prevY) - rgbaGray(frame1, x, currY));
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

  return bestShift;
}

function computeTemplateNcc(
  frame0: RgbaImage,
  frame1: RgbaImage,
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
      const a = rgbaGray(frame0, x, y0);
      const b = rgbaGray(frame1, x, y1);
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

/** 広帯タブ緑走査（0.28–0.54）— absdiff 失敗時フォールバック */
function detectScrollStartByGreenTab(
  frame0: RgbaImage,
  cropWidth: number,
  cropHeight: number
): number | null {
  const tabH = Math.max(4, Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO));
  const margin = Math.max(1, Math.floor(cropHeight * STITCH_HEADER_TAB_BOTTOM_MARGIN_RATIO));
  const partner = detectPartnerBandRgba(frame0);

  let bestY = -1;
  let bestScore = -1;

  for (
    let ratio = STITCH_GREEN_TAB_FALLBACK_SCAN_START;
    ratio <= STITCH_GREEN_TAB_FALLBACK_SCAN_END;
    ratio += STITCH_TAB_ROW_Y_SCAN_STEP
  ) {
    const tabY = Math.floor(cropHeight * ratio);
    if (tabY + tabH >= cropHeight) continue;

    const l2 = measureGreenTabProfileRgba(frame0, tabY);
    const l3Score = Math.max(l2.seg1, l2.seg2, l2.seg3);
    if (shouldExcludePartnerRegisterBand(ratio, { ...l2, maxSeg: l3Score }, partner, cropHeight)) {
      continue;
    }

    const l2Ok = l2.l2Score >= STITCH_L2_GREEN_SCORE_MIN;
    const l3Ok = l3Score >= STITCH_L3_GREEN_SEG_MIN;

    let score = -1;
    if (l2Ok && l3Ok) {
      score = Math.max(l2.l2Score, l3Score);
    } else if (l2Ok) {
      score = l2.l2Score;
    } else if (l3Ok) {
      score = l3Score;
    }

    if (score > bestScore) {
      bestScore = score;
      bestY = tabY;
    }
  }

  if (bestY < 0) return null;
  return bestY + tabH + margin;
}

/** frame0 のみ・緑タブ走査（capture wheel 用・M5 stitch 正本） */
export function detectScrollStartYFromFrame0Rgba(
  frame0: RgbaImage
): ScrollStartResult | null {
  const cropWidth = frame0.width;
  const cropHeight = frame0.height;
  const y = detectScrollStartByGreenTab(frame0, cropWidth, cropHeight);
  if (y === null) return null;
  return {
    scrollStartY: y,
    ratio: y / cropHeight,
    method: "green-tab",
    confidence: "low",
  };
}

function rgbaGray(img: RgbaImage, x: number, y: number): number {
  const i = (y * img.width + x) * 4;
  const r = img.data[i];
  const g = img.data[i + 1];
  const b = img.data[i + 2];
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}
