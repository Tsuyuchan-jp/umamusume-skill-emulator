// @ts-nocheck

// --- 結合定数（Phase 1 正本） ---
// L2 比率は設計パック TRN 計測（tools/measure-stitch-layout.ps1）: タブ下端≈50.3%。旧 D1 の 22% は誤推定。
const STITCH_FOOTER_HEIGHT_RATIO = 0.15;
const STITCH_HEADER_HEIGHT_L2 = 0.5; // フォールバックのみ（検出成功時はタブ行から動的算出）
const STITCH_HEADER_HEIGHT_L3 = 0.16;
const STITCH_HEADER_HEIGHT_L3_BTN = 0.24; // 練習パートナー解除帯＋下段タブ（FRD 系）
const STITCH_HEADER_TAB_BOTTOM_MARGIN_RATIO = 0.012; // タブ下端〜スクロール開始の余白
const STITCH_MATCH_SCORE_THRESHOLD = 0.85;
const STITCH_SEARCH_WIDTH_RATIO = 0.95;
const STITCH_SCROLLBAR_WIDTH_RATIO = 0.03;
const STITCH_TEMPLATE_HEIGHT_RATIO = 0.2;
const STITCH_TAB_ROW_HEIGHT_RATIO = 0.035;
// L3 タブ行: 上段（HOF/CMP 計測・ログ Header 144/900=16% 整合）
const STITCH_TAB_ROW_L3_SCAN_START = 0.08;
const STITCH_TAB_ROW_L3_SCAN_END = 0.16;
const STITCH_L3_GREEN_SEG_MIN = 0.15;
// L2 タブ行: 下段（TRN 計測 ratio≈0.47, L2score≈0.83）
const STITCH_TAB_ROW_L2_SCAN_START = 0.38;
const STITCH_TAB_ROW_L2_SCAN_END = 0.54;
const STITCH_L2_GREEN_SCORE_MIN = 0.45;
const STITCH_TAB_ROW_L3_BTN_TAB_SCAN_START = 0.17;
const STITCH_TAB_ROW_L3_BTN_TAB_SCAN_END = 0.26;
const STITCH_TAB_ROW_Y_SCAN_STEP = 0.01;
const STITCH_PARTNER_BTN_Y_START = 0.12;
const STITCH_PARTNER_BTN_Y_END = 0.17;
const STITCH_PARTNER_BTN_MIN_WIDTH_RATIO = 0.45;
const STITCH_PARTNER_BTN_BRIGHTNESS = 210;
const STITCH_PARTNER_BTN_MAX_ROW_RATIO = 0.045;
const STITCH_SCROLL_DIFF_AVG_THRESHOLD = 5;
const STITCH_SCROLL_DIFF_CONSECUTIVE_ROWS = 10;
const STITCH_SCROLL_DIFF_CHECK_WIDTH_RATIO = 0.8;
const STITCH_INHERITANCE_GREEN_SEARCH_START = 0.65;
const STITCH_INHERITANCE_GREEN_MIN_WIDTH_RATIO = 0.8;
const STITCH_INHERITANCE_FACTOR_HEADER_MAX_RATIO = 0.3;
const STITCH_WHITESPACE_STD_THRESHOLD = 20;

export type StitchLayout = "L2" | "L3" | "L3+Btn";
export type StitchTab = "Skill" | "Inheritance" | "TrainingInfo";

function getHeaderHeightRatio(layout: StitchLayout): number {
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

type TabRowInfo = {
  tabCount: number;
  tabY: number;
  found: boolean;
  method?: "green-l2" | "green-l3" | "fallback";
};

/** 1行分の緑タブプロファイル（HSV・opencv detectStitchTab と同系） */
function measureGreenTabProfile(
  croppedMat: any,
  cv: any,
  cropWidth: number,
  tabY: number,
  cropHeight: number
): { l2Score: number; seg1: number; seg2: number; seg3: number; maxSeg: number } {
  const tabH = Math.max(4, Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO));
  const roi = croppedMat.roi(new cv.Rect(0, tabY, cropWidth, tabH));
  const hsv = new cv.Mat();
  cv.cvtColor(roi, hsv, cv.COLOR_RGBA2RGB);
  cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

  const seg2X = Math.floor(cropWidth / 2);
  const seg3W = Math.floor(cropWidth / 3);
  let leftG = 0;
  let rightG = 0;
  let leftT = 0;
  let rightT = 0;
  const segG = [0, 0, 0];
  const segT = [0, 0, 0];

  const isTabGreen = (ptr: Uint8Array) => {
    const h = ptr[0];
    const s = ptr[1];
    const v = ptr[2];
    return h >= 35 && h <= 85 && s >= 80 && v >= 80;
  };

  for (let y = 0; y < hsv.rows; y++) {
    for (let x = 0; x < hsv.cols; x++) {
      const ptr = hsv.ucharPtr(y, x);
      const g = isTabGreen(ptr);
      if (x < Math.floor(cropWidth * 0.48)) {
        leftT++;
        if (g) leftG++;
      } else if (x >= Math.floor(cropWidth * 0.52)) {
        rightT++;
        if (g) rightG++;
      }
      const si = x < seg3W ? 0 : x < seg3W * 2 ? 1 : 2;
      segT[si]++;
      if (g) segG[si]++;
    }
  }

  hsv.delete();
  roi.delete();

  const seg1 = segT[0] > 0 ? segG[0] / segT[0] : 0;
  const seg2 = segT[1] > 0 ? segG[1] / segT[1] : 0;
  const seg3 = segT[2] > 0 ? segG[2] / segT[2] : 0;
  const l2Score =
    (rightT > 0 ? rightG / rightT : 0) - (leftT > 0 ? leftG / leftT : 0);

  return { l2Score, seg1, seg2, seg3, maxSeg: Math.max(seg1, seg2, seg3) };
}

/** 緑プロファイルでタブ行を走査 */
function scanGreenTabRow(
  croppedMat: any,
  cv: any,
  cropWidth: number,
  cropHeight: number,
  startRatio: number,
  endRatio: number,
  mode: "l2" | "l3"
): TabRowInfo {
  let best: TabRowInfo = {
    tabCount: mode === "l2" ? 2 : 3,
    tabY: Math.floor(cropHeight * ((startRatio + endRatio) / 2)),
    found: false,
    method: mode === "l2" ? "green-l2" : "green-l3",
  };
  let bestScore = -1;

  for (let ratio = startRatio; ratio <= endRatio; ratio += STITCH_TAB_ROW_Y_SCAN_STEP) {
    const tabY = Math.floor(cropHeight * ratio);
    if (tabY + Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO) >= cropHeight) continue;

    const p = measureGreenTabProfile(croppedMat, cv, cropWidth, tabY, cropHeight);

    if (mode === "l2") {
      if (p.l2Score < STITCH_L2_GREEN_SCORE_MIN) continue;
      if (p.l2Score > bestScore) {
        bestScore = p.l2Score;
        best = { tabCount: 2, tabY, found: true, method: "green-l2" };
      }
    } else {
      if (p.maxSeg < STITCH_L3_GREEN_SEG_MIN) continue;
      if (p.maxSeg > bestScore) {
        bestScore = p.maxSeg;
        best = { tabCount: 3, tabY, found: true, method: "green-l3" };
      }
    }
  }

  return best;
}

/** タブ行下端からヘッダー高さを算出（検出成功時は固定比率より優先） */
function computeHeaderHeight(
  layout: StitchLayout,
  cropHeight: number,
  tabRow: TabRowInfo
): number {
  const tabH = Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO);
  const margin = Math.max(
    1,
    Math.floor(cropHeight * STITCH_HEADER_TAB_BOTTOM_MARGIN_RATIO)
  );

  if (tabRow.found) {
    return tabRow.tabY + tabH + margin;
  }

  return Math.floor(cropHeight * getHeaderHeightRatio(layout));
}

/** 「練習パートナー解除」帯（明るい横長ボタン・縦幅が狭い）の有無 */
function detectPartnerReleaseBand(mat: any, cv: any, cropWidth: number, cropHeight: number): boolean {
  const yStart = Math.floor(cropHeight * STITCH_PARTNER_BTN_Y_START);
  const yEnd = Math.floor(cropHeight * STITCH_PARTNER_BTN_Y_END);
  const roiH = Math.max(1, yEnd - yStart);
  const roi = mat.roi(new cv.Rect(0, yStart, cropWidth, roiH));
  const gray = new cv.Mat();
  cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);

  const minBrightPixels = Math.floor(cropWidth * STITCH_PARTNER_BTN_MIN_WIDTH_RATIO);
  const maxButtonRows = Math.max(2, Math.floor(cropHeight * STITCH_PARTNER_BTN_MAX_ROW_RATIO));

  let runStart = -1;
  let bestRun = 0;

  for (let y = 0; y < gray.rows; y++) {
    let brightCount = 0;
    for (let x = 0; x < gray.cols; x++) {
      if (gray.ucharPtr(y, x)[0] >= STITCH_PARTNER_BTN_BRIGHTNESS) {
        brightCount++;
      }
    }
    const isBrightRow = brightCount >= minBrightPixels;
    if (isBrightRow) {
      if (runStart === -1) runStart = y;
    } else if (runStart !== -1) {
      bestRun = Math.max(bestRun, y - runStart);
      runStart = -1;
    }
  }
  if (runStart !== -1) {
    bestRun = Math.max(bestRun, gray.rows - runStart);
  }

  gray.delete();
  roi.delete();

  // 成長率帯のような縦に長い明るい領域は除外
  return bestRun > 0 && bestRun <= maxButtonRows;
}

export type LayoutDetection = { layout: StitchLayout; tabRow: TabRowInfo };

/** 初回フレームからレイアウトとタブ行を判定 */
export function detectStitchLayoutAndTabRow(
  croppedMat: any,
  cv: any,
  cropWidth: number,
  cropHeight: number
): LayoutDetection {
  const l3Upper = scanGreenTabRow(
    croppedMat,
    cv,
    cropWidth,
    cropHeight,
    STITCH_TAB_ROW_L3_SCAN_START,
    STITCH_TAB_ROW_L3_SCAN_END,
    "l3"
  );

  const l2Lower = scanGreenTabRow(
    croppedMat,
    cv,
    cropWidth,
    cropHeight,
    STITCH_TAB_ROW_L2_SCAN_START,
    STITCH_TAB_ROW_L2_SCAN_END,
    "l2"
  );

  const l3BtnTabRow = scanGreenTabRow(
    croppedMat,
    cv,
    cropWidth,
    cropHeight,
    STITCH_TAB_ROW_L3_BTN_TAB_SCAN_START,
    STITCH_TAB_ROW_L3_BTN_TAB_SCAN_END,
    "l3"
  );

  const hasPartnerBtn = detectPartnerReleaseBand(croppedMat, cv, cropWidth, cropHeight);

  // 上段3タブ（殿堂入り等）を最優先
  if (l3Upper.found) {
    if (hasPartnerBtn && l3BtnTabRow.found) {
      return { layout: "L3+Btn", tabRow: l3BtnTabRow };
    }
    return { layout: "L3", tabRow: l3Upper };
  }

  // 下段2タブ（育成中 TRN）
  if (l2Lower.found) {
    return { layout: "L2", tabRow: l2Lower };
  }

  // 練習パートナー解除＋下段3タブのみ（上段3タブなし）
  if (hasPartnerBtn && l3BtnTabRow.found) {
    return { layout: "L3+Btn", tabRow: l3BtnTabRow };
  }

  if (l3BtnTabRow.found) {
    return { layout: "L3", tabRow: l3BtnTabRow };
  }

  // 上段3タブなし → L2（旧 L3 フォールバックは TRN で致命的だった）
  const fallbackTabY = Math.floor(cropHeight * 0.46);
  return {
    layout: "L2",
    tabRow: {
      tabCount: 2,
      tabY: fallbackTabY,
      found: true,
      method: "fallback",
    },
  };
}

/** 初回フレームからレイアウトを判定 */
export function detectStitchLayout(
  croppedMat: any,
  cv: any,
  cropWidth: number,
  cropHeight: number
): StitchLayout {
  return detectStitchLayoutAndTabRow(croppedMat, cv, cropWidth, cropHeight).layout;
}

/** アクティブタブ（緑ハイライト位置）から StitchTab を判定 */
export function detectStitchTab(
  croppedMat: any,
  cv: any,
  cropWidth: number,
  cropHeight: number,
  layout: StitchLayout,
  tabRowY?: number
): StitchTab {
  const tabY =
    tabRowY ??
    detectStitchLayoutAndTabRow(croppedMat, cv, cropWidth, cropHeight).tabRow.tabY;
  const tabH = Math.max(4, Math.floor(cropHeight * STITCH_TAB_ROW_HEIGHT_RATIO));
  const roi = croppedMat.roi(new cv.Rect(0, tabY, cropWidth, tabH));

  const hsv = new cv.Mat();
  cv.cvtColor(roi, hsv, cv.COLOR_RGBA2RGB);
  cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

  const segmentCount = layout === "L2" ? 2 : 3;
  const segWidth = Math.floor(cropWidth / segmentCount);
  let bestSeg = 0;
  let bestGreen = 0;

  for (let seg = 0; seg < segmentCount; seg++) {
    const x0 = seg * segWidth;
    const x1 = seg === segmentCount - 1 ? cropWidth : (seg + 1) * segWidth;
    let greenSum = 0;
    let count = 0;
    for (let y = 0; y < hsv.rows; y++) {
      for (let x = x0; x < x1; x++) {
        const ptr = hsv.ucharPtr(y, x);
        const h = ptr[0];
        const s = ptr[1];
        const v = ptr[2];
        if (h >= 35 && h <= 85 && s >= 80 && v >= 80) {
          greenSum += s;
          count++;
        }
      }
    }
    const avg = count > 0 ? greenSum / count : 0;
    if (avg > bestGreen) {
      bestGreen = avg;
      bestSeg = seg;
    }
  }

  hsv.delete();
  roi.delete();

  if (layout === "L2") {
    // 右タブ（スキル）が通常のキャプチャ対象
    return bestSeg >= 1 ? "Skill" : "Skill";
  }

  if (bestSeg === 1) return "Inheritance";
  if (bestSeg === 2) return "TrainingInfo";
  return "Skill";
}

/** テンプレートマッチでスクロール量を算出 */
function computeTemplateScrollAmount(
  prev: any,
  curr: any,
  scrollHeight: number,
  searchWidth: number,
  cv: any
): { scrollAmount: number; score: number } {
  const templateHeight = Math.floor(scrollHeight * STITCH_TEMPLATE_HEIGHT_RATIO);
  const templateY = scrollHeight - templateHeight;

  const templateRect = new cv.Rect(0, templateY, searchWidth, templateHeight);
  const template = prev.roi(templateRect);
  const currSearchArea = curr.roi(new cv.Rect(0, 0, searchWidth, scrollHeight));

  const result = new cv.Mat();
  cv.matchTemplate(currSearchArea, template, result, cv.TM_CCOEFF_NORMED);
  const minMax = cv.minMaxLoc(result);
  const matchedY = minMax.maxLoc.y;
  const score = minMax.maxVal;
  const scrollAmount = templateY - matchedY;

  result.delete();
  template.delete();
  currSearchArea.delete();

  return { scrollAmount, score };
}

/** score 低・scrollAmount<=0 時の absdiff 縦シフトフォールバック */
function computeScrollAmountAbsDiff(
  prev: any,
  curr: any,
  scrollHeight: number,
  searchWidth: number,
  cv: any
): { scrollAmount: number; score: number } {
  const templateHeight = Math.floor(scrollHeight * STITCH_TEMPLATE_HEIGHT_RATIO);
  const templateY = scrollHeight - templateHeight;

  const prevGray = new cv.Mat();
  const currGray = new cv.Mat();
  cv.cvtColor(prev, prevGray, cv.COLOR_RGBA2GRAY);
  cv.cvtColor(curr, currGray, cv.COLOR_RGBA2GRAY);

  let bestShift = 0;
  let bestDiff = Infinity;

  // matchedY を 0〜templateY で探索（scrollAmount = templateY - matchedY > 0）
  for (let matchedY = 0; matchedY <= templateY; matchedY++) {
    const scrollAmount = templateY - matchedY;
    if (scrollAmount <= 0) continue;

    let totalDiff = 0;
    let pixels = 0;

    for (let dy = 0; dy < templateHeight; dy++) {
      const prevY = templateY + dy;
      const currY = matchedY + dy;
      if (currY >= scrollHeight) break;
      for (let x = 0; x < searchWidth; x++) {
        const a = prevGray.ucharPtr(prevY, x)[0];
        const b = currGray.ucharPtr(currY, x)[0];
        totalDiff += Math.abs(a - b);
        pixels++;
      }
    }

    if (pixels === 0) continue;
    const avgDiff = totalDiff / pixels;
    if (avgDiff < bestDiff) {
      bestDiff = avgDiff;
      bestShift = scrollAmount;
    }
  }

  prevGray.delete();
  currGray.delete();

  const score = bestDiff < Infinity ? Math.max(0, 1 - bestDiff / 128) : 0;
  return { scrollAmount: bestShift, score };
}

/** 継承タブ: 緑の継承履歴バー手前でクロップ */
function cropAtInheritanceHistoryBar(
  finalMat: any,
  cv: any,
  headerHeight: number,
  scrollHeight: number,
  cropHeight: number
): { outputMat: any; cropped: boolean } {
  const searchStartY = Math.floor(
    headerHeight + scrollHeight * STITCH_INHERITANCE_GREEN_SEARCH_START
  );
  const factorHeaderMaxY = Math.floor(
    headerHeight + scrollHeight * STITCH_INHERITANCE_FACTOR_HEADER_MAX_RATIO
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

/** スクロール末端の余白を自動クロップ */
function trimBottomWhitespace(
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
  return {
    outputMat: finalMat.roi(new cv.Rect(0, 0, finalMat.cols, contentBottomY)),
    cropped: true,
  };
}

export async function stitchWithOpenCV(imageUrls: string[]): Promise<{ cleanDataUrl: string }> {
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

  const croppedMats = mats.map((mat) => mat.roi(cropRect));

  // StitchLayout / StitchTab 判定（S-3）
  const { layout: detectedLayout, tabRow } = detectStitchLayoutAndTabRow(
    croppedMats[0],
    cv,
    cropRect.width,
    cropRect.height
  );
  let layout = detectedLayout;
  let tab = detectStitchTab(
    croppedMats[0],
    cv,
    cropRect.width,
    cropRect.height,
    layout,
    tabRow.tabY
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
    tab = "Skill";
  }

  const headerHeight = computeHeaderHeight(layout, cropRect.height, tabRow);
  const footerHeight = Math.floor(cropRect.height * STITCH_FOOTER_HEIGHT_RATIO);
  const scrollHeight = cropRect.height - headerHeight - footerHeight;

  const tabRowRatio = (tabRow.tabY / cropRect.height).toFixed(3);
  console.log(
    `StitchLayout=${layout}, StitchTab=${tab}, tabDetect=${tabRow.method ?? "n/a"}, tabY=${tabRow.tabY}(${tabRowRatio}), Header: ${headerHeight}px, Scroll: ${scrollHeight}px, Footer: ${footerHeight}px`
  );

  const headerMat = croppedMats[0].roi(new cv.Rect(0, 0, cropRect.width, headerHeight));
  const footerMat = croppedMats[croppedMats.length - 1].roi(
    new cv.Rect(0, cropRect.height - footerHeight, cropRect.width, footerHeight)
  );

  const scrollMats = croppedMats.map((mat) =>
    mat.roi(new cv.Rect(0, headerHeight, cropRect.width, scrollHeight))
  );

  const searchWidth = Math.floor(cropRect.width * STITCH_SEARCH_WIDTH_RATIO);
  const overlaps: number[] = [];

  for (let i = 0; i < scrollMats.length - 1; i++) {
    const prev = scrollMats[i];
    const curr = scrollMats[i + 1];

    let { scrollAmount, score } = computeTemplateScrollAmount(
      prev,
      curr,
      scrollHeight,
      searchWidth,
      cv
    );

    // S-4: 低スコアまたは scrollAmount<=0 時は absdiff フォールバック
    if (score < STITCH_MATCH_SCORE_THRESHOLD || scrollAmount <= 0) {
      const fallback = computeScrollAmountAbsDiff(prev, curr, scrollHeight, searchWidth, cv);
      if (fallback.scrollAmount > 0) {
        console.log(
          `Frame ${i} -> ${i + 1}: absdiff fallback score=${fallback.score.toFixed(3)}, scrollAmount=${fallback.scrollAmount}`
        );
        scrollAmount = fallback.scrollAmount;
        score = Math.max(score, fallback.score);
      }
    }

    console.log(
      `Frame ${i} -> ${i + 1}: score=${score.toFixed(3)}, scrollAmount=${scrollAmount}`
    );

    if (score < STITCH_MATCH_SCORE_THRESHOLD && scrollAmount <= 0) {
      console.warn(
        `スコアが低すぎます(${score.toFixed(3)}) かつ スクロール後退(${scrollAmount})。バウンドと判断し、以降のフレームを破棄します。`
      );
      scrollMats.splice(i + 1);
      break;
    } else if (scrollAmount <= 0) {
      console.warn(`スクロール量が0以下です: ${scrollAmount}。このフレームはスキップします。`);
      overlaps.push(0);
    } else {
      overlaps.push(scrollAmount);
    }
  }

  let totalScrollHeight = scrollHeight;
  for (const scroll of overlaps) {
    totalScrollHeight += scroll;
  }

  const finalHeight = headerHeight + totalScrollHeight + footerHeight;
  const finalMat = new cv.Mat(finalHeight, cropRect.width, cv.CV_8UC4, new cv.Scalar(0, 0, 0, 255));

  let currentY = 0;

  const headerRoi = finalMat.roi(new cv.Rect(0, currentY, cropRect.width, headerHeight));
  headerMat.copyTo(headerRoi);
  headerRoi.delete();
  currentY += headerHeight;

  const firstScrollRoi = finalMat.roi(new cv.Rect(0, currentY, cropRect.width, scrollHeight));
  scrollMats[0].copyTo(firstScrollRoi);
  firstScrollRoi.delete();
  let scrollDrawY = currentY + scrollHeight;

  for (let i = 1; i < scrollMats.length; i++) {
    const scroll = overlaps[i - 1];
    if (scroll > 0) {
      const curr = scrollMats[i];
      const bottomPart = curr.roi(
        new cv.Rect(0, scrollHeight - scroll, cropRect.width, scroll)
      );
      const dstRoi = finalMat.roi(new cv.Rect(0, scrollDrawY, cropRect.width, scroll));
      bottomPart.copyTo(dstRoi);
      dstRoi.delete();
      scrollDrawY += scroll;
      bottomPart.delete();
    }
  }

  // S-1 / S-2: スクロールバー隠し（タブ下端以下・右端3%のみ）
  let trueScrollStartY = headerHeight;
  if (croppedMats.length > 1 && overlaps.length > 0 && overlaps[0] > 0) {
    const scrollAmount = overlaps[0];
    const prev = croppedMats[0];
    const curr = croppedMats[1];

    if (scrollAmount < prev.rows) {
      const shiftedPrev = prev.roi(
        new cv.Rect(0, scrollAmount, prev.cols, prev.rows - scrollAmount)
      );
      const currOverlap = curr.roi(new cv.Rect(0, 0, curr.cols, curr.rows - scrollAmount));

      const diff = new cv.Mat();
      cv.absdiff(shiftedPrev, currOverlap, diff);
      cv.cvtColor(diff, diff, cv.COLOR_RGBA2GRAY);

      let matchCount = 0;
      for (let y = headerHeight; y < diff.rows; y++) {
        let diffSum = 0;
        const rowPtr = diff.ucharPtr(y);
        const checkWidth = Math.floor(diff.cols * STITCH_SCROLL_DIFF_CHECK_WIDTH_RATIO);
        for (let x = 0; x < checkWidth; x++) {
          diffSum += rowPtr[x];
        }
        const avgDiff = diffSum / checkWidth;

        if (avgDiff < STITCH_SCROLL_DIFF_AVG_THRESHOLD) {
          matchCount++;
          if (matchCount >= STITCH_SCROLL_DIFF_CONSECUTIVE_ROWS) {
            trueScrollStartY = y - (STITCH_SCROLL_DIFF_CONSECUTIVE_ROWS - 1);
            break;
          }
        } else {
          matchCount = 0;
        }
      }

      diff.delete();
      shiftedPrev.delete();
      currOverlap.delete();
    }
  }

  // S-1: 静的領域（タブより上）にスクロールバー隠しを適用しない
  const scrollbarStartY = Math.max(trueScrollStartY, headerHeight);
  const sbWidth = Math.ceil(cropRect.width * STITCH_SCROLLBAR_WIDTH_RATIO);
  const safeX = finalMat.cols - sbWidth - 1;
  const scrollRegionH = scrollDrawY - scrollbarStartY;

  if (sbWidth > 0 && safeX > 0 && scrollRegionH > 0) {
    const srcCol = finalMat.roi(new cv.Rect(safeX, scrollbarStartY, 1, scrollRegionH));
    const dstRegion = finalMat.roi(
      new cv.Rect(safeX + 1, scrollbarStartY, sbWidth, scrollRegionH)
    );
    cv.repeat(srcCol, 1, sbWidth, dstRegion);
    srcCol.delete();
    dstRegion.delete();
  }

  const footerRoi = finalMat.roi(new cv.Rect(0, scrollDrawY, cropRect.width, footerHeight));
  footerMat.copyTo(footerRoi);
  footerRoi.delete();

  // タブ別クロップ（S-5: 継承のみ緑帯クロップ）
  let outputMat = finalMat;
  let cropped = false;

  if (tab === "Inheritance") {
    const inheritCrop = cropAtInheritanceHistoryBar(
      finalMat,
      cv,
      headerHeight,
      scrollHeight,
      cropRect.height
    );
    if (inheritCrop.cropped) {
      outputMat = inheritCrop.outputMat;
      cropped = true;
    }
  }

  if (!cropped) {
    const trim = trimBottomWhitespace(finalMat, cv, scrollDrawY);
    outputMat = trim.outputMat;
    cropped = trim.cropped;
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputMat.cols;
  canvas.height = outputMat.rows;
  cv.imshow(canvas, outputMat);
  const cleanDataUrl = canvas.toDataURL("image/png");

  if (cropped && outputMat !== finalMat) {
    outputMat.delete();
  }
  finalMat.delete();
  headerMat.delete();
  footerMat.delete();
  mats.forEach((m) => m.delete());
  croppedMats.forEach((m) => m.delete());
  scrollMats.forEach((m) => m.delete());

  return { cleanDataUrl };
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

function findCropBounds(mat: any, cv: any): any {
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
