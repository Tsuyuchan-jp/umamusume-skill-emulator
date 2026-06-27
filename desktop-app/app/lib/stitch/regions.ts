// @ts-nocheck

import type { StitchLayout } from "./constants";
import { matToRgba } from "./opencvRgba";
import { detectScrollStartYFromRgba } from "./regionsCore";
import type { ScrollStartResult, TabRowInfo } from "./types";

export type { ScrollStartResult } from "./types";
export { detectScrollStartYFromRgba, detectScrollStartYFromFrame0Rgba } from "./regionsCore";

/** OpenCV Mat 2枚から scrollStartY を決定（regionsCore 正本・RGBA 経由） */
export function detectScrollStartY(
  frame0: any,
  frame1: any,
  cv: any,
  cropWidth: number,
  cropHeight: number,
  layout: StitchLayout,
  tabRow?: TabRowInfo
): ScrollStartResult {
  const f0 = matToRgba(frame0, cv, cropWidth, cropHeight);
  const f1 = matToRgba(frame1, cv, cropWidth, cropHeight);
  return detectScrollStartYFromRgba(f0, f1, layout, tabRow);
}
