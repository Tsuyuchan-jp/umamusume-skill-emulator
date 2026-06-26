/** RGBA バッファ向けピクセルアクセス（Node golden / OpenCV 共通ロジック用） */

import {
  STITCH_TAB_GREEN_G_MIN,
  STITCH_TAB_GREEN_G_OVER_B,
  STITCH_TAB_GREEN_G_OVER_R,
  STITCH_TITLE_BAR_H_MAX,
  STITCH_TITLE_BAR_H_MIN,
  STITCH_TITLE_BAR_S_MIN,
} from "./constants";

export interface RgbaImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export function rgbaAt(img: RgbaImage, x: number, y: number): [number, number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return [h / 2, s * 255, v * 255];
}

/** タブ・緑帯走査の正本（RGB。measure-regions.ps1 Test-TabGreen 相当） */
export function isTabGreenRgb(r: number, g: number, b: number): boolean {
  return (
    g >= STITCH_TAB_GREEN_G_MIN &&
    g > r + STITCH_TAB_GREEN_G_OVER_R &&
    g > b + STITCH_TAB_GREEN_G_OVER_B
  );
}

/** タブ緑判定エイリアス（検出器は isTabGreenRgb のみ参照） */
export const isTabGreen = isTabGreenRgb;

/** 緑タイトルバー（crop 検出用・OpenCV 半スケール HSV） */
export function isTitleBarGreenHsv(h: number, s: number, v: number): boolean {
  return h >= STITCH_TITLE_BAR_H_MIN && h <= STITCH_TITLE_BAR_H_MAX && s >= STITCH_TITLE_BAR_S_MIN;
}

/** RGB からタイトルバー緑を判定 */
export function isTitleBarGreenRgb(r: number, g: number, b: number): boolean {
  const [h, s, v] = rgbToHsv(r, g, b);
  return isTitleBarGreenHsv(h, s, v);
}
