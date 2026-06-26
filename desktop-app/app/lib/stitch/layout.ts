// @ts-nocheck

import { detectLayoutAndTabRowRgba } from "./layoutCore";
import { matToRgba } from "./opencvRgba";
import type { LayoutDetection } from "./types";
import type { StitchLayout } from "./constants";

export { detectLayoutAndTabRowRgba, detectPartnerReleaseBandRgba } from "./layoutCore";

/** 初回フレームからレイアウトとタブ行を判定 */
export function detectStitchLayoutAndTabRow(
  croppedMat: any,
  cv: any,
  cropWidth: number,
  cropHeight: number
): LayoutDetection {
  const rgba = matToRgba(croppedMat, cv, cropWidth, cropHeight);
  return detectLayoutAndTabRowRgba(rgba);
}

/** 初回フレームからレイアウトを判定 */
export function detectStitchLayout(
  croppedMat: any,
  cv: any,
  cropWidth: number,
  cropHeight: number
): StitchLayout {
  return detectStitchLayoutAndTabRow(croppedMat, cv, cropWidth, cropHeight).layout;
}
