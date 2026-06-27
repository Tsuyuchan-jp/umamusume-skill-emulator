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

  return {
    image: { data, width: cropWidth, height: totalHeight },
    scrollContentBottomY,
  };
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
