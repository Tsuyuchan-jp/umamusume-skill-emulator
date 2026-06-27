// @ts-nocheck

import { USE_STITCH_V2 } from "./stitch/flags";
import { stitchImages } from "./stitch/stitch";

export type { StitchLayout } from "./stitch/constants";
export type { StitchTab } from "./stitch/types";
export {
  detectStitchLayout,
  detectStitchLayoutAndTabRow,
} from "./stitch/layoutOpenCv";
export { detectStitchTab } from "./stitch/tabDetect";
export type { LayoutDetection } from "./stitch/types";

export async function stitchWithOpenCV(imageUrls: string[]): Promise<{ cleanDataUrl: string }> {
  return stitchWithOpenCVInternal(imageUrls, { useScrollStartV2: USE_STITCH_V2 });
}

export async function stitchWithOpenCVInternal(
  imageUrls: string[],
  _options: { useScrollStartV2?: boolean } = {}
): Promise<{ cleanDataUrl: string }> {
  return stitchImages(imageUrls);
}
