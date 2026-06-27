import {
  STITCH_L2_GREEN_SCORE_MIN,
  STITCH_L2_HIGH_TAB_ROW_MIN_RATIO,
  STITCH_L2_VS_L3_PRIORITY_RATIO,
  STITCH_L3_BTN_TAB_ROW_MIN_RATIO,
  STITCH_TAB_ROW_HEIGHT_RATIO,
  STITCH_TAB_ROW_Y_SCAN_STEP,
  STITCH_TAB_SCAN_L2_END,
  STITCH_TAB_SCAN_L2_START,
  STITCH_TAB_SCAN_L3_BTN_END,
  STITCH_TAB_SCAN_L3_BTN_START,
  STITCH_TAB_SCAN_L3_END,
  STITCH_TAB_SCAN_L3_START,
} from "./constants";
import { detectPartnerBandRgba, shouldExcludePartnerRegisterBand } from "./partnerDetectCore";
import type { RgbaImage } from "./rgba";
import {
  measureGreenTabProfileRgba,
  scanGreenTabRowRgba,
} from "./tabDetectCore";
import type { LayoutDetection, TabRowInfo } from "./types";

const L3_UPPER_TAB_ROW_MAX_RATIO = 0.43;
/** partner 帯あり時のタブ行走査上限（golden G-FRD tabRowRatio max と整合） */
const L3_PARTNER_TAB_ROW_SCAN_END = 0.47;

function isL3BtnTabRow(tabY: number, cropHeight: number): boolean {
  const ratio = tabY / cropHeight;
  return ratio >= STITCH_L3_BTN_TAB_ROW_MIN_RATIO && ratio > L3_UPPER_TAB_ROW_MAX_RATIO;
}

function isPartnerTabRowSeparated(l3RowTabY: number, l3BtnTabY: number, cropHeight: number): boolean {
  const minSep = Math.max(4, Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO * 0.5));
  return l3BtnTabY > l3RowTabY + minSep;
}

/** l3Row が先にヒットしても L2 タブ行を優先すべきか（R3.5b: TRN 誤 L3+Btn 防止） */
export function shouldPreferL2(
  img: RgbaImage,
  l2Row: TabRowInfo,
  l3Row: TabRowInfo,
  hasPartner: boolean,
  cropHeight: number
): boolean {
  if (!l2Row.found) return false;

  const pL2 = measureGreenTabProfileRgba(img, l2Row.tabY);
  if (pL2.l2Score < STITCH_L2_GREEN_SCORE_MIN) return false;

  if (!l3Row.found) return true;

  const pL3 = measureGreenTabProfileRgba(img, l3Row.tabY);
  const l2Wins = pL2.l2Score > pL3.maxSeg * STITCH_L2_VS_L3_PRIORITY_RATIO;
  const yTol = Math.max(4, Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO * 0.5));
  const sameRowL2 =
    Math.abs(l3Row.tabY - l2Row.tabY) <= yTol && l2Wins;
  const trnPattern =
    !hasPartner &&
    l2Row.tabY / cropHeight >= STITCH_L2_HIGH_TAB_ROW_MIN_RATIO &&
    l2Wins;

  return sameRowL2 || trnPattern;
}

/** partner 帯あり: 期待 tabRow 帯を優先してタブ行を選ぶ */
function scanPartnerTabRowRgba(
  img: RgbaImage,
  partner: ReturnType<typeof detectPartnerBandRgba>
): TabRowInfo {
  const cropHeight = img.height;
  const minSeg = 0.05;
  let bestInExpected: TabRowInfo | null = null;
  let bestInExpectedScore = -1;
  let bestOverall: TabRowInfo | null = null;
  let bestOverallScore = -1;

  const registerTabScanStart =
    partner.variant === "register" && partner.bandRatio != null
      ? partner.bandRatio + STITCH_TAB_ROW_HEIGHT_RATIO * 0.5
      : STITCH_L3_BTN_TAB_ROW_MIN_RATIO;
  const scanStart = Math.max(STITCH_L3_BTN_TAB_ROW_MIN_RATIO, registerTabScanStart);

  for (
    let ratio = scanStart;
    ratio <= STITCH_TAB_SCAN_L3_END;
    ratio += STITCH_TAB_ROW_Y_SCAN_STEP
  ) {
    const tabY = Math.floor(cropHeight * ratio);
    const p = measureGreenTabProfileRgba(img, tabY);
    if (p.maxSeg < minSeg) continue;
    if (shouldExcludePartnerRegisterBand(ratio, p, partner, cropHeight)) continue;

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
  const partner = detectPartnerBandRgba(img);
  const hasPartner = partner.variant !== "absent";
  const scanOpts = { partner };

  const l3Row = scanGreenTabRowRgba(
    img,
    STITCH_TAB_SCAN_L3_START,
    STITCH_TAB_SCAN_L3_END,
    "l3",
    scanOpts
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
    "l3",
    scanOpts
  );
  const partnerTabRow = hasPartner ? scanPartnerTabRowRgba(img, partner) : l3BtnRow;

  // INV-2: register 時は partnerTabRow を tabRow 正本（l3Row@登録ボタン誤認経路を回避）
  if (partner.variant === "register" && partnerTabRow.found) {
    return { layout: "L3+Btn", tabRow: partnerTabRow };
  }

  const effectiveL3BtnRow =
    hasPartner && partnerTabRow.found ? partnerTabRow : l3BtnRow;
  const preferL2 = shouldPreferL2(img, l2Row, l3Row, hasPartner, cropHeight);

  if (preferL2 && l2Row.found) {
    return { layout: "L2", tabRow: l2Row };
  }

  if (l3Row.found) {
    if (
      hasPartner &&
      effectiveL3BtnRow.found &&
      isPartnerTabRowSeparated(l3Row.tabY, effectiveL3BtnRow.tabY, cropHeight)
    ) {
      return { layout: "L3+Btn", tabRow: effectiveL3BtnRow };
    }
    if (isL3BtnTabRow(l3Row.tabY, cropHeight) && !preferL2) {
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
    if (isL3BtnTabRow(l3BtnRow.tabY, cropHeight) && !preferL2) {
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

/** @deprecated partnerDetectCore.detectPartnerBandRgba を使用 */
export function detectPartnerReleaseBandRgba(img: RgbaImage): boolean {
  return detectPartnerBandRgba(img).variant === "release";
}
