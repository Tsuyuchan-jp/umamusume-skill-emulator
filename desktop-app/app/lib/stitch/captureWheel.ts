import { cropRgba, findCropBoundsOrFallback } from "./cropCore";
import type { RgbaImage } from "./rgba";
import {
  deriveCaptureWheelFromCroppedFrame0,
  type CaptureWheelDecision,
} from "./wheelCore";

/** ブラウザ上で画像 URL を RGBA に読み込む（frame0 プレビュー用） */
export function loadImageUrlToRgba(url: string): Promise<RgbaImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas 2d が利用できません"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve({
        data: new Uint8Array(imageData.data),
        width: canvas.width,
        height: canvas.height,
      });
    };
    img.onerror = () => reject(new Error(`画像の読み込みに失敗しました: ${url}`));
    img.src = url;
  });
}

/** frame0 プレビュー URL から stitch 正本のホイール決定を導出 */
export async function deriveCaptureWheelFromFrameUrl(
  url: string
): Promise<CaptureWheelDecision> {
  const full = await loadImageUrlToRgba(url);
  const cropRect = findCropBoundsOrFallback(full);
  const cropped = cropRgba(full, cropRect);
  return deriveCaptureWheelFromCroppedFrame0(cropped);
}
