// @ts-nocheck

import { STITCH_FOOTER_HEIGHT_RATIO } from "./constants";

export interface ComposeInput {
  croppedMats: any[];
  scrollStartY: number;
  cropWidth: number;
  cropHeight: number;
  overlaps: number[];
  cv: any;
}

export interface ComposeResult {
  finalMat: any;
  scrollContentBottomY: number;
}

/**
 * REQ 正本合成式（OpenCV）:
 * StaticHeader + ScrollStrip(frame0) + Σ append + Footer
 */
export function composeStitchedImage(input: ComposeInput): ComposeResult {
  const { croppedMats, scrollStartY, cropWidth, cropHeight, overlaps, cv } = input;

  const footerHeight = Math.floor(cropHeight * STITCH_FOOTER_HEIGHT_RATIO);
  const footerStartY = cropHeight - footerHeight;
  const scrollRegionH = footerStartY - scrollStartY;

  let totalScrollH = scrollRegionH;
  for (const scroll of overlaps) {
    totalScrollH += scroll;
  }

  const totalHeight = scrollStartY + totalScrollH + footerHeight;
  const finalMat = new cv.Mat(totalHeight, cropWidth, cv.CV_8UC4, new cv.Scalar(0, 0, 0, 255));

  const frame0 = croppedMats[0];
  const headerRoi = finalMat.roi(new cv.Rect(0, 0, cropWidth, scrollStartY));
  frame0.roi(new cv.Rect(0, 0, cropWidth, scrollStartY)).copyTo(headerRoi);
  headerRoi.delete();

  const strip0 = frame0.roi(new cv.Rect(0, scrollStartY, cropWidth, scrollRegionH));
  const strip0Dst = finalMat.roi(new cv.Rect(0, scrollStartY, cropWidth, scrollRegionH));
  strip0.copyTo(strip0Dst);
  strip0.delete();
  strip0Dst.delete();

  let scrollDrawY = scrollStartY + scrollRegionH;

  for (let i = 1; i < croppedMats.length; i++) {
    const scroll = overlaps[i - 1] ?? 0;
    if (scroll > 0) {
      const curr = croppedMats[i];
      const srcY = footerStartY - scroll;
      const bottomPart = curr.roi(new cv.Rect(0, srcY, cropWidth, scroll));
      const dstRoi = finalMat.roi(new cv.Rect(0, scrollDrawY, cropWidth, scroll));
      bottomPart.copyTo(dstRoi);
      bottomPart.delete();
      dstRoi.delete();
      scrollDrawY += scroll;
    }
  }

  const last = croppedMats[croppedMats.length - 1];
  const footerSrc = last.roi(new cv.Rect(0, footerStartY, cropWidth, footerHeight));
  const footerDst = finalMat.roi(new cv.Rect(0, scrollDrawY, cropWidth, footerHeight));
  footerSrc.copyTo(footerDst);
  footerSrc.delete();
  footerDst.delete();

  const scrollContentBottomY = scrollDrawY;

  return { finalMat, scrollContentBottomY };
}
