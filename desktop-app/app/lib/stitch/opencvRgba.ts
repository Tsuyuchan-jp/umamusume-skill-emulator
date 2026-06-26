import type { RgbaImage } from "./rgba";

/** OpenCV Mat（crop 済み）を RGBA バッファへコピー */
export function matToRgba(
  croppedMat: any,
  _cv: any,
  cropWidth: number,
  cropHeight: number
): RgbaImage {
  const data = new Uint8Array(cropWidth * cropHeight * 4);
  for (let y = 0; y < cropHeight; y++) {
    for (let x = 0; x < cropWidth; x++) {
      const ptr = croppedMat.ucharPtr(y, x);
      const i = (y * cropWidth + x) * 4;
      data[i] = ptr[0];
      data[i + 1] = ptr[1];
      data[i + 2] = ptr[2];
      data[i + 3] = ptr[3] ?? 255;
    }
  }
  return { data, width: cropWidth, height: cropHeight };
}
