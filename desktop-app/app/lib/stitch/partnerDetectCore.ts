import {
  STITCH_L3_GREEN_SEG_MIN,
  STITCH_PARTNER_BTN_BRIGHTNESS,
  STITCH_PARTNER_BTN_MAX_ROW_RATIO,
  STITCH_PARTNER_BTN_MIN_WIDTH_RATIO,
  STITCH_PARTNER_BTN_Y_END,
  STITCH_PARTNER_BTN_Y_START,
  STITCH_PARTNER_GREEN_CENTER_GAP,
  STITCH_PARTNER_GREEN_EXCLUDE_RATIO_END,
  STITCH_PARTNER_GREEN_EXCLUDE_RATIO_START,
  STITCH_PARTNER_GREEN_SIDE_MIN_SEG,
  STITCH_PARTNER_GREEN_UNIFORM_MAX_SPREAD,
  STITCH_PARTNER_GREEN_UNIFORM_MIN_SEG,
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

  return uniform || registerWithLabel;
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
  return { variant: "register", bandY, bandRatio: bestRatio };
}

/**
 * partnerBand 検出（INV-2 入力）
 * release を優先し、なければ register、どちらもなければ absent
 */
export function detectPartnerBandRgba(img: RgbaImage): PartnerBandDetection {
  const release = detectPartnerReleaseBandRgba(img);
  if (release) return release;

  const register = detectPartnerRegisterBandRgba(img);
  if (register) return register;

  return { variant: "absent" };
}

/** tab 走査で除外すべき partner register 帯か（ratio + 事前検出結果） */
export function shouldExcludePartnerRegisterBand(
  ratio: number,
  profile: Pick<GreenTabProfile, "seg1" | "seg2" | "seg3" | "l2Score" | "maxSeg">,
  partner: PartnerBandDetection
): boolean {
  if (partner.variant === "register" && partner.bandRatio != null) {
    const tol = STITCH_TAB_ROW_Y_SCAN_STEP * 0.5;
    if (Math.abs(ratio - partner.bandRatio) <= tol) return true;
  }
  return isPartnerGreenRegisterBand(ratio, profile);
}
