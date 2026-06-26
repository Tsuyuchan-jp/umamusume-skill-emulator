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
export const STITCH_MATCH_SCORE_THRESHOLD = 0.85;
export const STITCH_SCROLLBAR_WIDTH_RATIO = 0.03;

/** absdiff 失敗時の広帯タブ緑走査（regions.ts 正本・layout 走査帯とは別用途） */
export const STITCH_GREEN_TAB_FALLBACK_SCAN_START = 0.28;
export const STITCH_GREEN_TAB_FALLBACK_SCAN_END = 0.54;
export const STITCH_TAB_ROW_Y_SCAN_STEP = 0.01;
export const STITCH_L2_GREEN_SCORE_MIN = 0.45;
export const STITCH_L3_GREEN_SEG_MIN = 0.15;

/** layout / tabDetect 走査帯（measure-regions.ps1 正本と同期） */
export const STITCH_TAB_SCAN_L3_START = 0.28;
export const STITCH_TAB_SCAN_L3_END = 0.48;
export const STITCH_TAB_SCAN_L2_START = 0.38;
export const STITCH_TAB_SCAN_L2_END = 0.54;
export const STITCH_TAB_SCAN_L3_BTN_START = 0.28;
export const STITCH_TAB_SCAN_L3_BTN_END = 0.52;

/** L3+Btn 補助閾値（partner 非表示 FRD skill 等） */
export const STITCH_L3_BTN_TAB_ROW_MIN_RATIO = 0.385;

/** 練習パートナー解除帯 */
export const STITCH_PARTNER_BTN_Y_START = 0.12;
export const STITCH_PARTNER_BTN_Y_END = 0.17;
export const STITCH_PARTNER_BTN_MIN_WIDTH_RATIO = 0.45;
export const STITCH_PARTNER_BTN_BRIGHTNESS = 210;
export const STITCH_PARTNER_BTN_MAX_ROW_RATIO = 0.045;

/** 最終フォールバック（レイアウト別固定比率） */
export const STITCH_HEADER_HEIGHT_L2 = 0.5;
export const STITCH_HEADER_HEIGHT_L3 = 0.16;
export const STITCH_HEADER_HEIGHT_L3_BTN = 0.24;

/** postProcess 余白トリム（R3 compose 正本） */
export const STITCH_WHITESPACE_STD_THRESHOLD = 20;

/** 継承タブ S-5: 緑履歴バー検出 */
export const STITCH_INHERITANCE_GREEN_SEARCH_START = 0.65;
export const STITCH_INHERITANCE_GREEN_MIN_WIDTH_RATIO = 0.8;
export const STITCH_INHERITANCE_FACTOR_HEADER_MAX_RATIO = 0.3;

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
