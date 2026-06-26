// @ts-nocheck

import { matToRgba } from "./opencvRgba";
import { matchScrollFramesRgba, type ScrollMatchResult } from "./scrollMatchCore";

export type { ScrollMatchResult, ScrollFrameMatch } from "./scrollMatchCore";

/** crop[scrollStartY..footerStart) のスクロール帯 Mat を抽出 */
export function extractScrollStrip(
  croppedMat: any,
  cv: any,
  cropWidth: number,
  scrollStartY: number,
  scrollRegionHeight: number
): any {
  return croppedMat.roi(new cv.Rect(0, scrollStartY, cropWidth, scrollRegionHeight));
}

/** 全フレームのスクロール帯で NCC + S-4 absdiff マッチ */
export function matchScrollFrames(
  croppedMats: any[],
  cv: any,
  cropWidth: number,
  scrollStartY: number,
  scrollRegionHeight: number
): ScrollMatchResult {
  const strips = croppedMats.map((mat) => {
    const rgba = matToRgba(
      mat.roi(new cv.Rect(0, scrollStartY, cropWidth, scrollRegionHeight)),
      cv,
      cropWidth,
      scrollRegionHeight
    );
    return rgba;
  });

  return matchScrollFramesRgba(strips);
}
