// @ts-nocheck

import {
  STITCH_INHERITANCE_FACTOR_HEADER_MAX_RATIO,
  STITCH_INHERITANCE_GREEN_MIN_WIDTH_RATIO,
  STITCH_INHERITANCE_GREEN_SEARCH_START,
  STITCH_SCROLLBAR_WIDTH_RATIO,
  STITCH_WHITESPACE_STD_THRESHOLD,
} from "../constants";

export interface PostProcessInputOpenCv {
  finalMat: any;
  cv: any;
  cropWidth: number;
  scrollStartY: number;
  scrollContentBottomY: number;
  scrollRegionH: number;
}

export interface PostProcessResultOpenCv {
  outputMat: any;
  cropped: boolean;
}

/** S-2: scrollStartY 基準・右端 3% */
export function hideScrollbarOpenCv(
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

export function trimBottomWhitespaceOpenCv(
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

/** S-5: 継承タブ — 緑の継承履歴バー手前でクロップ */
export function cropAtInheritanceHistoryBarOpenCv(
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
