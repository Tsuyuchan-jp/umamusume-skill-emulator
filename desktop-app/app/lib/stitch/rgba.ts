/** RGBA バッファ向けピクセルアクセス（Node golden / OpenCV 共通ロジック用） */

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

export function isTabGreenHsv(h: number, s: number, v: number): boolean {
  return h >= 35 && h <= 85 && s >= 80 && v >= 80;
}

/** measure-regions.ps1 Test-TabGreen 相当（タブ行走査用） */
export function isTabGreenRgb(r: number, g: number, b: number): boolean {
  return g >= 100 && g > r + 30 && g > b + 20;
}

export function isTitleBarGreenHsv(h: number, s: number, v: number): boolean {
  return h >= 20 && h <= 60 && s >= 150;
}
