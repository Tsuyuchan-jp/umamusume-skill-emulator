/**
 * 結合オーケストレータ（R1 骨格）
 * compose / postProcess は opencvStitcher 旧経路へ委譲。scrollStartY のみ v2 正本。
 */
import { stitchWithOpenCVInternal } from "../opencvStitcher";

export async function stitchImages(
  imageUrls: string[]
): Promise<{ cleanDataUrl: string }> {
  return stitchWithOpenCVInternal(imageUrls, { useScrollStartV2: true });
}
