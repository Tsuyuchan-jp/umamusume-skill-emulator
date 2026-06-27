import {
  STITCH_SHIFT_COARSE_STEP,
  STITCH_SHIFT_CONTENT_WIDTH_RATIO,
  STITCH_SHIFT_MIN_OVERLAP_RATIO,
  STITCH_SHIFT_NARROW_REGION_MAX,
  STITCH_SHIFT_OUTLIER_TAU,
  STITCH_SHIFT_REFINE_WINDOW,
  STITCH_SHIFT_S_MAX_MARGIN,
  STITCH_SHIFT_S_MIN,
  STITCH_SHIFT_SCORE_MIN,
  STITCH_SHIFT_SCORE_SCALE,
  STITCH_SHIFT_TERMINAL_MICRO_MAX,
  STITCH_SHIFT_TERMINAL_MICRO_WIN_RATIO,
  STITCH_SHIFT_TERMINAL_NO_SCROLL_MAX,
  STITCH_SHIFT_TERMINAL_RATIO,
} from "./constants";
import type { RgbaImage } from "./rgba";

export type ShiftEstimateMethod =
  | "ssd"
  | "ssd-refined"
  | "median-corrected"
  | "terminal"
  | "skip"
  | "bound";

export interface ShiftPairResult {
  index: number;
  scrollAmount: number;
  score: number;
  method: ShiftEstimateMethod;
  rawScrollAmount?: number;
}

export interface ShiftEstimateResult {
  overlaps: number[];
  frames: ShiftPairResult[];
  representative: number;
}

export interface ShiftEstimateOptions {
  sMin?: number;
  sMaxMargin?: number;
  minOverlapRatio?: number;
  contentWidthRatio?: number;
  outlierTau?: number;
  refineWindow?: number;
  scoreScale?: number;
  scoreMin?: number;
  terminalRatio?: number;
  coarseStep?: number;
}

interface ResolvedShiftOptions {
  sMin: number;
  sMaxMargin: number;
  minOverlapRatio: number;
  contentWidthRatio: number;
  outlierTau: number;
  refineWindow: number;
  scoreScale: number;
  scoreMin: number;
  terminalRatio: number;
  coarseStep: number;
}

function resolveOptions(
  options: ShiftEstimateOptions | undefined,
  stripHeight: number
): ResolvedShiftOptions {
  const sMaxMargin = options?.sMaxMargin ?? STITCH_SHIFT_S_MAX_MARGIN;
  return {
    sMin: options?.sMin ?? STITCH_SHIFT_S_MIN,
    sMaxMargin,
    minOverlapRatio: options?.minOverlapRatio ?? STITCH_SHIFT_MIN_OVERLAP_RATIO,
    contentWidthRatio: options?.contentWidthRatio ?? STITCH_SHIFT_CONTENT_WIDTH_RATIO,
    outlierTau: options?.outlierTau ?? STITCH_SHIFT_OUTLIER_TAU,
    refineWindow: options?.refineWindow ?? STITCH_SHIFT_REFINE_WINDOW,
    scoreScale: options?.scoreScale ?? STITCH_SHIFT_SCORE_SCALE,
    scoreMin: options?.scoreMin ?? STITCH_SHIFT_SCORE_MIN,
    terminalRatio: options?.terminalRatio ?? STITCH_SHIFT_TERMINAL_RATIO,
    coarseStep: options?.coarseStep ?? STITCH_SHIFT_COARSE_STEP,
  };
}

/** scrollRegionH から SSD 重なり下限を満たす探索上界（狭い帯のみ比率ガード） */
function effectiveSMax(stripHeight: number, opts: ResolvedShiftOptions): number {
  const fromMargin = stripHeight - opts.sMaxMargin;
  if (stripHeight >= STITCH_SHIFT_NARROW_REGION_MAX) {
    return fromMargin;
  }
  const minOverlap = Math.floor(stripHeight * opts.minOverlapRatio);
  return Math.min(fromMargin, stripHeight - minOverlap);
}

function rgbaGray(img: RgbaImage, x: number, y: number): number {
  const i = (y * img.width + x) * 4;
  const r = img.data[i]!;
  const g = img.data[i + 1]!;
  const b = img.data[i + 2]!;
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

/** 重なり全体の平均絶対差分（Step B コア） */
export function overlapAvgDiff(
  prev: RgbaImage,
  curr: RgbaImage,
  shift: number,
  contentWidth: number
): number {
  const H = prev.height;
  const overlapH = H - shift;
  if (overlapH <= 0) return Infinity;

  let totalDiff = 0;
  let pixels = 0;

  for (let y = 0; y < overlapH; y++) {
    const prevY = shift + y;
    const currY = y;
    for (let x = 0; x < contentWidth; x++) {
      totalDiff += Math.abs(rgbaGray(prev, x, prevY) - rgbaGray(curr, x, currY));
      pixels++;
    }
  }

  return pixels > 0 ? totalDiff / pixels : Infinity;
}

function avgDiffToScore(avgDiff: number, scoreScale: number): number {
  return avgDiff < Infinity ? Math.max(0, 1 - avgDiff / scoreScale) : 0;
}

function searchBestShift(
  prev: RgbaImage,
  curr: RgbaImage,
  opts: ResolvedShiftOptions,
  rangeMin: number,
  rangeMax: number
): { scrollAmount: number; score: number; avgDiff: number } {
  const H = prev.height;
  const sMax = effectiveSMax(H, opts);
  const contentWidth = Math.floor(prev.width * opts.contentWidthRatio);
  const lo = Math.max(opts.sMin, rangeMin);
  const hi = Math.min(sMax, rangeMax);

  let bestS = 0;
  let bestDiff = Infinity;

  for (let S = lo; S <= hi; S += opts.coarseStep) {
    const avgDiff = overlapAvgDiff(prev, curr, S, contentWidth);
    if (avgDiff < bestDiff) {
      bestDiff = avgDiff;
      bestS = S;
    }
  }

  return {
    scrollAmount: bestS,
    score: avgDiffToScore(bestDiff, opts.scoreScale),
    avgDiff: bestDiff,
  };
}

/** 単一ペアの縦シフト推定（Step B） */
export function estimatePairShiftRgba(
  prev: RgbaImage,
  curr: RgbaImage,
  options?: ShiftEstimateOptions
): { scrollAmount: number; score: number } {
  const opts = resolveOptions(options, prev.height);
  const sMax = effectiveSMax(prev.height, opts);
  const result = searchBestShift(prev, curr, opts, opts.sMin, sMax);
  return { scrollAmount: result.scrollAmount, score: result.score };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return sorted[mid]!;
}

function sessionRepresentative(
  amounts: number[],
  outlierTau: number
): number {
  if (amounts.length === 0) return 0;
  if (amounts.length === 1) return amounts[0]!;

  const sorted = [...amounts].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const spread = max - min;
  const base = median(amounts);

  if (spread <= outlierTau) return base;

  // 2 ペアのみで広がる場合は高側誤ピークを捨て、低い方をアンカーにする（HOF）
  if (amounts.length === 2) return min;

  // 高側外れ値が支配的なときだけ下位クラスタへ（多数派は median 維持）
  if (max - base > outlierTau) {
    const lowerCluster = amounts.filter((s) => s <= base);
    if (lowerCluster.length > 0) return median(lowerCluster);
  }

  return base;
}

function shouldRefineAroundAnchor(
  amounts: number[],
  anchor: number,
  outlierTau: number
): boolean {
  if (amounts.length < 2) return false;
  const spread = Math.max(...amounts) - Math.min(...amounts);
  if (spread <= outlierTau) return false;

  if (amounts.length === 2) return true;

  const base = median(amounts);
  const max = Math.max(...amounts);
  // 低側外れ値が多い FRD 型は full-range 結果を維持し、後段 median-correct に任せる
  if (max - base <= outlierTau) return false;

  return max - anchor > outlierTau / 2;
}

function microShiftOpts(opts: ResolvedShiftOptions): ResolvedShiftOptions {
  return { ...opts, sMin: 0 };
}

function shouldAdoptMicroShift(
  microAvgDiff: number,
  coarseAvgDiff: number
): boolean {
  return (
    microAvgDiff < coarseAvgDiff * STITCH_SHIFT_TERMINAL_MICRO_WIN_RATIO
  );
}

function shouldTerminalMicroSkip(
  microS: number,
  microAdopted: boolean,
  coarseIsTerminalShortScroll: boolean
): boolean {
  if (!microAdopted || !coarseIsTerminalShortScroll) return false;
  return microS <= STITCH_SHIFT_TERMINAL_NO_SCROLL_MAX;
}

/** 全スクロール帯フレームの overlap 列を算出（Step B + Step C） */
export function estimateShiftFramesRgba(
  strips: RgbaImage[],
  options?: ShiftEstimateOptions
): ShiftEstimateResult {
  const stripHeight = strips[0]?.height ?? 0;
  const opts = resolveOptions(options, stripHeight);

  const rawPairs: Array<{ scrollAmount: number; score: number }> = [];
  for (let i = 0; i < strips.length - 1; i++) {
    const prev = strips[i]!;
    const curr = strips[i + 1]!;
    rawPairs.push(estimatePairShiftRgba(prev, curr, options));
  }

  if (rawPairs.length === 0) {
    return { overlaps: [], frames: [], representative: 0 };
  }

  const rawAmounts = rawPairs
    .map((p) => p.scrollAmount)
    .filter((s) => s > 0);
  const anchor = sessionRepresentative(rawAmounts, opts.outlierTau);
  const useRefine = shouldRefineAroundAnchor(rawAmounts, anchor, opts.outlierTau);

  const refinedPairs = rawPairs.map((raw, i) => {
    if (!useRefine || anchor <= 0) return raw;
    const prev = strips[i]!;
    const curr = strips[i + 1]!;
    const refineLo = anchor - opts.outlierTau;
    const refineHi = anchor + opts.outlierTau;
    const refined = searchBestShift(prev, curr, opts, refineLo, refineHi);
    if (refined.scrollAmount > 0) return refined;
    return raw;
  });

  const refinedAmounts = refinedPairs
    .map((p) => p.scrollAmount)
    .filter((s) => s > 0);
  const representative = median(refinedAmounts);

  const overlaps: number[] = [];
  const frames: ShiftPairResult[] = [];

  for (let i = 0; i < refinedPairs.length; i++) {
    const prev = strips[i]!;
    const curr = strips[i + 1]!;
    const isLast = i === refinedPairs.length - 1;
    const rawScrollAmount = rawPairs[i]!.scrollAmount;

    let scrollAmount = refinedPairs[i]!.scrollAmount;
    let score = refinedPairs[i]!.score;
    let method: ShiftEstimateMethod = "ssd";

    if (anchor > 0 && rawScrollAmount !== scrollAmount) {
      method = "ssd-refined";
    }

    const contentWidth = Math.floor(prev.width * opts.contentWidthRatio);
    const coarseScrollAmount = scrollAmount;
    const coarseAvgDiff =
      coarseScrollAmount > 0
        ? overlapAvgDiff(prev, curr, coarseScrollAmount, contentWidth)
        : Infinity;

    const priorAmounts = refinedPairs
      .slice(0, i)
      .map((p) => p.scrollAmount)
      .filter((s) => s > 0);
    const sessionStable =
      representative > 0 &&
      priorAmounts.length > 0 &&
      priorAmounts.every((s) => Math.abs(s - representative) <= opts.outlierTau);

    // リスト末端: 短い実測シフトは S* で補正せず raw/refined を採用（R3.5c-2）
    const coarseIsTerminalShortScroll =
      sessionStable &&
      representative > 0 &&
      coarseScrollAmount > 0 &&
      coarseScrollAmount < opts.terminalRatio * representative;

    let isTerminalShortScroll =
      isLast && coarseIsTerminalShortScroll;

    // 最終ペア: terminal 経路のみ [0, MICRO_MAX) 微探索（G-HOF-S 135px 誤結合対策）
    if (isLast && coarseScrollAmount > 0 && coarseIsTerminalShortScroll) {
      const micro = searchBestShift(
        prev,
        curr,
        microShiftOpts(opts),
        0,
        STITCH_SHIFT_TERMINAL_MICRO_MAX - 1
      );
      const microS = micro.scrollAmount;
      const microAdopted = shouldAdoptMicroShift(micro.avgDiff, coarseAvgDiff);

      if (microAdopted) {
        if (
          microS >= STITCH_SHIFT_TERMINAL_NO_SCROLL_MAX + 1 &&
          microS < STITCH_SHIFT_TERMINAL_MICRO_MAX
        ) {
          scrollAmount = microS;
          score = micro.score;
          method = "terminal";
          isTerminalShortScroll = true;
        } else if (shouldTerminalMicroSkip(microS, true, coarseIsTerminalShortScroll)) {
          frames.push({
            index: i,
            scrollAmount: 0,
            score: micro.score,
            method: "skip",
            rawScrollAmount: coarseScrollAmount,
          });
          overlaps.push(0);
          continue;
        }
      }
    }

    if (
      !isTerminalShortScroll &&
      representative > 0 &&
      scrollAmount > 0 &&
      Math.abs(scrollAmount - representative) > opts.outlierTau
    ) {
      scrollAmount = representative;
      const avgDiff = overlapAvgDiff(prev, curr, scrollAmount, contentWidth);
      score = avgDiffToScore(avgDiff, opts.scoreScale);
      method = "median-corrected";
    }

    if (isTerminalShortScroll && method !== "terminal") {
      const avgDiff = overlapAvgDiff(prev, curr, scrollAmount, contentWidth);
      score = avgDiffToScore(avgDiff, opts.scoreScale);
      method = "terminal";
    }

    const isTerminalLowScore =
      isLast &&
      sessionStable &&
      representative > 0 &&
      scrollAmount > 0 &&
      score < opts.scoreMin &&
      method !== "terminal";

    if (isTerminalLowScore) {
      method = "terminal";
    } else if (!isTerminalShortScroll && score < opts.scoreMin && scrollAmount <= 0) {
      frames.push({
        index: i,
        scrollAmount: 0,
        score,
        method: "bound",
        rawScrollAmount,
      });
      return { overlaps, frames, representative };
    } else if (!isTerminalShortScroll && !isTerminalLowScore && score < opts.scoreMin) {
      frames.push({
        index: i,
        scrollAmount: 0,
        score,
        method: "bound",
        rawScrollAmount,
      });
      return { overlaps, frames, representative };
    }

    if (scrollAmount <= 0) {
      frames.push({
        index: i,
        scrollAmount: 0,
        score,
        method: "skip",
        rawScrollAmount,
      });
      overlaps.push(0);
      continue;
    }

    frames.push({
      index: i,
      scrollAmount,
      score,
      method,
      rawScrollAmount:
        rawScrollAmount !== scrollAmount ? rawScrollAmount : undefined,
    });
    overlaps.push(scrollAmount);
  }

  return { overlaps, frames, representative };
}
