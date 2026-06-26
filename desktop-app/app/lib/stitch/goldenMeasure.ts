import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cropRgba, findCropBoundsOrFallback } from "./cropCore";
import { detectLayoutAndTabRowRgba } from "./layoutCore";
import { detectScrollStartYFromRgba } from "./regionsCore";
import { detectStitchTabFromRgba } from "./tabDetectCore";
import type { RgbaImage } from "./rgba";
import type { StitchLayout } from "./constants";
import type { StitchTab } from "./types";

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

export interface GoldenLayoutMeasureResult {
  crop: { x: number; y: number; width: number; height: number };
  layout: StitchLayout;
  tabRowY: number;
  tabRowRatio: number;
  tab: StitchTab;
  tabRowMethod?: string;
}

/** 単一フレームから layout / tabRow / tab を計測（R2 ゲート） */
export async function measureLayoutFromFrame(
  packRoot: string,
  framePath: string
): Promise<GoldenLayoutMeasureResult> {
  const frameFull = await loadPngRgba(join(packRoot, framePath));
  const cropRect = findCropBoundsOrFallback(frameFull);
  const frame = cropRgba(frameFull, cropRect);

  const { layout, tabRow } = detectLayoutAndTabRowRgba(frame);
  const tab = detectStitchTabFromRgba(frame, layout, tabRow.tabY);

  return {
    crop: cropRect,
    layout,
    tabRowY: tabRow.tabY,
    tabRowRatio: tabRow.tabY / cropRect.height,
    tab,
    tabRowMethod: tabRow.method,
  };
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
