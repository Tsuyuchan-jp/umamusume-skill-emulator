import {
  STITCH_L3_GREEN_SEG_MIN,
  STITCH_PARTNER_BTN_BRIGHTNESS,
  STITCH_PARTNER_BTN_MAX_ROW_RATIO,
  STITCH_PARTNER_BTN_MIN_WIDTH_RATIO,
  STITCH_PARTNER_BTN_Y_END,
  STITCH_PARTNER_BTN_Y_START,
  STITCH_PARTNER_GREEN_CENTER_GAP,
  STITCH_PARTNER_GREEN_CENTER_DOMINANT_MIN_SEG,
  STITCH_PARTNER_GREEN_EXCLUDE_RATIO_END,
  STITCH_PARTNER_GREEN_EXCLUDE_RATIO_START,
  STITCH_PARTNER_GREEN_REGISTER_SIDE_MAX_SEG,
  STITCH_PARTNER_GREEN_SIDE_MIN_SEG,
  STITCH_PARTNER_GREEN_UNIFORM_MAX_SPREAD,
  STITCH_PARTNER_GREEN_UNIFORM_MIN_SEG,
  STITCH_PARTNER_REGISTER_EXCLUDE_MARGIN_RATIO,
  STITCH_TAB_ROW_HEIGHT_RATIO,
  STITCH_TAB_ROW_Y_SCAN_STEP,
} from "./constants";
import type { RgbaImage } from "./rgba";
import type { GreenTabProfile } from "./tabDetectCore";
import { measureGreenTabProfileRgba } from "./tabDetectCore";

export type PartnerBandVariant = "absent" | "register" | "release";

export interface PartnerBandDetection {
  variant: PartnerBandVariant;
  /** crop 基準の帯中心 Y（ピクセル）。absent 時は undefined */
  bandY?: number;
  /** crop 基準の帯中心比率。absent 時は undefined */
  bandRatio?: number;
  /** register 時: tab 走査除外帯上端（crop 基準ピクセル） */
  bandTop?: number;
  /** register 時: tab 走査除外帯下端（crop 基準ピクセル） */
  bandBottom?: number;
}

/** register 帯の幾何除外範囲（bandY ± tabRowHeight/2 ± margin） */
export function computePartnerRegisterExcludeBand(
  bandY: number,
  cropHeight: number
): { bandTop: number; bandBottom: number } {
  const tabRowH = Math.max(4, Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO));
  const halfH = Math.floor(tabRowH / 2);
  const margin = Math.max(1, Math.floor(cropHeight * STITCH_PARTNER_REGISTER_EXCLUDE_MARGIN_RATIO));
  return {
    bandTop: Math.max(0, bandY - halfH - margin),
    bandBottom: Math.min(cropHeight - 1, bandY + halfH + margin),
  };
}

/** ratio 走査点が partner register 除外帯と重なるか */
export function isRatioInPartnerRegisterExcludeBand(
  ratio: number,
  partner: PartnerBandDetection,
  cropHeight: number
): boolean {
  if (partner.variant !== "register" || partner.bandTop == null || partner.bandBottom == null) {
    return false;
  }
  const tabY = Math.floor(cropHeight * ratio);
  const tabH = Math.max(4, Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO));
  const rowCenterY = tabY + Math.floor(tabH / 2);
  return rowCenterY >= partner.bandTop && rowCenterY <= partner.bandBottom;
}

/** 練習パートナー登録（緑横長ボタン）帯プロファイル判定 */
export function isPartnerGreenRegisterBand(
  ratio: number,
  profile: Pick<GreenTabProfile, "seg1" | "seg2" | "seg3" | "l2Score" | "maxSeg">
): boolean {
  if (
    ratio < STITCH_PARTNER_GREEN_EXCLUDE_RATIO_START ||
    ratio > STITCH_PARTNER_GREEN_EXCLUDE_RATIO_END
  ) {
    return false;
  }

  const minSeg = Math.min(profile.seg1, profile.seg2, profile.seg3);
  const maxSeg = Math.max(profile.seg1, profile.seg2, profile.seg3);
  const sideMin = Math.min(profile.seg1, profile.seg3);

  const uniform =
    minSeg >= STITCH_PARTNER_GREEN_UNIFORM_MIN_SEG &&
    maxSeg - minSeg <= STITCH_PARTNER_GREEN_UNIFORM_MAX_SPREAD;

  const registerWithLabel =
    sideMin >= STITCH_PARTNER_GREEN_SIDE_MIN_SEG &&
    profile.seg2 < sideMin - STITCH_PARTNER_GREEN_CENTER_GAP &&
    profile.maxSeg >= STITCH_L3_GREEN_SEG_MIN;

  const centerDominantRegister =
    profile.seg2 >= STITCH_PARTNER_GREEN_CENTER_DOMINANT_MIN_SEG &&
    sideMin <= STITCH_PARTNER_GREEN_REGISTER_SIDE_MAX_SEG &&
    sideMin < profile.seg2 - STITCH_PARTNER_GREEN_CENTER_GAP &&
    profile.maxSeg >= STITCH_L3_GREEN_SEG_MIN;

  return uniform || registerWithLabel || centerDominantRegister;
}

/** 「練習パートナー解除」帯（明るい横長ボタン・縦幅が狭い） */
function detectPartnerReleaseBandRgba(img: RgbaImage): PartnerBandDetection | null {
  const cropWidth = img.width;
  const cropHeight = img.height;
  const yStart = Math.floor(cropHeight * STITCH_PARTNER_BTN_Y_START);
  const yEnd = Math.floor(cropHeight * STITCH_PARTNER_BTN_Y_END);
  const roiH = Math.max(1, yEnd - yStart);

  const minBrightPixels = Math.floor(cropWidth * STITCH_PARTNER_BTN_MIN_WIDTH_RATIO);
  const maxButtonRows = Math.max(2, Math.floor(cropHeight * STITCH_PARTNER_BTN_MAX_ROW_RATIO));

  let runStart = -1;
  let bestRun = 0;
  let bestRunCenterY = -1;

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
      const runLen = y - yStart - runStart;
      if (runLen > bestRun) {
        bestRun = runLen;
        bestRunCenterY = yStart + runStart + Math.floor(runLen / 2);
      }
      runStart = -1;
    }
  }
  if (runStart !== -1) {
    const runLen = roiH - runStart;
    if (runLen > bestRun) {
      bestRun = runLen;
      bestRunCenterY = yStart + runStart + Math.floor(runLen / 2);
    }
  }

  if (bestRun <= 0 || bestRun > maxButtonRows || bestRunCenterY < 0) {
    return null;
  }

  return {
    variant: "release",
    bandY: bestRunCenterY,
    bandRatio: bestRunCenterY / cropHeight,
  };
}

/** 練習パートナー登録（緑横長ボタン）帯 */
function detectPartnerRegisterBandRgba(img: RgbaImage): PartnerBandDetection | null {
  const cropHeight = img.height;
  let bestRatio = -1;
  let bestScore = -1;

  for (
    let ratio = STITCH_PARTNER_GREEN_EXCLUDE_RATIO_START;
    ratio <= STITCH_PARTNER_GREEN_EXCLUDE_RATIO_END;
    ratio += STITCH_TAB_ROW_Y_SCAN_STEP
  ) {
    const tabY = Math.floor(cropHeight * ratio);
    if (tabY + Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO) >= cropHeight) continue;

    const profile = measureGreenTabProfileRgba(img, tabY);
    if (!isPartnerGreenRegisterBand(ratio, profile)) continue;

    if (profile.maxSeg > bestScore) {
      bestScore = profile.maxSeg;
      bestRatio = ratio;
    }
  }

  if (bestRatio < 0) return null;

  const bandY = Math.floor(cropHeight * bestRatio);
  const { bandTop, bandBottom } = computePartnerRegisterExcludeBand(bandY, cropHeight);
  return { variant: "register", bandY, bandRatio: bestRatio, bandTop, bandBottom };
}

/**
 * partnerBand 検出（INV-2 入力）
 * release を優先するが、上部 ROI の誤 release と下段 register 帯が同居するときは register 優先
 */
export function detectPartnerBandRgba(img: RgbaImage): PartnerBandDetection {
  const release = detectPartnerReleaseBandRgba(img);
  const register = detectPartnerRegisterBandRgba(img);

  if (release && register) {
    const releaseRatio = release.bandRatio;
    const registerRatio = register.bandRatio;
    if (
      releaseRatio != null &&
      registerRatio != null &&
      releaseRatio <= STITCH_PARTNER_BTN_Y_END &&
      registerRatio >= STITCH_PARTNER_GREEN_EXCLUDE_RATIO_START
    ) {
      return register;
    }
  }

  if (release) return release;
  if (register) return register;

  return { variant: "absent" };
}

/** tab 走査で除外すべき partner register 帯か（幾何帯 + プロファイル） */
export function shouldExcludePartnerRegisterBand(
  ratio: number,
  profile: Pick<GreenTabProfile, "seg1" | "seg2" | "seg3" | "l2Score" | "maxSeg">,
  partner: PartnerBandDetection,
  cropHeight: number
): boolean {
  if (isRatioInPartnerRegisterExcludeBand(ratio, partner, cropHeight)) return true;
  return isPartnerGreenRegisterBand(ratio, profile);
}
