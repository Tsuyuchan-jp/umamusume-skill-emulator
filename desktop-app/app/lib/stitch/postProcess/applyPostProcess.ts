import type { RgbaImage } from "../rgba";
import type { StitchTab } from "../types";
import {
  cropAtInheritanceHistoryBarRgba,
  hideScrollbarRgba,
  trimBottomWhitespaceRgba,
  type PostProcessInputRgba,
  type PostProcessResultRgba,
} from "./postProcessCore";
import {
  cropAtInheritanceHistoryBarOpenCv,
  hideScrollbarOpenCv,
  trimBottomWhitespaceOpenCv,
  type PostProcessInputOpenCv,
  type PostProcessResultOpenCv,
} from "./postProcessOpenCv";

/**
 * タブ別後処理（RGBA 正本）
 * - Skill / TrainingInfo: S-2 → trim
 * - Inheritance: S-2 → S-5（失敗時 trim フォールバック）
 */
export function applyPostProcessRgba(
  tab: StitchTab,
  input: PostProcessInputRgba
): PostProcessResultRgba {
  const { image, scrollStartY, scrollContentBottomY, scrollRegionH } = input;
  const data = new Uint8Array(image.data);
  const width = image.width;
  const height = image.height;

  hideScrollbarRgba(data, width, height, scrollStartY, scrollContentBottomY);

  let current: RgbaImage = { data, width, height };
  let cropped = false;

  if (tab === "Inheritance") {
    const inheritCrop = cropAtInheritanceHistoryBarRgba(
      current,
      scrollStartY,
      scrollRegionH
    );
    if (inheritCrop.cropped) {
      return { image: inheritCrop.image, cropped: true };
    }
    const trim = trimBottomWhitespaceRgba(
      current.data,
      width,
      current.height,
      scrollContentBottomY
    );
    if (trim.cropped) {
      current = { data: trim.data, width, height: trim.height };
      cropped = true;
    }
    return { image: current, cropped };
  }

  const trim = trimBottomWhitespaceRgba(
    current.data,
    width,
    height,
    scrollContentBottomY
  );
  if (trim.cropped) {
    current = { data: trim.data, width, height: trim.height };
    cropped = true;
  }
  return { image: current, cropped };
}

/**
 * タブ別後処理（OpenCV Mat・本番経路）
 */
export function applyPostProcess(
  tab: StitchTab,
  input: PostProcessInputOpenCv
): PostProcessResultOpenCv {
  const {
    finalMat,
    cv,
    cropWidth,
    scrollStartY,
    scrollContentBottomY,
    scrollRegionH,
  } = input;

  hideScrollbarOpenCv(
    finalMat,
    cv,
    cropWidth,
    scrollStartY,
    scrollContentBottomY
  );

  if (tab === "Inheritance") {
    const inheritCrop = cropAtInheritanceHistoryBarOpenCv(
      finalMat,
      cv,
      scrollStartY,
      scrollRegionH
    );
    if (inheritCrop.cropped) {
      return { outputMat: inheritCrop.outputMat, cropped: true };
    }
    const trim = trimBottomWhitespaceOpenCv(finalMat, cv, scrollContentBottomY);
    return {
      outputMat: trim.outputMat,
      cropped: trim.cropped,
    };
  }

  const trim = trimBottomWhitespaceOpenCv(finalMat, cv, scrollContentBottomY);
  return {
    outputMat: trim.outputMat,
    cropped: trim.cropped,
  };
}
