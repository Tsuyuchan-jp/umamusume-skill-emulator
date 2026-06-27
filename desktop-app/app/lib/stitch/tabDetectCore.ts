import {
  STITCH_L2_GREEN_SCORE_MIN,
  STITCH_L3_GREEN_SEG_MIN,
  STITCH_PARTNER_REGISTER_EXCLUDE_MARGIN_RATIO,
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

export interface DetectStitchTabOptions {
  /** INV-2: partnerBand 検出結果（register 時の右セグ汚染除外） */
  partner?: PartnerBandDetection;
}

/** 右端セグ（育成情報位置）の優勢が register 汚染または弱優勢とみなす比率差 */
const ACTIVE_TAB_TRAINING_SEG_WEAK_DOMINANCE = 0.2;
/** アクティブタブ再走査: セグ内緑ピクセル比率の最低値 */
const ACTIVE_TAB_MIN_GREEN_RATIO = 0.03;
/** アクティブタブ Y 再走査ステップ（px） */
const ACTIVE_TAB_Y_SCAN_STEP_PX = 2;

/** タブ行を横分割し、各セグの緑ピクセル比率を返す */
function measureActiveTabSegmentRatios(
  img: RgbaImage,
  tabRowY: number,
  tabH: number,
  segmentCount: number,
  cropWidth: number
): number[] {
  const segWidth = Math.floor(cropWidth / segmentCount);
  const ratios: number[] = [];

  for (let seg = 0; seg < segmentCount; seg++) {
    const x0 = seg * segWidth;
    const x1 = seg === segmentCount - 1 ? cropWidth : (seg + 1) * segWidth;
    let greenCount = 0;
    let total = 0;

    for (let y = tabRowY; y < tabRowY + tabH && y < img.height; y++) {
      for (let x = x0; x < x1; x++) {
        total++;
        const i = (y * img.width + x) * 4;
        const r = img.data[i];
        const g = img.data[i + 1];
        const b = img.data[i + 2];
        if (isTabGreenRgb(r, g, b)) {
          greenCount++;
        }
      }
    }

    ratios.push(total > 0 ? greenCount / total : 0);
  }

  return ratios;
}

/** 最優勢セグと次点の緑比率差（アクティブタブ行の判別力） */
function measureActiveTabRowDiscrimination(ratios: readonly number[]): number {
  const sorted = [...ratios].sort((a, b) => b - a);
  if ((sorted[0] ?? 0) < ACTIVE_TAB_MIN_GREEN_RATIO) return -1;
  return (sorted[0] ?? 0) - (sorted[1] ?? 0);
}

/**
 * INV-2 拡張: partner register 帯下端より下へずらし、
 * tabRowY 付近で緑が弱いときはタブ行帯内を下方向再走査する。
 */
function resolveActiveTabScanY(
  img: RgbaImage,
  tabRowY: number,
  tabH: number,
  segmentCount: number,
  cropWidth: number,
  cropHeight: number,
  partner?: PartnerBandDetection
): number {
  let yMin = tabRowY;
  if (partner?.variant === "register" && partner.bandBottom != null) {
    const margin = Math.max(1, Math.floor(cropHeight * STITCH_PARTNER_REGISTER_EXCLUDE_MARGIN_RATIO));
    yMin = Math.max(yMin, partner.bandBottom + margin);
  }

  const yMax = Math.min(cropHeight - tabH - 1, tabRowY + Math.max(tabH * 2, 8));
  let bestY = yMin;
  let bestDisc = -1;

  for (let y = yMin; y <= yMax; y += ACTIVE_TAB_Y_SCAN_STEP_PX) {
    const ratios = measureActiveTabSegmentRatios(img, y, tabH, segmentCount, cropWidth);
    const disc = measureActiveTabRowDiscrimination(ratios);
    if (disc > bestDisc) {
      bestDisc = disc;
      bestY = y;
    }
  }

  return bestY;
}

function pickBestActiveTabSegment(scores: readonly number[]): number {
  let bestSeg = 0;
  let bestScore = scores[0] ?? 0;
  for (let seg = 1; seg < scores.length; seg++) {
    const score = scores[seg] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestSeg = seg;
    }
  }
  return bestSeg;
}

/** 右端セグ勝利が partner register 汚染または誤検出（弱優勢）か */
function shouldRepickWithoutTrainingSeg(
  scores: readonly number[],
  bestSeg: number,
  _partner?: PartnerBandDetection
): boolean {
  if (bestSeg !== 2 || scores.length < 3) return false;

  const win = scores[2] ?? 0;
  if (win <= ACTIVE_TAB_MIN_GREEN_RATIO) return false;

  const runnerUp = Math.max(scores[0] ?? 0, scores[1] ?? 0);
  const dominanceRatio = win > 0 ? (win - runnerUp) / win : 0;

  // 右端が明確に緑なら本物の育成情報タブ（FRD-I 実機）。register 帯があっても棄却しない
  if (dominanceRatio >= ACTIVE_TAB_TRAINING_SEG_WEAK_DOMINANCE) {
    return false;
  }

  // 弱優勢の右端のみ棄却（register 汚染・スキルタブ誤検出）
  return true;
}

function stitchTabFromSegmentIndex(bestSeg: number): StitchTab {
  if (bestSeg === 1) return "Inheritance";
  if (bestSeg === 2) return "TrainingInfo";
  return "Skill";
}

/** アクティブタブ（緑ハイライト位置）から StitchTab を判定 */
export function detectStitchTabFromRgba(
  img: RgbaImage,
  layout: StitchLayout,
  tabRowY: number,
  tabCount?: number,
  options?: DetectStitchTabOptions
): StitchTab {
  const cropWidth = img.width;
  const cropHeight = img.height;
  const tabH = Math.max(4, Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO));
  const segmentCount = tabCount ?? (layout === "L2" ? 2 : 3);

  if (segmentCount === 2 || layout === "L2") {
    return "Skill";
  }

  const partner = options?.partner;
  const scanY = resolveActiveTabScanY(
    img,
    tabRowY,
    tabH,
    segmentCount,
    cropWidth,
    cropHeight,
    partner
  );
  const scores = measureActiveTabSegmentRatios(
    img,
    scanY,
    tabH,
    segmentCount,
    cropWidth
  );
  let bestSeg = pickBestActiveTabSegment(scores);

  if (shouldRepickWithoutTrainingSeg(scores, bestSeg, partner)) {
    bestSeg = (scores[0] ?? 0) >= (scores[1] ?? 0) ? 0 : 1;
  }

  return stitchTabFromSegmentIndex(bestSeg);
}
