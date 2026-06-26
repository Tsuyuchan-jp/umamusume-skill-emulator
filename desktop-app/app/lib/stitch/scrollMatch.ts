// @ts-nocheck

/**
 * scrollMatch — shiftEstimate への内部委譲（R3.5a 正本）
 * @deprecated scrollMatchCore（NCC 主経路）は非推奨。新規コードは shiftEstimate を使用すること。
 */

import { estimateShiftFrames } from "./shiftEstimate";
import type { ShiftEstimateMethod } from "./shiftEstimateCore";

export type ScrollMatchMethod = ShiftEstimateMethod;

export interface ScrollFrameMatch {
  index: number;
  scrollAmount: number;
  score: number;
  method: ScrollMatchMethod;
  rawScrollAmount?: number;
}

export interface ScrollMatchResult {
  overlaps: number[];
  frames: ScrollFrameMatch[];
  representative: number;
}

/** crop[scrollStartY..footerStart) のスクロール帯で全重なり SSD + セッション median */
export function extractScrollStrip(
  croppedMat: any,
  cv: any,
  cropWidth: number,
  scrollStartY: number,
  scrollRegionHeight: number
): any {
  return croppedMat.roi(new cv.Rect(0, scrollStartY, cropWidth, scrollRegionHeight));
}

export function matchScrollFrames(
  croppedMats: any[],
  cv: any,
  cropWidth: number,
  scrollStartY: number,
  scrollRegionHeight: number
): ScrollMatchResult {
  const result = estimateShiftFrames(
    croppedMats,
    cv,
    cropWidth,
    scrollStartY,
    scrollRegionHeight
  );

  return {
    overlaps: result.overlaps,
    frames: result.frames.map((f) => ({
      index: f.index,
      scrollAmount: f.scrollAmount,
      score: f.score,
      method: f.method,
      rawScrollAmount: f.rawScrollAmount,
    })),
    representative: result.representative,
  };
}
