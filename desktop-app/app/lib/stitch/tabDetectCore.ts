import {
  STITCH_L2_GREEN_SCORE_MIN,
  STITCH_L3_GREEN_SEG_MIN,
  STITCH_TAB_ROW_HEIGHT_RATIO,
  STITCH_TAB_ROW_Y_SCAN_STEP,
  type StitchLayout,
} from "./constants";
import type { PartnerBandDetection } from "./partnerDetectCore";
import { shouldExcludePartnerRegisterBand } from "./partnerDetectCore";
import { isTabGreenRgb, type RgbaImage } from "./rgba";
import type { StitchTab, TabRowInfo } from "./types";

export interface GreenTabProfile {
  l2Score: number;
  seg1: number;
  seg2: number;
  seg3: number;
  maxSeg: number;
}

/** 1行分の緑タブプロファイル（RGBA 正本） */
export function measureGreenTabProfileRgba(
  img: RgbaImage,
  tabY: number
): GreenTabProfile {
  const cropWidth = img.width;
  const cropHeight = img.height;
  const tabH = Math.max(4, Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO));
  const seg3W = Math.floor(cropWidth / 3);

  let leftG = 0;
  let rightG = 0;
  let leftT = 0;
  let rightT = 0;
  const segG = [0, 0, 0];
  const segT = [0, 0, 0];

  for (let y = tabY; y < tabY + tabH && y < img.height; y++) {
    for (let x = 0; x < cropWidth; x++) {
      const i = (y * img.width + x) * 4;
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];
      const isGreen = isTabGreenRgb(r, g, b);

      if (x < Math.floor(cropWidth * 0.48)) {
        leftT++;
        if (isGreen) leftG++;
      } else if (x >= Math.floor(cropWidth * 0.52)) {
        rightT++;
        if (isGreen) rightG++;
      }

      const si = x < seg3W ? 0 : x < seg3W * 2 ? 1 : 2;
      segT[si]++;
      if (isGreen) segG[si]++;
    }
  }

  const seg1 = segT[0] > 0 ? segG[0] / segT[0] : 0;
  const seg2 = segT[1] > 0 ? segG[1] / segT[1] : 0;
  const seg3 = segT[2] > 0 ? segG[2] / segT[2] : 0;
  const l2Score =
    (rightT > 0 ? rightG / rightT : 0) - (leftT > 0 ? leftG / leftT : 0);

  return { l2Score, seg1, seg2, seg3, maxSeg: Math.max(seg1, seg2, seg3) };
}

export interface ScanGreenTabRowOptions {
  minL3Seg?: number;
  minL2Score?: number;
  /** INV-2: partnerBand 検出結果（register 帯を tab 走査から除外） */
  partner?: PartnerBandDetection;
  /** @deprecated partner を渡すこと。true のみの場合はプロファイルベース除外 */
  excludePartnerGreen?: boolean;
}

/** 緑プロファイルでタブ行を走査 */
export function scanGreenTabRowRgba(
  img: RgbaImage,
  startRatio: number,
  endRatio: number,
  mode: "l2" | "l3",
  options?: ScanGreenTabRowOptions
): TabRowInfo {
  const minL3Seg = options?.minL3Seg ?? STITCH_L3_GREEN_SEG_MIN;
  const minL2Score = options?.minL2Score ?? STITCH_L2_GREEN_SCORE_MIN;
  const partner = options?.partner;
  const excludePartnerGreen = options?.excludePartnerGreen ?? partner != null;
  const cropHeight = img.height;
  let best: TabRowInfo = {
    tabCount: mode === "l2" ? 2 : 3,
    tabY: Math.floor(cropHeight * ((startRatio + endRatio) / 2)),
    found: false,
    method: mode === "l2" ? "green-l2" : "green-l3",
  };
  let bestScore = -1;

  for (let ratio = startRatio; ratio <= endRatio; ratio += STITCH_TAB_ROW_Y_SCAN_STEP) {
    const tabY = Math.floor(cropHeight * ratio);
    if (tabY + Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO) >= cropHeight) continue;

    const p = measureGreenTabProfileRgba(img, tabY);
    if (excludePartnerGreen) {
      const partnerInput = partner ?? { variant: "absent" as const };
      if (shouldExcludePartnerRegisterBand(ratio, p, partnerInput, cropHeight)) continue;
    }

    if (mode === "l2") {
      if (p.l2Score < minL2Score) continue;
      if (p.l2Score > bestScore) {
        bestScore = p.l2Score;
        best = { tabCount: 2, tabY, found: true, method: "green-l2" };
      }
    } else {
      if (p.maxSeg < minL3Seg) continue;
      if (p.maxSeg > bestScore) {
        bestScore = p.maxSeg;
        best = { tabCount: 3, tabY, found: true, method: "green-l3" };
      }
    }
  }

  return best;
}

/** アクティブタブ（緑ハイライト位置）から StitchTab を判定 */
export function detectStitchTabFromRgba(
  img: RgbaImage,
  layout: StitchLayout,
  tabRowY: number,
  tabCount?: number
): StitchTab {
  const cropWidth = img.width;
  const cropHeight = img.height;
  const tabH = Math.max(4, Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO));
  const segmentCount = tabCount ?? (layout === "L2" ? 2 : 3);

  if (segmentCount === 2 || layout === "L2") {
    return "Skill";
  }

  const segWidth = Math.floor(cropWidth / segmentCount);

  let bestSeg = 0;
  let bestGreen = 0;

  for (let seg = 0; seg < segmentCount; seg++) {
    const x0 = seg * segWidth;
    const x1 = seg === segmentCount - 1 ? cropWidth : (seg + 1) * segWidth;
    let greenSum = 0;
    let count = 0;

    for (let y = tabRowY; y < tabRowY + tabH && y < img.height; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * img.width + x) * 4;
        const r = img.data[i];
        const g = img.data[i + 1];
        const b = img.data[i + 2];
        if (isTabGreenRgb(r, g, b)) {
          greenSum += g;
          count++;
        }
      }
    }

    const avg = count > 0 ? greenSum / count : 0;
    if (avg > bestGreen) {
      bestGreen = avg;
      bestSeg = seg;
    }
  }

  if (bestSeg === 1) return "Inheritance";
  if (bestSeg === 2) return "TrainingInfo";
  return "Skill";
}
