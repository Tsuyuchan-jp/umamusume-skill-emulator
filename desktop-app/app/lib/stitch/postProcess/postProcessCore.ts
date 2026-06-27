import {
  STITCH_INHERITANCE_FACTOR_HEADER_MAX_RATIO,
  STITCH_INHERITANCE_GREEN_MIN_WIDTH_RATIO,
  STITCH_INHERITANCE_GREEN_SEARCH_START,
  STITCH_SCROLLBAR_WIDTH_RATIO,
  STITCH_WHITESPACE_STD_THRESHOLD,
} from "../constants";
import type { RgbaImage } from "../rgba";

export interface PostProcessInputRgba {
  image: RgbaImage;
  scrollStartY: number;
  /** compose が返すスクロール内容下端（出力座標） */
  scrollContentBottomY: number;
  scrollRegionH: number;
}

export interface PostProcessResultRgba {
  image: RgbaImage;
  /** 余白トリムまたは S-5 クロップが適用された */
  cropped: boolean;
}

/** S-2: scrollStartY 基準・右端 3% を左隣列で塗りつぶし */
export function hideScrollbarRgba(
  data: Uint8Array,
  width: number,
  height: number,
  scrollbarStartY: number,
  scrollContentBottomY: number
): void {
  const sbWidth = Math.ceil(width * STITCH_SCROLLBAR_WIDTH_RATIO);
  const safeX = width - sbWidth - 1;
  const scrollRegionH = scrollContentBottomY - scrollbarStartY;

  if (sbWidth <= 0 || safeX <= 0 || scrollRegionH <= 0) return;

  for (let y = scrollbarStartY; y < scrollContentBottomY; y++) {
    const srcIdx = (y * width + safeX) * 4;
    for (let dx = 1; dx <= sbWidth; dx++) {
      const dstIdx = (y * width + safeX + dx) * 4;
      data[dstIdx] = data[srcIdx]!;
      data[dstIdx + 1] = data[srcIdx + 1]!;
      data[dstIdx + 2] = data[srcIdx + 2]!;
      data[dstIdx + 3] = data[srcIdx + 3]!;
    }
  }
}

/** スクロール末端の余白を自動クロップ */
export function trimBottomWhitespaceRgba(
  data: Uint8Array,
  width: number,
  height: number,
  scrollDrawY: number
): { data: Uint8Array; height: number; cropped: boolean } {
  let contentBottomY = scrollDrawY;

  for (let y = scrollDrawY - 10; y >= 0; y -= 10) {
    const std = rowStdDevRgba(data, width, y, Math.min(10, height - y));
    if (std > STITCH_WHITESPACE_STD_THRESHOLD) {
      contentBottomY = Math.min(y + 20, height);
      break;
    }
  }

  if (contentBottomY >= height) {
    return { data, height, cropped: false };
  }

  const newH = contentBottomY;
  const out = new Uint8Array(width * newH * 4);
  out.set(data.subarray(0, width * newH * 4));
  return { data: out, height: newH, cropped: true };
}

/** S-5: 継承タブ — 緑の継承履歴バー手前でクロップ（RGBA 正本） */
export function cropAtInheritanceHistoryBarRgba(
  image: RgbaImage,
  scrollStartY: number,
  scrollRegionH: number
): { image: RgbaImage; cropped: boolean } {
  const { data, width, height } = image;
  const searchStartY = Math.floor(
    scrollStartY + scrollRegionH * STITCH_INHERITANCE_GREEN_SEARCH_START
  );
  const factorHeaderMaxY = Math.floor(
    scrollStartY + scrollRegionH * STITCH_INHERITANCE_FACTOR_HEADER_MAX_RATIO
  );
  const minGreenPixels = Math.floor(width * STITCH_INHERITANCE_GREEN_MIN_WIDTH_RATIO);

  let historyBarY = -1;

  for (let y = searchStartY; y < height; y++) {
    let greenCount = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (isInheritanceGreenRgba(data[i]!, data[i + 1]!, data[i + 2]!)) {
        greenCount++;
      }
    }
    if (greenCount > minGreenPixels) {
      historyBarY = y;
      break;
    }
  }

  if (historyBarY !== -1 && historyBarY <= factorHeaderMaxY) {
    return { image, cropped: false };
  }

  if (historyBarY !== -1) {
    const out = new Uint8Array(width * historyBarY * 4);
    out.set(data.subarray(0, width * historyBarY * 4));
    return {
      image: { data: out, width, height: historyBarY },
      cropped: true,
    };
  }

  return { image, cropped: false };
}

/** OpenCV compose.ts と同系の HSV 緑判定 */
function isInheritanceGreenRgba(r: number, g: number, b: number): boolean {
  const [h, s, v] = rgbToHsvOpenCv(r, g, b);
  return h >= 35 && h <= 85 && s >= 100 && s <= 255 && v >= 100 && v <= 255;
}

/** OpenCV COLOR_RGB2HSV 互換（H: 0–180, S/V: 0–255） */
function rgbToHsvOpenCv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = 60 * (((gn - bn) / delta) % 6);
    } else if (max === gn) {
      h = 60 * ((bn - rn) / delta + 2);
    } else {
      h = 60 * ((rn - gn) / delta + 4);
    }
  }
  if (h < 0) h += 360;
  const hCv = (h / 2); // 0–180

  const s = max === 0 ? 0 : (delta / max) * 255;
  const v = max * 255;
  return [hCv, s, v];
}

function rowStdDevRgba(data: Uint8Array, width: number, startY: number, rowH: number): number {
  let sum = 0;
  let sumSq = 0;
  let n = 0;

  for (let y = startY; y < startY + rowH; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      sum += gray;
      sumSq += gray * gray;
      n++;
    }
  }

  if (n === 0) return 0;
  const mean = sum / n;
  return Math.sqrt(Math.max(sumSq / n - mean * mean, 0));
}
