import {
  STITCH_SCROLLBAR_WIDTH_RATIO,
  STITCH_WHITESPACE_STD_THRESHOLD,
} from "./constants";
import type { RgbaImage } from "./rgba";

export interface ComposeInputRgba {
  frames: RgbaImage[];
  scrollStartY: number;
  footerHeight: number;
  overlaps: number[];
}

export interface ComposeResultRgba {
  image: RgbaImage;
  /** フッター直前のスクロール内容下端（出力座標） */
  scrollContentBottomY: number;
  trimmed: boolean;
}

/**
 * REQ 正本合成式（RGBA）:
 * StaticHeader + ScrollStrip(frame0) + Σ append + Footer
 */
export function composeStitchedRgba(input: ComposeInputRgba): ComposeResultRgba {
  const { frames, scrollStartY, footerHeight, overlaps } = input;
  if (frames.length === 0) {
    throw new Error("compose: フレームがありません");
  }

  const cropWidth = frames[0]!.width;
  const cropHeight = frames[0]!.height;
  const footerStartY = cropHeight - footerHeight;
  const scrollRegionH = footerStartY - scrollStartY;

  let totalScrollH = scrollRegionH;
  for (const scroll of overlaps) {
    totalScrollH += scroll;
  }

  const totalHeight = scrollStartY + totalScrollH + footerHeight;
  const data = new Uint8Array(cropWidth * totalHeight * 4);

  const frame0 = frames[0]!;
  copyRgbaRect(frame0, data, cropWidth, 0, 0, cropWidth, scrollStartY);
  copyRgbaRect(frame0, data, cropWidth, scrollStartY, scrollStartY, cropWidth, scrollRegionH);

  let scrollDrawY = scrollStartY + scrollRegionH;

  for (let i = 1; i < frames.length; i++) {
    const scroll = overlaps[i - 1] ?? 0;
    if (scroll > 0) {
      const srcY = footerStartY - scroll;
      copyRgbaRect(frames[i]!, data, cropWidth, scrollDrawY, srcY, cropWidth, scroll);
      scrollDrawY += scroll;
    }
  }

  const last = frames[frames.length - 1]!;
  copyRgbaRect(last, data, cropWidth, scrollDrawY, footerStartY, cropWidth, footerHeight);

  const scrollContentBottomY = scrollDrawY;
  hideScrollbarRgba(data, cropWidth, totalHeight, scrollStartY, scrollContentBottomY);

  const trimmed = trimBottomWhitespaceRgba(data, cropWidth, totalHeight, scrollContentBottomY);
  const outHeight = trimmed.height;

  return {
    image: { data: trimmed.data, width: cropWidth, height: outHeight },
    scrollContentBottomY,
    trimmed: trimmed.cropped,
  };
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

function copyRgbaRect(
  src: RgbaImage,
  dst: Uint8Array,
  dstWidth: number,
  dstY: number,
  srcY: number,
  w: number,
  h: number
): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((srcY + y) * src.width + x) * 4;
      const di = ((dstY + y) * dstWidth + x) * 4;
      dst[di] = src.data[si]!;
      dst[di + 1] = src.data[si + 1]!;
      dst[di + 2] = src.data[si + 2]!;
      dst[di + 3] = src.data[si + 3]!;
    }
  }
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
