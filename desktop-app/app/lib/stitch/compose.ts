// @ts-nocheck

import {
  STITCH_FOOTER_HEIGHT_RATIO,
  STITCH_INHERITANCE_FACTOR_HEADER_MAX_RATIO,
  STITCH_INHERITANCE_GREEN_MIN_WIDTH_RATIO,
  STITCH_INHERITANCE_GREEN_SEARCH_START,
  STITCH_SCROLLBAR_WIDTH_RATIO,
  STITCH_WHITESPACE_STD_THRESHOLD,
} from "./constants";

export interface ComposeInput {
  croppedMats: any[];
  scrollStartY: number;
  cropWidth: number;
  cropHeight: number;
  overlaps: number[];
  cv: any;
  /** true のとき余白トリムをスキップ（継承 S-5 後など） */
  skipTrim?: boolean;
}

export interface ComposeResult {
  finalMat: any;
  scrollContentBottomY: number;
  trimmed: boolean;
}

/**
 * REQ 正本合成式（OpenCV）:
 * StaticHeader + ScrollStrip(frame0) + Σ append + Footer + S-2 バー隠し
 */
export function composeStitchedImage(input: ComposeInput): ComposeResult {
  const {
    croppedMats,
    scrollStartY,
    cropWidth,
    cropHeight,
    overlaps,
    cv,
    skipTrim = false,
  } = input;

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
  hideScrollbar(finalMat, cv, cropWidth, scrollStartY, scrollContentBottomY);

  let outputMat = finalMat;
  let trimmed = false;

  if (!skipTrim) {
    const trim = trimBottomWhitespace(finalMat, cv, scrollContentBottomY);
    if (trim.cropped) {
      outputMat = trim.outputMat;
      trimmed = true;
    }
  }

  return { finalMat: outputMat, scrollContentBottomY, trimmed };
}

/** S-2: scrollStartY 基準・右端 3% */
function hideScrollbar(
  finalMat: any,
  cv: any,
  cropWidth: number,
  scrollbarStartY: number,
  scrollContentBottomY: number
): void {
  const sbWidth = Math.ceil(cropWidth * STITCH_SCROLLBAR_WIDTH_RATIO);
  const safeX = finalMat.cols - sbWidth - 1;
  const scrollRegionH = scrollContentBottomY - scrollbarStartY;

  if (sbWidth <= 0 || safeX <= 0 || scrollRegionH <= 0) return;

  const srcCol = finalMat.roi(new cv.Rect(safeX, scrollbarStartY, 1, scrollRegionH));
  const dstRegion = finalMat.roi(
    new cv.Rect(safeX + 1, scrollbarStartY, sbWidth, scrollRegionH)
  );
  cv.repeat(srcCol, 1, sbWidth, dstRegion);
  srcCol.delete();
  dstRegion.delete();
}

function trimBottomWhitespace(
  finalMat: any,
  cv: any,
  scrollDrawY: number
): { outputMat: any; cropped: boolean } {
  let contentBottomY = scrollDrawY;

  for (let y = scrollDrawY - 10; y >= 0; y -= 10) {
    const rowMat = finalMat.roi(new cv.Rect(0, y, finalMat.cols, 10));
    const mean = new cv.Mat();
    const stddev = new cv.Mat();
    cv.meanStdDev(rowMat, mean, stddev);
    const std =
      (stddev.doubleAt(0, 0) + stddev.doubleAt(1, 0) + stddev.doubleAt(2, 0)) / 3;
    rowMat.delete();
    mean.delete();
    stddev.delete();

    if (std > STITCH_WHITESPACE_STD_THRESHOLD) {
      contentBottomY = Math.min(y + 20, finalMat.rows);
      break;
    }
  }

  console.log(
    "余白を自動スキップし、Y=",
    contentBottomY,
    "でクロップします（元のY=",
    scrollDrawY,
    "）"
  );

  if (contentBottomY >= finalMat.rows) {
    return { outputMat: finalMat, cropped: false };
  }

  return {
    outputMat: finalMat.roi(new cv.Rect(0, 0, finalMat.cols, contentBottomY)),
    cropped: true,
  };
}

/** 継承 S-5 未適用時の余白トリム（OpenCV） */
export function trimBottomWhitespaceMat(
  finalMat: any,
  cv: any,
  scrollDrawY: number
): { outputMat: any; cropped: boolean } {
  return trimBottomWhitespace(finalMat, cv, scrollDrawY);
}

/** S-5: 継承タブ — 緑の継承履歴バー手前でクロップ */
export function cropAtInheritanceHistoryBar(
  finalMat: any,
  cv: any,
  scrollStartY: number,
  scrollRegionH: number
): { outputMat: any; cropped: boolean } {
  const searchStartY = Math.floor(
    scrollStartY + scrollRegionH * STITCH_INHERITANCE_GREEN_SEARCH_START
  );
  const factorHeaderMaxY = Math.floor(
    scrollStartY + scrollRegionH * STITCH_INHERITANCE_FACTOR_HEADER_MAX_RATIO
  );

  const hsv = new cv.Mat();
  cv.cvtColor(finalMat, hsv, cv.COLOR_RGBA2RGB);
  cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

  const lowGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [35, 100, 100, 0]);
  const highGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [85, 255, 255, 0]);
  const mask = new cv.Mat();
  cv.inRange(hsv, lowGreen, highGreen, mask);

  const minGreenPixels = Math.floor(finalMat.cols * STITCH_INHERITANCE_GREEN_MIN_WIDTH_RATIO);
  let historyBarY = -1;

  for (let y = searchStartY; y < finalMat.rows; y++) {
    let greenCount = 0;
    const rowPtr = mask.ucharPtr(y);
    for (let x = 0; x < mask.cols; x++) {
      if (rowPtr[x] > 0) greenCount++;
    }
    if (greenCount > minGreenPixels) {
      historyBarY = y;
      break;
    }
  }

  hsv.delete();
  lowGreen.delete();
  highGreen.delete();
  mask.delete();

  if (historyBarY !== -1 && historyBarY <= factorHeaderMaxY) {
    console.log(
      "検出された緑ラインは「因子」ヘッダーと判定されたため、クロップをスキップします。Y=",
      historyBarY
    );
    return { outputMat: finalMat, cropped: false };
  }

  if (historyBarY !== -1) {
    console.log("継承履歴の緑ラインを検出しました。Y=", historyBarY);
    return {
      outputMat: finalMat.roi(new cv.Rect(0, 0, finalMat.cols, historyBarY)),
      cropped: true,
    };
  }

  return { outputMat: finalMat, cropped: false };
}
