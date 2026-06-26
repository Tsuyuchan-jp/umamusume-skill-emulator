import {
  STITCH_L3_BTN_TAB_ROW_MIN_RATIO,
  STITCH_PARTNER_BTN_BRIGHTNESS,
  STITCH_PARTNER_BTN_MAX_ROW_RATIO,
  STITCH_PARTNER_BTN_MIN_WIDTH_RATIO,
  STITCH_PARTNER_BTN_Y_END,
  STITCH_PARTNER_BTN_Y_START,
  STITCH_TAB_ROW_HEIGHT_RATIO,
  STITCH_TAB_ROW_Y_SCAN_STEP,
  STITCH_TAB_SCAN_L2_END,
  STITCH_TAB_SCAN_L2_START,
  STITCH_TAB_SCAN_L3_BTN_END,
  STITCH_TAB_SCAN_L3_BTN_START,
  STITCH_TAB_SCAN_L3_END,
  STITCH_TAB_SCAN_L3_START,
} from "./constants";
import type { RgbaImage } from "./rgba";
import { scanGreenTabRowRgba, measureGreenTabProfileRgba } from "./tabDetectCore";
import type { LayoutDetection } from "./types";

const L3_UPPER_TAB_ROW_MAX_RATIO = 0.43;
/** partner 帯あり時のタブ行走査上限（golden G-FRD tabRowRatio max と整合） */
const L3_PARTNER_TAB_ROW_SCAN_END = 0.47;

/** 「練習パートナー解除」帯（明るい横長ボタン・縦幅が狭い）の有無 */
export function detectPartnerReleaseBandRgba(img: RgbaImage): boolean {
  const cropWidth = img.width;
  const cropHeight = img.height;
  const yStart = Math.floor(cropHeight * STITCH_PARTNER_BTN_Y_START);
  const yEnd = Math.floor(cropHeight * STITCH_PARTNER_BTN_Y_END);
  const roiH = Math.max(1, yEnd - yStart);

  const minBrightPixels = Math.floor(cropWidth * STITCH_PARTNER_BTN_MIN_WIDTH_RATIO);
  const maxButtonRows = Math.max(2, Math.floor(cropHeight * STITCH_PARTNER_BTN_MAX_ROW_RATIO));

  let runStart = -1;
  let bestRun = 0;

  for (let y = yStart; y < yStart + roiH && y < img.height; y++) {
    let brightCount = 0;
    for (let x = 0; x < cropWidth; x++) {
      const i = (y * img.width + x) * 4;
      const gray = Math.round(
        0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]
      );
      if (gray >= STITCH_PARTNER_BTN_BRIGHTNESS) brightCount++;
    }
    const isBrightRow = brightCount >= minBrightPixels;
    if (isBrightRow) {
      if (runStart === -1) runStart = y - yStart;
    } else if (runStart !== -1) {
      bestRun = Math.max(bestRun, y - yStart - runStart);
      runStart = -1;
    }
  }
  if (runStart !== -1) {
    bestRun = Math.max(bestRun, roiH - runStart);
  }

  return bestRun > 0 && bestRun <= maxButtonRows;
}

function isL3BtnTabRow(tabY: number, cropHeight: number): boolean {
  const ratio = tabY / cropHeight;
  return ratio >= STITCH_L3_BTN_TAB_ROW_MIN_RATIO && ratio > L3_UPPER_TAB_ROW_MAX_RATIO;
}

function isPartnerTabRowSeparated(l3RowTabY: number, l3BtnTabY: number, cropHeight: number): boolean {
  const minSep = Math.max(4, Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO * 0.5));
  return l3BtnTabY > l3RowTabY + minSep;
}

/** partner 帯あり: 期待 tabRow 帯 [0.385, 0.47] を優先してタブ行を選ぶ */
function scanPartnerTabRowRgba(img: RgbaImage): TabRowInfo {
  const cropHeight = img.height;
  const minSeg = 0.05;
  let bestInExpected: TabRowInfo | null = null;
  let bestInExpectedScore = -1;
  let bestOverall: TabRowInfo | null = null;
  let bestOverallScore = -1;

  for (
    let ratio = STITCH_L3_BTN_TAB_ROW_MIN_RATIO;
    ratio <= STITCH_TAB_SCAN_L3_END;
    ratio += STITCH_TAB_ROW_Y_SCAN_STEP
  ) {
    const tabY = Math.floor(cropHeight * ratio);
    const p = measureGreenTabProfileRgba(img, tabY);
    if (p.maxSeg < minSeg) continue;

    if (p.maxSeg > bestOverallScore) {
      bestOverallScore = p.maxSeg;
      bestOverall = { tabCount: 3, tabY, found: true, method: "green-l3" };
    }
    if (ratio <= L3_PARTNER_TAB_ROW_SCAN_END && p.maxSeg > bestInExpectedScore) {
      bestInExpectedScore = p.maxSeg;
      bestInExpected = { tabCount: 3, tabY, found: true, method: "green-l3" };
    }
  }

  if (bestInExpected) {
    return bestInExpected;
  }

  // 0.47 超の誤検出より、期待帯内の次善スコアを優先
  if (bestOverall && bestOverall.tabY / cropHeight > L3_PARTNER_TAB_ROW_SCAN_END) {
    return {
      tabCount: 3,
      tabY: Math.floor(cropHeight * L3_PARTNER_TAB_ROW_SCAN_END),
      found: true,
      method: "green-l3",
    };
  }

  return (
    bestOverall ?? {
      tabCount: 3,
      tabY: Math.floor(cropHeight * 0.46),
      found: false,
      method: "green-l3",
    }
  );
}

/** 初回フレームからレイアウトとタブ行を判定（R2 正本フロー） */
export function detectLayoutAndTabRowRgba(img: RgbaImage): LayoutDetection {
  const cropHeight = img.height;

  const l3Row = scanGreenTabRowRgba(
    img,
    STITCH_TAB_SCAN_L3_START,
    STITCH_TAB_SCAN_L3_END,
    "l3"
  );
  const l2Row = scanGreenTabRowRgba(
    img,
    STITCH_TAB_SCAN_L2_START,
    STITCH_TAB_SCAN_L2_END,
    "l2"
  );
  const l3BtnRow = scanGreenTabRowRgba(
    img,
    STITCH_TAB_SCAN_L3_BTN_START,
    STITCH_TAB_SCAN_L3_BTN_END,
    "l3"
  );
  const hasPartner = detectPartnerReleaseBandRgba(img);
  const partnerTabRow = hasPartner ? scanPartnerTabRowRgba(img) : l3BtnRow;
  const effectiveL3BtnRow =
    hasPartner && partnerTabRow.found ? partnerTabRow : l3BtnRow;

  if (l3Row.found) {
    if (
      hasPartner &&
      effectiveL3BtnRow.found &&
      isPartnerTabRowSeparated(l3Row.tabY, effectiveL3BtnRow.tabY, cropHeight)
    ) {
      return { layout: "L3+Btn", tabRow: effectiveL3BtnRow };
    }
    if (isL3BtnTabRow(l3Row.tabY, cropHeight)) {
      return { layout: "L3+Btn", tabRow: l3Row };
    }
    return { layout: "L3", tabRow: l3Row };
  }

  if (l2Row.found) {
    return { layout: "L2", tabRow: l2Row };
  }

  if (hasPartner && effectiveL3BtnRow.found) {
    return { layout: "L3+Btn", tabRow: effectiveL3BtnRow };
  }

  if (l3BtnRow.found) {
    if (isL3BtnTabRow(l3BtnRow.tabY, cropHeight)) {
      return { layout: "L3+Btn", tabRow: l3BtnRow };
    }
    return { layout: "L3", tabRow: l3BtnRow };
  }

  const fallbackTabY = Math.floor(cropHeight * 0.46);
  return {
    layout: "L2",
    tabRow: {
      tabCount: 2,
      tabY: fallbackTabY,
      found: true,
      method: "fallback",
    },
  };
}
