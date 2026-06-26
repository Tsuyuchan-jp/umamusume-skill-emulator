// @ts-nocheck

import { matToRgba } from "./opencvRgba";
import {
  estimateShiftFramesRgba,
  type ShiftEstimateResult,
} from "./shiftEstimateCore";

export type { ShiftEstimateResult, ShiftPairResult, ShiftEstimateMethod } from "./shiftEstimateCore";

/** crop[scrollStartY..footerStart) のスクロール帯 Mat を抽出して SSD + median 推定 */
export function estimateShiftFrames(
  croppedMats: any[],
  cv: any,
  cropWidth: number,
  scrollStartY: number,
  scrollRegionHeight: number
): ShiftEstimateResult {
  const strips = croppedMats.map((mat) => {
    const rgba = matToRgba(
      mat.roi(new cv.Rect(0, scrollStartY, cropWidth, scrollRegionHeight)),
      cv,
      cropWidth,
      scrollRegionHeight
    );
    return rgba;
  });

  return estimateShiftFramesRgba(strips);
}
