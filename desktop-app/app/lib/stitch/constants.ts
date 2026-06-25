/** 結合パイプライン共通定数（REQ-stitch-rewrite 正本） */

export const STITCH_FOOTER_HEIGHT_RATIO = 0.15;
export const STITCH_TAB_ROW_HEIGHT_RATIO = 0.035;
export const STITCH_HEADER_TAB_BOTTOM_MARGIN_RATIO = 0.012;

/** absdiff 静止/動的分界 */
export const STITCH_SCROLL_DIFF_AVG_THRESHOLD = 5;
export const STITCH_SCROLL_DIFF_CONSECUTIVE_ROWS = 10;
export const STITCH_SCROLL_DIFF_CHECK_WIDTH_RATIO = 0.8;

/** テンプレートマッチ（scrollAmount 推定） */
export const STITCH_TEMPLATE_HEIGHT_RATIO = 0.2;
export const STITCH_SEARCH_WIDTH_RATIO = 0.95;

/** absdiff 失敗時の広帯タブ緑走査 */
export const STITCH_GREEN_TAB_FALLBACK_SCAN_START = 0.28;
export const STITCH_GREEN_TAB_FALLBACK_SCAN_END = 0.54;
export const STITCH_TAB_ROW_Y_SCAN_STEP = 0.01;
export const STITCH_L2_GREEN_SCORE_MIN = 0.45;
export const STITCH_L3_GREEN_SEG_MIN = 0.15;

/** 最終フォールバック（レイアウト別固定比率） */
export const STITCH_HEADER_HEIGHT_L2 = 0.5;
export const STITCH_HEADER_HEIGHT_L3 = 0.16;
export const STITCH_HEADER_HEIGHT_L3_BTN = 0.24;

export type StitchLayout = "L2" | "L3" | "L3+Btn";

export function getLayoutHeaderRatio(layout: StitchLayout): number {
  switch (layout) {
    case "L2":
      return STITCH_HEADER_HEIGHT_L2;
    case "L3+Btn":
      return STITCH_HEADER_HEIGHT_L3_BTN;
    case "L3":
    default:
      return STITCH_HEADER_HEIGHT_L3;
  }
}
