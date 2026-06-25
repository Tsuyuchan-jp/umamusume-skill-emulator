// @ts-nocheck

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
import type { ScrollStartResult } from "./types";

export type { ScrollStartResult } from "./types";
export { detectScrollStartYFromRgba } from "./regionsCore";

/** OpenCV Mat 2枚から scrollStartY を決定（主: absdiff、失敗時フォールバック） */
export function detectScrollStartY(
  frame0: any,
  frame1: any,
  cv: any,
  cropWidth: number,
  cropHeight: number,
  layout: StitchLayout
): ScrollStartResult {
  const absdiffY = detectScrollStartByAbsdiffCv(
    frame0,
    frame1,
    cv,
    cropWidth,
    cropHeight
  );
  if (absdiffY !== null) {
    return {
      scrollStartY: absdiffY,
      ratio: absdiffY / cropHeight,
      method: "absdiff",
      confidence: "high",
    };
  }

  const greenTabY = detectScrollStartByGreenTabCv(
    frame0,
    cv,
    cropWidth,
    cropHeight
  );
  if (greenTabY !== null) {
    return {
      scrollStartY: greenTabY,
      ratio: greenTabY / cropHeight,
      method: "green-tab",
      confidence: "low",
    };
  }

  const ratio = getLayoutHeaderRatio(layout);
  const scrollStartY = Math.floor(cropHeight * ratio);
  console.warn(
    `scrollStartY: absdiff/緑タブとも失敗。レイアウト比率フォールバック layout=${layout} ratio=${ratio}`
  );
  return {
    scrollStartY,
    ratio: scrollStartY / cropHeight,
    method: "layout-ratio",
    confidence: "low",
  };
}

function detectScrollStartByAbsdiffCv(
  frame0: any,
  frame1: any,
  cv: any,
  cropWidth: number,
  cropHeight: number
): number | null {
  const footerHeight = Math.floor(cropHeight * STITCH_FOOTER_HEIGHT_RATIO);
  const workHeight = cropHeight - footerHeight;
  if (workHeight < 20) return null;

  const scrollAmount = estimateScrollAmountCv(
    frame0,
    frame1,
    cv,
    cropWidth,
    workHeight
  );
  if (scrollAmount <= 0 || scrollAmount >= cropHeight) return null;

  const shiftedPrev = frame0.roi(
    new cv.Rect(0, scrollAmount, cropWidth, cropHeight - scrollAmount)
  );
  const currOverlap = frame1.roi(
    new cv.Rect(0, 0, cropWidth, cropHeight - scrollAmount)
  );

  const diff = new cv.Mat();
  cv.absdiff(shiftedPrev, currOverlap, diff);
  cv.cvtColor(diff, diff, cv.COLOR_RGBA2GRAY);

  const checkWidth = Math.floor(cropWidth * STITCH_SCROLL_DIFF_CHECK_WIDTH_RATIO);
  const rowDiffs: number[] = [];

  for (let y = 0; y < diff.rows; y++) {
    let diffSum = 0;
    const rowPtr = diff.ucharPtr(y);
    for (let x = 0; x < checkWidth; x++) {
      diffSum += rowPtr[x];
    }
    rowDiffs.push(diffSum / checkWidth);
  }

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

  diff.delete();
  shiftedPrev.delete();
  currOverlap.delete();

  const minStatic = Math.floor(cropHeight * 0.15);
  const maxStatic = Math.floor(cropHeight * 0.62);
  if (scrollStartY >= minStatic && scrollStartY <= maxStatic) {
    return scrollStartY;
  }

  return null;
}

function estimateScrollAmountCv(
  prev: any,
  curr: any,
  cv: any,
  cropWidth: number,
  workHeight: number
): number {
  const searchWidth = Math.floor(cropWidth * STITCH_SEARCH_WIDTH_RATIO);
  const templateHeight = Math.floor(workHeight * STITCH_TEMPLATE_HEIGHT_RATIO);
  const templateY = workHeight - templateHeight;

  const templateRect = new cv.Rect(0, templateY, searchWidth, templateHeight);
  const template = prev.roi(templateRect);
  const currSearchArea = curr.roi(new cv.Rect(0, 0, searchWidth, workHeight));

  const result = new cv.Mat();
  cv.matchTemplate(currSearchArea, template, result, cv.TM_CCOEFF_NORMED);
  const minMax = cv.minMaxLoc(result);
  const matchedY = minMax.maxLoc.y;
  const scrollAmount = templateY - matchedY;

  result.delete();
  template.delete();
  currSearchArea.delete();

  return scrollAmount > 0 ? scrollAmount : 0;
}

function detectScrollStartByGreenTabCv(
  croppedMat: any,
  cv: any,
  cropWidth: number,
  cropHeight: number
): number | null {
  const tabH = Math.max(4, Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO));
  const margin = Math.max(
    1,
    Math.floor(cropHeight * STITCH_HEADER_TAB_BOTTOM_MARGIN_RATIO)
  );

  let bestY = -1;
  let bestScore = -1;

  for (
    let ratio = STITCH_GREEN_TAB_FALLBACK_SCAN_START;
    ratio <= STITCH_GREEN_TAB_FALLBACK_SCAN_END;
    ratio += STITCH_TAB_ROW_Y_SCAN_STEP
  ) {
    const tabY = Math.floor(cropHeight * ratio);
    if (tabY + tabH >= cropHeight) continue;

    const p = measureGreenTabProfileCv(
      croppedMat,
      cv,
      cropWidth,
      tabY,
      cropHeight
    );
    const l3Score = Math.max(p.seg1, p.seg2, p.seg3);

    const l2Ok = p.l2Score >= STITCH_L2_GREEN_SCORE_MIN;
    const l3Ok = l3Score >= STITCH_L3_GREEN_SEG_MIN;

    let score = -1;
    if (l2Ok && l3Ok) {
      score = Math.max(p.l2Score, l3Score);
    } else if (l2Ok) {
      score = p.l2Score;
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

function measureGreenTabProfileCv(
  croppedMat: any,
  cv: any,
  cropWidth: number,
  tabY: number,
  cropHeight: number
): { l2Score: number; seg1: number; seg2: number; seg3: number } {
  const tabH = Math.max(4, Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO));
  const roi = croppedMat.roi(new cv.Rect(0, tabY, cropWidth, tabH));
  const hsv = new cv.Mat();
  cv.cvtColor(roi, hsv, cv.COLOR_RGBA2RGB);
  cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

  const seg3W = Math.floor(cropWidth / 3);
  let leftG = 0;
  let rightG = 0;
  let leftT = 0;
  let rightT = 0;
  const segG = [0, 0, 0];
  const segT = [0, 0, 0];

  const isTabGreen = (ptr: Uint8Array) => {
    const h = ptr[0];
    const s = ptr[1];
    const v = ptr[2];
    return h >= 35 && h <= 85 && s >= 80 && v >= 80;
  };

  for (let y = 0; y < hsv.rows; y++) {
    for (let x = 0; x < hsv.cols; x++) {
      const ptr = hsv.ucharPtr(y, x);
      const g = isTabGreen(ptr);
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

  hsv.delete();
  roi.delete();

  const seg1 = segT[0] > 0 ? segG[0] / segT[0] : 0;
  const seg2 = segT[1] > 0 ? segG[1] / segT[1] : 0;
  const seg3 = segT[2] > 0 ? segG[2] / segT[2] : 0;
  const l2Score =
    (rightT > 0 ? rightG / rightT : 0) - (leftT > 0 ? leftG / leftT : 0);

  return { l2Score, seg1, seg2, seg3 };
}
