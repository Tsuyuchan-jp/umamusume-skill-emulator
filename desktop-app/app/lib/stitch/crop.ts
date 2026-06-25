// @ts-nocheck

/** OpenCV Mat から CropRect を検出（opencvStitcher findCropBounds 抽出） */
export function findCropBounds(mat: any, cv: any): any {
  const hsv = new cv.Mat();
  cv.cvtColor(mat, hsv, cv.COLOR_RGBA2RGB);
  cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

  const lowGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [20, 150, 0, 0]);
  const highGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [60, 255, 255, 0]);

  const mask = new cv.Mat();
  cv.inRange(hsv, lowGreen, highGreen, mask);

  const searchHeight = Math.floor(mat.rows * 0.3);
  let maxDetectedWidth = 0;
  let widestLeftX = -1;
  let widestRightX = -1;

  for (let y = 0; y < searchHeight; y++) {
    let firstX = -1;
    let lastX = -1;
    const rowPtr = mask.ucharPtr(y);
    for (let x = 0; x < mask.cols; x++) {
      if (rowPtr[x] > 0) {
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
    const rowPtr = mask.ucharPtr(y);
    for (let x = 0; x < mask.cols; x++) {
      if (rowPtr[x] > 0) {
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

  hsv.delete();
  lowGreen.delete();
  highGreen.delete();
  mask.delete();

  if (headerY !== -1) {
    const startY = headerY;
    const startX = widestLeftX;
    const uiWidth = widestRightX - widestLeftX + 1;
    let uiHeight = Math.floor(uiWidth / 0.5625);

    if (startY + uiHeight > mat.rows) {
      uiHeight = mat.rows - startY;
    }

    return new cv.Rect(startX, startY, uiWidth, uiHeight);
  }

  console.warn("緑のヘッダーが見つかりませんでした。フォールバック処理を行います。");
  const fallbackUiWidth = Math.floor(mat.rows * 0.5625);
  let fallbackX = Math.floor((mat.cols - fallbackUiWidth) / 2);
  if (fallbackX < 0) fallbackX = 0;
  return new cv.Rect(fallbackX, 0, Math.min(fallbackUiWidth, mat.cols), mat.rows);
}

export { findCropBoundsFromRgba, findCropBoundsOrFallback, cropRgba } from "./cropCore";
