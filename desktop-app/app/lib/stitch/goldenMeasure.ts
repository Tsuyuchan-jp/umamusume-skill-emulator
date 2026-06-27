import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STITCH_FOOTER_HEIGHT_RATIO } from "./constants";
import { cropRgba, findCropBoundsOrFallback } from "./cropCore";
import { composeStitchedRgba } from "./composeCore";
import { detectLayoutAndTabRowRgba } from "./layoutCore";
import { detectPartnerBandRgba } from "./partnerDetectCore";
import { detectScrollStartYFromRgba } from "./regionsCore";
import { estimateShiftFramesRgba } from "./shiftEstimateCore";
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
  const partner = detectPartnerBandRgba(frame);
  const tab = detectStitchTabFromRgba(frame, layout, tabRow.tabY, tabRow.tabCount, {
    partner,
  });

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

  const { tabRow } = detectLayoutAndTabRowRgba(frame0);
  const result = detectScrollStartYFromRgba(frame0, frame1, layout, tabRow);

  return {
    crop: cropRect,
    scrollStartY: result.scrollStartY,
    scrollStartRatio: result.ratio,
    method: result.method,
  };
}

export interface GoldenShiftMeasureResult {
  crop: { x: number; y: number; width: number; height: number };
  scrollStartY: number;
  scrollStartRatio: number;
  overlaps: number[];
  representative: number;
  frameCount: number;
}

/** 設計パック複数フレームから shiftEstimate を計測（R3.5a ゲート） */
export async function measureShiftFromFrames(
  packRoot: string,
  framePaths: string[],
  layout: StitchLayout
): Promise<GoldenShiftMeasureResult> {
  if (framePaths.length < 2) {
    throw new Error("shift 計測には frame0 と frame1 以上が必要です");
  }

  const frame0Full = await loadPngRgba(join(packRoot, framePaths[0]));
  const cropRect = findCropBoundsOrFallback(frame0Full);
  const frames: RgbaImage[] = [];

  for (const rel of framePaths) {
    const full = await loadPngRgba(join(packRoot, rel));
    frames.push(cropRgba(full, cropRect));
  }

  const { tabRow } = detectLayoutAndTabRowRgba(frames[0]!);
  const scroll = detectScrollStartYFromRgba(frames[0]!, frames[1]!, layout, tabRow);
  const footerHeight = Math.floor(cropRect.height * STITCH_FOOTER_HEIGHT_RATIO);
  const footerStartY = cropRect.height - footerHeight;
  const scrollRegionH = footerStartY - scroll.scrollStartY;

  const strips = frames.map((f) => ({
    data: extractStripRgba(f, scroll.scrollStartY, scrollRegionH),
    width: f.width,
    height: scrollRegionH,
  }));

  const { overlaps, representative } = estimateShiftFramesRgba(strips);

  return {
    crop: cropRect,
    scrollStartY: scroll.scrollStartY,
    scrollStartRatio: scroll.ratio,
    overlaps,
    representative,
    frameCount: frames.length,
  };
}

export interface GoldenComposeMeasureResult {
  crop: { x: number; y: number; width: number; height: number };
  scrollStartY: number;
  scrollStartRatio: number;
  outputHeight: number;
  overlapSum: number;
  frameCount: number;
}

/** 設計パック複数フレームから RGBA 結合スモーク計測（R3 compose ゲート） */
export async function measureComposeFromFrames(
  packRoot: string,
  framePaths: string[],
  layout: StitchLayout
): Promise<GoldenComposeMeasureResult> {
  if (framePaths.length < 2) {
    throw new Error("compose 計測には frame0 と frame1 以上が必要です");
  }

  const frame0Full = await loadPngRgba(join(packRoot, framePaths[0]));
  const cropRect = findCropBoundsOrFallback(frame0Full);
  const frames: RgbaImage[] = [];

  for (const rel of framePaths) {
    const full = await loadPngRgba(join(packRoot, rel));
    frames.push(cropRgba(full, cropRect));
  }

  const { tabRow } = detectLayoutAndTabRowRgba(frames[0]!);
  const scroll = detectScrollStartYFromRgba(frames[0]!, frames[1]!, layout, tabRow);
  const footerHeight = Math.floor(cropRect.height * STITCH_FOOTER_HEIGHT_RATIO);
  const footerStartY = cropRect.height - footerHeight;
  const scrollRegionH = footerStartY - scroll.scrollStartY;

  const strips = frames.map((f) => ({
    data: extractStripRgba(f, scroll.scrollStartY, scrollRegionH),
    width: f.width,
    height: scrollRegionH,
  }));

  const { overlaps } = estimateShiftFramesRgba(strips);
  const boundCount = overlaps.length + 1;
  const composeFrames = frames.slice(0, boundCount);

  const composed = composeStitchedRgba({
    frames: composeFrames,
    scrollStartY: scroll.scrollStartY,
    footerHeight,
    overlaps,
  });

  return {
    crop: cropRect,
    scrollStartY: scroll.scrollStartY,
    scrollStartRatio: scroll.ratio,
    outputHeight: composed.image.height,
    overlapSum: overlaps.reduce((a, b) => a + b, 0),
    frameCount: composeFrames.length,
  };
}

function extractStripRgba(frame: RgbaImage, startY: number, h: number): Uint8Array {
  const w = frame.width;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((startY + y) * w + x) * 4;
      const di = (y * w + x) * 4;
      out[di] = frame.data[si]!;
      out[di + 1] = frame.data[si + 1]!;
      out[di + 2] = frame.data[si + 2]!;
      out[di + 3] = frame.data[si + 3]!;
    }
  }
  return out;
}
