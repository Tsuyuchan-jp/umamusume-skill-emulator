import {
  STITCH_CAPTURE_WHEEL_FALLBACK,
  STITCH_FOOTER_HEIGHT_RATIO,
  STITCH_SCROLL_REGION_NARROW_THRESHOLD,
} from "./constants";
import { detectScrollStartYFromFrame0Rgba } from "./regionsCore";
import type { RgbaImage } from "./rgba";

export type CaptureWheelReason =
  | "stitch_narrow_band"
  | "stitch_wide_band"
  | "stitch_fallback";

export type CaptureWheelValue = -3 | -4;

export interface CaptureWheelDecision {
  wheel: CaptureWheelValue;
  scrollRegionH: number | null;
  scrollStartY?: number;
  reason: CaptureWheelReason;
}

/** scrollStartY と crop 高さからスクロール帯の高さ（px）を算出 */
export function computeScrollRegionH(
  scrollStartY: number,
  cropHeight: number
): number {
  const footerHeight = Math.floor(cropHeight * STITCH_FOOTER_HEIGHT_RATIO);
  const footerStartY = cropHeight - footerHeight;
  return footerStartY - scrollStartY;
}

/** INV-3: scrollRegionH からホイール段（-3 狭帯 / -4 広帯）を導出 */
export function deriveWheelFromScrollRegionH(
  scrollRegionH: number
): Pick<CaptureWheelDecision, "wheel" | "reason"> {
  if (scrollRegionH < STITCH_SCROLL_REGION_NARROW_THRESHOLD) {
    return { wheel: -3, reason: "stitch_narrow_band" };
  }
  return { wheel: -4, reason: "stitch_wide_band" };
}

/** crop 済み frame0 から capture 用ホイール決定（緑タブ走査 → scrollRegionH → wheel） */
export function deriveCaptureWheelFromCroppedFrame0(
  frame0: RgbaImage
): CaptureWheelDecision {
  const cropHeight = frame0.height;
  const scrollStart = detectScrollStartYFromFrame0Rgba(frame0);

  if (!scrollStart) {
    return {
      wheel: STITCH_CAPTURE_WHEEL_FALLBACK,
      scrollRegionH: null,
      reason: "stitch_fallback",
    };
  }

  const scrollRegionH = computeScrollRegionH(
    scrollStart.scrollStartY,
    cropHeight
  );
  const { wheel, reason } = deriveWheelFromScrollRegionH(scrollRegionH);

  return {
    wheel,
    scrollRegionH,
    scrollStartY: scrollStart.scrollStartY,
    reason,
  };
}
