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
  STITCH_SEARCH_WIDTH_RATIO,
  STITCH_TAB_ROW_HEIGHT_RATIO,
  STITCH_TAB_ROW_Y_SCAN_STEP,
  STITCH_TEMPLATE_HEIGHT_RATIO,
  getLayoutHeaderRatio,
  type StitchLayout,
} from "./constants";
import { isTabGreenHsv, rgbToHsv, type RgbaImage } from "./rgba";
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

function detectScrollStartByAbsdiff(
  frame0: RgbaImage,
  frame1: RgbaImage,
  cropWidth: number,
  cropHeight: number
): number | null {
  const footerHeight = Math.floor(cropHeight * STITCH_FOOTER_HEIGHT_RATIO);
  const workHeight = cropHeight - footerHeight;
  if (workHeight < 20) return null;

  const scrollAmount = estimateScrollAmount(frame0, frame1, cropWidth, workHeight);
  if (scrollAmount <= 0 || scrollAmount >= cropHeight) return null;

  const overlapH = cropHeight - scrollAmount;
  const checkWidth = Math.floor(cropWidth * STITCH_SCROLL_DIFF_CHECK_WIDTH_RATIO);
  const rowDiffs: number[] = [];

  for (let y = 0; y < overlapH; y++) {
    const prevY = scrollAmount + y;
    const currY = y;
    let diffSum = 0;

    for (let x = 0; x < checkWidth; x++) {
      const g0 = rgbaGray(frame0, x, prevY);
      const g1 = rgbaGray(frame1, x, currY);
      diffSum += Math.abs(g0 - g1);
    }

    rowDiffs.push(diffSum / checkWidth);
  }

  // 静止ブロック終端 = 最初の持続的高差分行（crop 上端基準）
  let scrollStartY = -1;
  let highStreak = 0;
  for (let y = 0; y < rowDiffs.length; y++) {
    if (rowDiffs[y] >= STITCH_SCROLL_DIFF_AVG_THRESHOLD) {
      highStreak++;
      if (highStreak >= STITCH_SCROLL_DIFF_CONSECUTIVE_ROWS && scrollStartY < 0) {
        scrollStartY = y - STITCH_SCROLL_DIFF_CONSECUTIVE_ROWS + 1;
      }
    } else {
      highStreak = 0;
    }
  }

  const minStatic = Math.floor(cropHeight * 0.15);
  const maxStatic = Math.floor(cropHeight * 0.62);
  if (scrollStartY >= minStatic && scrollStartY <= maxStatic) {
    return scrollStartY;
  }

  return null;
}

function estimateScrollAmount(
  frame0: RgbaImage,
  frame1: RgbaImage,
  cropWidth: number,
  workHeight: number
): number {
  const searchWidth = Math.floor(cropWidth * STITCH_SEARCH_WIDTH_RATIO);
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

  let bestY = -1;
  let bestScore = -1;

  for (
    let ratio = STITCH_GREEN_TAB_FALLBACK_SCAN_START;
    ratio <= STITCH_GREEN_TAB_FALLBACK_SCAN_END;
    ratio += STITCH_TAB_ROW_Y_SCAN_STEP
  ) {
    const tabY = Math.floor(cropHeight * ratio);
    if (tabY + tabH >= cropHeight) continue;

    const l2 = measureGreenTabProfile(frame0, cropWidth, tabY, tabH, cropHeight);
    const l3Score = Math.max(l2.seg1, l2.seg2, l2.seg3);

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

function measureGreenTabProfile(
  img: RgbaImage,
  cropWidth: number,
  tabY: number,
  tabH: number,
  _cropHeight: number
): { l2Score: number; seg1: number; seg2: number; seg3: number } {
  const seg3W = Math.floor(cropWidth / 3);
  let leftG = 0;
  let rightG = 0;
  let leftT = 0;
  let rightT = 0;
  const segG = [0, 0, 0];
  const segT = [0, 0, 0];

  for (let y = tabY; y < tabY + tabH; y++) {
    for (let x = 0; x < cropWidth; x++) {
      const i = (y * img.width + x) * 4;
      const [h, s, v] = rgbToHsv(img.data[i], img.data[i + 1], img.data[i + 2]);
      const g = isTabGreenHsv(h, s, v);

      if (x < Math.floor(cropWidth * 0.48)) {
        leftT++;
        if (g) leftG++;
      } else if (x >= Math.floor(cropWidth * 0.52)) {
        rightT++;
        if (g) rightG++;
      }

      const si = x < seg3W ? 0 : x < seg3W * 2 ? 1 : 2;
      segT[si]++;
      if (g) segG[si]++;
    }
  }

  const seg1 = segT[0] > 0 ? segG[0] / segT[0] : 0;
  const seg2 = segT[1] > 0 ? segG[1] / segT[1] : 0;
  const seg3 = segT[2] > 0 ? segG[2] / segT[2] : 0;
  const l2Score =
    (rightT > 0 ? rightG / rightT : 0) - (leftT > 0 ? leftG / leftT : 0);

  return { l2Score, seg1, seg2, seg3 };
}

function rgbaGray(img: RgbaImage, x: number, y: number): number {
  const i = (y * img.width + x) * 4;
  const r = img.data[i];
  const g = img.data[i + 1];
  const b = img.data[i + 2];
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}
