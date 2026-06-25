import { isTitleBarGreenHsv, rgbToHsv, type RgbaImage } from "./rgba";
import type { CropRect } from "./types";

/** 緑タイトルバーから UI 領域（CropRect）を検出 — opencvStitcher findCropBounds と同系 */
export function findCropBoundsFromRgba(img: RgbaImage): CropRect | null {
  const searchHeight = Math.floor(img.height * 0.3);
  let maxDetectedWidth = 0;
  let widestLeftX = -1;
  let widestRightX = -1;

  for (let y = 0; y < searchHeight; y++) {
    let firstX = -1;
    let lastX = -1;
    for (let x = 0; x < img.width; x++) {
      const [r, g, b] = rgbaAtSlice(img, x, y);
      const [h, s, v] = rgbToHsv(r, g, b);
      if (isTitleBarGreenHsv(h, s, v)) {
        if (firstX === -1) firstX = x;
        lastX = x;
      }
    }
    if (firstX !== -1) {
      const currentWidth = lastX - firstX + 1;
      if (currentWidth > maxDetectedWidth) {
        maxDetectedWidth = currentWidth;
        widestLeftX = firstX;
        widestRightX = lastX;
      }
    }
  }

  let headerY = -1;
  for (let y = 0; y < searchHeight; y++) {
    let firstX = -1;
    let lastX = -1;
    for (let x = 0; x < img.width; x++) {
      const [r, g, b] = rgbaAtSlice(img, x, y);
      const [h, s, v] = rgbToHsv(r, g, b);
      if (isTitleBarGreenHsv(h, s, v)) {
        if (firstX === -1) firstX = x;
        lastX = x;
      }
    }
    if (firstX !== -1) {
      const currentWidth = lastX - firstX + 1;
      if (currentWidth >= maxDetectedWidth * 0.95) {
        headerY = y;
        break;
      }
    }
  }

  if (headerY === -1 || maxDetectedWidth < 100) {
    return null;
  }

  const startY = headerY;
  const startX = widestLeftX;
  const uiWidth = widestRightX - widestLeftX + 1;
  let uiHeight = Math.floor(uiWidth / 0.5625);
  if (startY + uiHeight > img.height) {
    uiHeight = img.height - startY;
  }

  return { x: startX, y: startY, width: uiWidth, height: uiHeight };
}

/** findCropBounds フォールバック（緑ヘッダー未検出時） */
export function findCropBoundsFallback(img: RgbaImage): CropRect {
  const fallbackUiWidth = Math.floor(img.height * 0.5625);
  let fallbackX = Math.floor((img.width - fallbackUiWidth) / 2);
  if (fallbackX < 0) fallbackX = 0;
  return {
    x: fallbackX,
    y: 0,
    width: Math.min(fallbackUiWidth, img.width),
    height: img.height,
  };
}

export function findCropBoundsOrFallback(img: RgbaImage): CropRect {
  return findCropBoundsFromRgba(img) ?? findCropBoundsFallback(img);
}

/** CropRect で画像を切り出し */
export function cropRgba(img: RgbaImage, rect: CropRect): RgbaImage {
  const data = new Uint8Array(rect.width * rect.height * 4);
  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      const srcX = rect.x + x;
      const srcY = rect.y + y;
      const si = (y * rect.width + x) * 4;
      const di = (srcY * img.width + srcX) * 4;
      data[si] = img.data[di];
      data[si + 1] = img.data[di + 1];
      data[si + 2] = img.data[di + 2];
      data[si + 3] = img.data[di + 3];
    }
  }
  return { data, width: rect.width, height: rect.height };
}

function rgbaAtSlice(img: RgbaImage, x: number, y: number): [number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}
