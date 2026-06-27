// @ts-nocheck

import { findCropBounds } from "./crop";
import { STITCH_FOOTER_HEIGHT_RATIO, STITCH_HEADER_TAB_BOTTOM_MARGIN_RATIO, STITCH_TAB_ROW_HEIGHT_RATIO, getLayoutHeaderRatio } from "./constants";
import { detectStitchLayoutAndTabRow } from "./layoutOpenCv";
import { detectStitchTab } from "./tabDetect";
import { detectPartnerBandRgba } from "./partnerDetectCore";
import { matToRgba } from "./opencvRgba";
import { detectScrollStartY } from "./regions";
import { matchScrollFrames } from "./scrollMatch";
import { composeStitchedImage } from "./compose";
import { applyPostProcess } from "./postProcess";
import type { ScrollStartResult } from "./types";

export async function stitchImages(
  imageUrls: string[]
): Promise<{ cleanDataUrl: string }> {
  let retries = 15;
  while (!window.cv && retries > 0) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    retries--;
  }

  if (!window.cv) {
    throw new Error(
      "OpenCV.js is not loaded yet. アプリを再起動するか、少し待ってから再度お試しください。"
    );
  }
  const cv = window.cv;

  const mats = await Promise.all(imageUrls.map((url) => loadMat(url, cv)));
  if (mats.length === 0) throw new Error("No images to stitch.");

  const cropRect = findCropBounds(mats[0], cv);
  console.log("Detected UI Bounds:", cropRect);

  if (cropRect.width === 0 || cropRect.height === 0) {
    throw new Error("UI領域を検出できませんでした。");
  }

  const cropWidth = cropRect.width;
  const cropHeight = cropRect.height;
  const croppedMats = mats.map((mat) => mat.roi(cropRect));

  const rgba0 = matToRgba(croppedMats[0], cv, cropWidth, cropHeight);
  const partner = detectPartnerBandRgba(rgba0);

  const { layout, tabRow } = detectStitchLayoutAndTabRow(
    croppedMats[0],
    cv,
    cropWidth,
    cropHeight
  );
  let tab = detectStitchTab(
    croppedMats[0],
    cv,
    cropWidth,
    cropHeight,
    layout,
    tabRow.tabY,
    tabRow.tabCount,
    partner
  );

  if (tabRow.method === "fallback") {
    console.warn(
      "StitchLayout: タブ行を緑プロファイルで特定できず L2 フォールバック（tabY≈46%）を使用します。"
    );
  }

  if (tab === "TrainingInfo") {
    console.warn(
      "育成情報タブは Phase 1 未対応です。スキル結合パスで処理します（Phase 1b / S-6）。"
    );
    // 強い右端セグ優勢のみ到達（継承・スキル誤検出は detectStitchTabFromRgba で救済済み）
    tab = "Skill";
  }

  const regions = resolveScrollStartY(
    croppedMats,
    cv,
    cropWidth,
    cropHeight,
    layout,
    tabRow
  );
  const scrollStartY = regions.scrollStartY;
  const footerHeight = Math.floor(cropHeight * STITCH_FOOTER_HEIGHT_RATIO);
  const footerStartY = cropHeight - footerHeight;
  const scrollRegionH = footerStartY - scrollStartY;

  const tabRowRatio = (tabRow.tabY / cropHeight).toFixed(3);
  console.log(
    `StitchLayout=${layout}, StitchTab=${tab}, tabDetect=${tabRow.method ?? "n/a"}, tabY=${tabRow.tabY}(${tabRowRatio}), scrollStartY=${scrollStartY}px(${regions.ratio.toFixed(3)}), method=${regions.method}, scrollRegion=${scrollRegionH}px, Footer=${footerHeight}px`
  );

  const { overlaps, frames: matchFrames, representative } = matchScrollFrames(
    croppedMats,
    cv,
    cropWidth,
    scrollStartY,
    scrollRegionH
  );

  console.log(`shiftEstimate: S*=${representative}`);

  for (const fm of matchFrames) {
    if (fm.method === "bound") {
      console.warn(
        `スコアが低すぎます(${fm.score.toFixed(3)}) かつ スクロール後退。バウンドと判断し、Frame ${fm.index + 1} 以降を破棄します。`
      );
    } else if (fm.method === "skip") {
      if (fm.rawScrollAmount !== undefined && fm.rawScrollAmount > 0) {
        console.warn(
          `Frame ${fm.index} -> ${fm.index + 1}: terminal micro skip（coarse=${fm.rawScrollAmount}px）`
        );
      } else {
        console.warn(`スクロール量が0以下です。Frame ${fm.index + 1} はスキップします。`);
      }
    } else if (
      fm.rawScrollAmount !== undefined &&
      fm.rawScrollAmount !== fm.scrollAmount
    ) {
      console.warn(
        `Frame ${fm.index} -> ${fm.index + 1}: shift raw=${fm.rawScrollAmount}→final=${fm.scrollAmount} method=${fm.method} score=${fm.score.toFixed(3)}`
      );
    } else {
      console.log(
        `Frame ${fm.index} -> ${fm.index + 1}: score=${fm.score.toFixed(3)}, scrollAmount=${fm.scrollAmount}, method=${fm.method}`
      );
    }
  }

  const boundIdx = matchFrames.find((f) => f.method === "bound")?.index;
  const frameCount =
    boundIdx !== undefined ? boundIdx + 1 : Math.max(1, overlaps.length + 1);
  const framesForCompose = croppedMats.slice(0, frameCount);
  const overlapsForCompose = overlaps.slice(0, frameCount - 1);

  const composed = composeStitchedImage({
    croppedMats: framesForCompose,
    scrollStartY,
    cropWidth,
    cropHeight,
    overlaps: overlapsForCompose,
    cv,
  });

  const processed = applyPostProcess(tab, {
    finalMat: composed.finalMat,
    cv,
    cropWidth,
    scrollStartY,
    scrollContentBottomY: composed.scrollContentBottomY,
    scrollRegionH,
  });

  const outputMat = processed.outputMat;
  const cropped = processed.cropped;

  const canvas = document.createElement("canvas");
  canvas.width = outputMat.cols;
  canvas.height = outputMat.rows;
  cv.imshow(canvas, outputMat);
  const cleanDataUrl = canvas.toDataURL("image/png");

  if (cropped && outputMat !== composed.finalMat) {
    outputMat.delete();
  }
  composed.finalMat.delete();
  mats.forEach((m) => m.delete());
  croppedMats.forEach((m) => m.delete());

  return { cleanDataUrl };
}

function resolveScrollStartY(
  croppedMats: any[],
  cv: any,
  cropWidth: number,
  cropHeight: number,
  layout: import("./constants").StitchLayout,
  tabRow: import("./types").TabRowInfo
): ScrollStartResult {
  if (croppedMats.length >= 2) {
    const result = detectScrollStartY(
      croppedMats[0],
      croppedMats[1],
      cv,
      cropWidth,
      cropHeight,
      layout,
      tabRow
    );
    console.log(
      `scrollStartY: y=${result.scrollStartY}px ratio=${result.ratio.toFixed(3)} method=${result.method} confidence=${result.confidence}`
    );
    return result;
  }

  console.warn("scrollStartY: 単一フレームのためレイアウト比率フォールバック");
  const ratio = getLayoutHeaderRatio(layout);
  let scrollStartY = Math.floor(cropHeight * ratio);
  if (tabRow.found) {
    const tabH = Math.max(4, Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO));
    const marginPx = Math.max(1, Math.floor(cropHeight * STITCH_HEADER_TAB_BOTTOM_MARGIN_RATIO));
    const inv1MinY = tabRow.tabY + tabH + marginPx;
    scrollStartY = Math.max(inv1MinY, scrollStartY);
  }
  return {
    scrollStartY,
    ratio: scrollStartY / cropHeight,
    method: "layout-ratio",
    confidence: "low",
  };
}

function loadMat(url: string, cv: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const mat = cv.imread(img);
      resolve(mat);
    };
    img.onerror = reject;
    img.src = url;
  });
}
