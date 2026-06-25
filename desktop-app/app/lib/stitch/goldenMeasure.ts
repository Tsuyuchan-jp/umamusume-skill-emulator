import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cropRgba, findCropBoundsOrFallback } from "./cropCore";
import { detectScrollStartYFromRgba } from "./regionsCore";
import type { RgbaImage } from "./rgba";
import type { StitchLayout } from "./constants";

/** PNG を RGBA にデコード（Node golden 計測用・sharp 依存） */
export async function loadPngRgba(filePath: string): Promise<RgbaImage> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(readFileSync(filePath))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
  };
}

export interface GoldenMeasureResult {
  crop: { x: number; y: number; width: number; height: number };
  scrollStartY: number;
  scrollStartRatio: number;
  method: string;
}

/** 設計パック 2 フレームから scrollStartRatio を計測（R1 ゲート） */
export async function measureScrollStartFromFrames(
  packRoot: string,
  framePaths: string[],
  layout: StitchLayout
): Promise<GoldenMeasureResult> {
  if (framePaths.length < 2) {
    throw new Error("absdiff 計測には frame0 と frame1 が必要です");
  }

  const frame0Full = await loadPngRgba(join(packRoot, framePaths[0]));
  const cropRect = findCropBoundsOrFallback(frame0Full);
  const frame0 = cropRgba(frame0Full, cropRect);

  const frame1Full = await loadPngRgba(join(packRoot, framePaths[1]));
  const frame1 = cropRgba(frame1Full, cropRect);

  const result = detectScrollStartYFromRgba(frame0, frame1, layout);

  return {
    crop: cropRect,
    scrollStartY: result.scrollStartY,
    scrollStartRatio: result.ratio,
    method: result.method,
  };
}
