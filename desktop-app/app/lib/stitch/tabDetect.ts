// @ts-nocheck

import { STITCH_TAB_ROW_HEIGHT_RATIO, type StitchLayout } from "./constants";
import { detectStitchLayoutAndTabRow } from "./layoutOpenCv";
import { matToRgba } from "./opencvRgba";
import { detectStitchTabFromRgba, measureGreenTabProfileRgba, scanGreenTabRowRgba } from "./tabDetectCore";
import type { PartnerBandDetection } from "./partnerDetectCore";
import { detectPartnerBandRgba } from "./partnerDetectCore";
import type { StitchTab, TabRowInfo } from "./types";

export {
  detectStitchTabFromRgba,
  measureGreenTabProfileRgba,
  scanGreenTabRowRgba,
  type DetectStitchTabOptions,
} from "./tabDetectCore";

/** OpenCV Mat 向け緑タブプロファイル */
export function measureGreenTabProfile(
  croppedMat: any,
  cv: any,
  cropWidth: number,
  tabY: number,
  cropHeight: number
) {
  const rgba = matToRgba(croppedMat, cv, cropWidth, cropHeight);
  return measureGreenTabProfileRgba(rgba, tabY);
}

/** OpenCV Mat 向けタブ行走査 */
export function scanGreenTabRow(
  croppedMat: any,
  cv: any,
  cropWidth: number,
  cropHeight: number,
  startRatio: number,
  endRatio: number,
  mode: "l2" | "l3"
): TabRowInfo {
  const rgba = matToRgba(croppedMat, cv, cropWidth, cropHeight);
  return scanGreenTabRowRgba(rgba, startRatio, endRatio, mode);
}

/** アクティブタブ（緑ハイライト位置）から StitchTab を判定 */
export function detectStitchTab(
  croppedMat: any,
  cv: any,
  cropWidth: number,
  cropHeight: number,
  layout: StitchLayout,
  tabRowY?: number,
  tabCount?: number,
  partner?: PartnerBandDetection
): StitchTab {
  const layoutResult = detectStitchLayoutAndTabRow(croppedMat, cv, cropWidth, cropHeight);
  const tabY = tabRowY ?? layoutResult.tabRow.tabY;
  const count = tabCount ?? layoutResult.tabRow.tabCount;

  const rgba = matToRgba(croppedMat, cv, cropWidth, cropHeight);
  const partnerDetect = partner ?? detectPartnerBandRgba(rgba);
  return detectStitchTabFromRgba(rgba, layout, tabY, count, { partner: partnerDetect });
}
