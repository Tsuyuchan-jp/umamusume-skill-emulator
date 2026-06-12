import { getSkillNameById, getSkillRarityInfoById, SkillDisplayRarity } from "./umasimSkillData";
import { RaceDetailDump, RaceFrameDump, SkillEventDump, SkillEventKind, TrackDetailDump } from "./types";

/** umasim RaceOperation.toGraphData 相当の定数 */
const FRAME_PER_SECOND = 15;

/** 持続線描画判定: 1 フレーム未満（本家 skill.end != null 相当） */
export const SKILL_DURATION_LINE_EPSILON = 1 / FRAME_PER_SECOND / 2;

/** 本家 GraphOutput.kt: skill.end != null かつ debuff は持続線なし */
export function hasSkillDurationLine(
  marker: Pick<SkillMarker, "kind" | "startTime" | "endTime">,
): boolean {
  return (
    marker.kind !== "debuff" &&
    marker.endTime > marker.startTime + SKILL_DURATION_LINE_EPSILON
  );
}
export const SPEED_MIN = 13;
export const SPEED_MAX = 30;
const STAMINA_MIN = -200;
const HORSE_LANE = 11.25 / 18;
export const STAMINA_PLOT_FLOOR = 0.05;
const LANE_PLOT_FLOOR = 0.05;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface GraphPoint {
  time: number;
  /** 生値 m/s */
  speed: number;
  /** プロット座標 [0.05, 1] */
  stamina: number;
  /** プロット座標 [0.05, 1] */
  lane: number;
  /** Tooltip 用: 初期体力比 % */
  staminaPct: number;
  /** Tooltip 用: レーン位置 %（0%=内枠 100%=外枠） */
  lanePct: number;
  /** baseline 比較時: 生値 m/s */
  baselineSpeed?: number;
  /** baseline 比較時: プロット座標 [0.05, 1] */
  baselineStamina?: number;
  /** baseline 比較時: プロット座標 [0.05, 1] */
  baselineLane?: number;
  /** baseline 比較時: Tooltip 用 初期体力比 % */
  baselineStaminaPct?: number;
  /** baseline 比較時: Tooltip 用 レーン位置 % */
  baselineLanePct?: number;
}

/** 本家 GraphOutput.kt 準拠の区間帯（ReferenceArea 用） */
export interface AreaBand {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  fill: string;
  /** 上端ボーダー色（直線/コーナーの色弱対策） */
  stroke?: string;
  /** 上端ボーダー線種。未指定は実線 */
  strokeDasharray?: string;
  /** 帯の不透明度。未指定は 0.15 */
  fillOpacity?: number;
}

/** 明るめシアン（直線）— 速度線 #3b82f6 と被りにくいトーン */
const AREA_STRAIGHT_FILL = "#5BA8E8";
/** 暗め赤紫（コーナー）— 直線帯と明度差で区別 */
const AREA_CORNER_FILL = "#9B5FB8";
/** 落ち着いたティール（上り）— レーン緑 #22c55e と被りにくい */
const AREA_UPSLOPE_FILL = "#4A9E7A";
/** 落ち着いた琥珀（下り） */
const AREA_DOWNSLOPE_FILL = "#C9A227";
/** 坂帯は半分高さのためやや濃く */
const AREA_SLOPE_FILL_OPACITY = 0.18;

export interface GraphDisplayState {
  showSpeed: boolean;
  showStamina: boolean;
  showLane: boolean;
  showAreas: boolean;
  showSkills: boolean;
  showDebuffs: boolean;
  expandSkillRows: boolean;
}

export const DEFAULT_GRAPH_DISPLAY_STATE: GraphDisplayState = {
  showSpeed: true,
  showStamina: true,
  showLane: true,
  showAreas: true,
  showSkills: true,
  showDebuffs: true,
  expandSkillRows: false,
};

/** 本家 GraphOutput.kt 準拠: スキル名ラベル + 赤い発動線 */
export interface SkillMarker {
  skillId: string;
  label: string;
  startTime: number;
  endTime: number;
  /** ラベル上端 y（percent 軸・速度スナップ + ストラグger） */
  y: number;
  /** 発動区間の水平線 y（スキル名の下・非接触） */
  lineY: number;
  labelColor: string;
  kind: SkillEventKind;
  row: number;
  /** 衝突解決用垂直ストラグger段（0 始まり） */
  stackLevel?: number;
  /** hover 一意キー（skillId + startTime） */
  tooltipKey: string;
  /** Tooltip 本文（GraphSkill.description 相当。WASM effectText 優先） */
  effectText: string;
  /** 発動区間の水平線を描くか（endedSkills 検出スキルのみ true） */
  hasDurationLine: boolean;
}

/** 縦拡大時のチャート高さ */
export const SKILL_CHART_BASE_HEIGHT = 360;
/** @deprecated 下帯行レイアウト用。速度スナップ後は STAGGER_ROW を使用 */
export const SKILL_ROW_HEIGHT = 19;
export const SKILL_FONT_SIZE = 10;
export const SKILL_LINE_GAP = 3;
/** 赤線を上方向へ寄せる微調整（px） */
export const SKILL_LINE_Y_NUDGE_UP = 1;
/** @deprecated 下帯行レイアウト用 */
export const SKILL_ROW_TOP_PAD = 4;
/** 速度点からラベル上端までのオフセット（px） */
export const SKILL_SPEED_LABEL_OFFSET = 12;
/** 衝突解決: 垂直ストラグger 1 段あたり（px） */
export const STAGGER_ROW = 14;
/** 衝突検出: X 方向ビン幅（秒） */
export const STAGGER_BIN_SECONDS = 0.4;
/** 縦拡大 OFF 時の最大ストラグger段数（0..3 = 4 段） */
export const MAX_STACK_COLLAPSED = 4;
/** detail モード Y zoom 下限（詳細表示感のため） */
export const DETAIL_ZOOM_MIN = 1.5;
/** detail モード Y zoom 上限（スクロール破綻防止） */
export const DETAIL_ZOOM_MAX = 5.0;
/**
 * detail yZoomFactor のスケール対象:
 * - 速度 plot 高さ（speedPlotHeight）
 * - stagger 段間隔（STAGGER_ROW × K）
 * px 固定（K で拡大しない）: フォント・hit box・速度ラベルオフセット・赤線 gap
 */
/** assignStackLevels の無限ループ防止 */
const STACK_ASSIGN_MAX_ITER = 256;
/** デバフラベル: スキル基準 Y からの追加オフセット（px） */
export const DEBUFF_Y_OFFSET = 20;
interface StackAssignOptions {
  expanded: boolean;
  maxTime: number;
  plotWidth: number;
  points: GraphPoint[];
  speedPlotHeight: number;
  yZoomFactor: number;
  /** detail: X hit box 重なりでも stagger（近接 speed 帯含む） */
  xStaggerOnly?: boolean;
}

function hitBoxesOverlap(
  a: { startTime: number; hitWidthTime: number; yTop: number; hitHeight: number },
  b: { startTime: number; hitWidthTime: number; yTop: number; hitHeight: number },
): boolean {
  const aEnd = a.startTime + a.hitWidthTime;
  const bEnd = b.startTime + b.hitWidthTime;
  const xOverlap = a.startTime < bEnd && aEnd > b.startTime;
  const yOverlap = a.yTop < b.yTop + b.hitHeight && a.yTop + a.hitHeight > b.yTop;
  return xOverlap && yOverlap;
}

/** assignStackLevels 後の 2D hit box 被りが残るか */
function hasSkillLabelOverlaps(
  items: StackLayoutInput[],
  options: StackAssignOptions,
): boolean {
  const { stackLevels } = assignStackLevels(items, options);
  if (!items.length) return false;

  const { maxTime, plotWidth, points, speedPlotHeight, yZoomFactor } = options;
  const staggerStep = STAGGER_ROW * yZoomFactor;
  const hitHeight = SKILL_HIT_HEIGHT;

  const boxes = items.map((item) => {
    const stackLevel = stackLevels.get(item.tooltipKey) ?? 0;
    const baseY = markerBaseLabelY(points, item.startTime, item.kind, speedPlotHeight);
    const hitWidthPx = estimateSkillHitWidth(item.label);
    const hitWidthTime = (hitWidthPx / plotWidth) * maxTime;
    return {
      startTime: item.startTime,
      hitWidthTime,
      yTop: baseY + stackLevel * staggerStep,
      hitHeight,
    };
  });

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (hitBoxesOverlap(boxes[i], boxes[j])) return true;
    }
  }
  return false;
}

/** detail: 2D 被りが解消する最小 yZoomFactor を探索（[DETAIL_ZOOM_MIN, DETAIL_ZOOM_MAX]） */
export function computeDetailYZoomFactor(params: {
  markers: Pick<SkillMarker, "tooltipKey" | "label" | "startTime" | "kind">[];
  viewportPlotHeight: number;
  maxTime: number;
  plotWidth: number;
  points: GraphPoint[];
  hasDebuff?: boolean;
}): number {
  const { markers, viewportPlotHeight, maxTime, plotWidth, points, hasDebuff = false } = params;
  if (viewportPlotHeight <= 0 || !markers.length || maxTime <= 0 || plotWidth <= 0) {
    return DETAIL_ZOOM_MIN;
  }

  const items: StackLayoutInput[] = markers.map((m) => ({
    tooltipKey: m.tooltipKey,
    label: m.label,
    startTime: m.startTime,
    kind: m.kind,
  }));

  const seedStack = assignStackLevels(items, {
    expanded: true,
    maxTime,
    plotWidth,
    points,
    speedPlotHeight: viewportPlotHeight,
    yZoomFactor: 1,
    xStaggerOnly: true,
  }).maxStack;
  const seedK = computeYZoomFactor(viewportPlotHeight, seedStack, hasDebuff);
  let lo = Math.max(DETAIL_ZOOM_MIN, seedK);
  let hi = DETAIL_ZOOM_MAX;

  const testAt = (k: number) =>
    hasSkillLabelOverlaps(items, {
      expanded: true,
      maxTime,
      plotWidth,
      points,
      speedPlotHeight: viewportPlotHeight * k,
      yZoomFactor: k,
      xStaggerOnly: true,
    });

  if (!testAt(lo)) return lo;
  if (testAt(hi)) return DETAIL_ZOOM_MAX;

  let best = hi;
  for (let i = 0; i < 16; i += 1) {
    const mid = (lo + hi) / 2;
    if (!testAt(mid)) {
      best = mid;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return Math.min(DETAIL_ZOOM_MAX, Math.max(DETAIL_ZOOM_MIN, best));
}
/** LineChart margin と同期（layoutSkillMarkers 用） */
export const SKILL_CHART_MARGIN_TOP = 24;
export const SKILL_CHART_MARGIN_BOTTOM = 4;
/** 速度折れ線 plot 高さ（px）— 縦拡大 ON でも Recharts はこの高さを維持 */
export const SPEED_PLOT_HEIGHT =
  SKILL_CHART_BASE_HEIGHT - SKILL_CHART_MARGIN_TOP - SKILL_CHART_MARGIN_BOTTOM;

/** ラベル hit box 幅（px）— layout / skillMarkersToPx 共通 */
export function estimateSkillHitWidth(label: string): number {
  return Math.max(label.length * SKILL_FONT_SIZE * 0.55, SKILL_FONT_SIZE * 2) + 4;
}

/** ラベル hit box 高さ（px） */
export const SKILL_HIT_HEIGHT = SKILL_FONT_SIZE + 4;

/**
 * 速度 m/s を overlay プロット領域内の Y（px・上端 0）へ変換する。
 * 左速度軸 SPEED_MIN〜SPEED_MAX と同一 plot 高さ。
 */
export function speedToOverlayY(speed: number, plotHeight: number): number {
  if (plotHeight <= 0) return 0;
  const clamped = Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed));
  const norm = (clamped - SPEED_MIN) / (SPEED_MAX - SPEED_MIN);
  return (1 - norm) * plotHeight;
}

/** startTime に対応する current 速度（graphPoints.points） */
function getSpeedAtTime(points: GraphPoint[], startTime: number): number {
  if (!points.length) return SPEED_MIN;
  const idx = Math.min(Math.round(startTime * FRAME_PER_SECOND), points.length - 1);
  return points[idx]?.speed ?? SPEED_MIN;
}

/** 速度 plot 下のスキル band 高さ（px）— layout / computeExpandedChartHeight 単一ソース */
export function computeSkillBandHeight(maxStack: number, hasDebuff = false): number {
  return (
    SKILL_SPEED_LABEL_OFFSET +
    maxStack * STAGGER_ROW +
    SKILL_FONT_SIZE +
    SKILL_LINE_GAP -
    SKILL_LINE_Y_NUDGE_UP +
    (hasDebuff ? DEBUFF_Y_OFFSET : 0)
  );
}

/** 密集度から Y クローズアップ倍率を算出（overview=1、detail>=1） */
export function computeYZoomFactor(
  viewportPlotHeight: number,
  maxStack: number,
  hasDebuff = false,
): number {
  if (viewportPlotHeight <= 0) return 1;
  const extraPx = computeSkillBandHeight(maxStack, hasDebuff);
  return Math.max(1, (viewportPlotHeight + extraPx) / viewportPlotHeight);
}

/** detail モードの chart 高さ = viewportChartHeight × yZoomFactor */
export function computeZoomedChartHeight(viewportChartHeight: number, yZoomFactor: number): number {
  return Math.max(viewportChartHeight, viewportChartHeight * yZoomFactor);
}

/** @deprecated computeZoomedChartHeight を使用 */
export function computeExpandedChartHeight(
  lineChartHeight: number,
  maxStack: number,
  hasDebuff = false,
): number {
  const viewportPlotHeight = Math.max(
    lineChartHeight - SKILL_CHART_MARGIN_TOP - SKILL_CHART_MARGIN_BOTTOM,
    1,
  );
  const yZoomFactor = computeYZoomFactor(viewportPlotHeight, maxStack, hasDebuff);
  return computeZoomedChartHeight(lineChartHeight, yZoomFactor);
}

export interface SkillLayoutOptions {
  /** true: maxStack までストラグger展開。false: 最大4段・超過は重なり許容 */
  expanded?: boolean;
  /** 速度スナップ用。未指定時は SPEED_MIN 固定 */
  points?: GraphPoint[];
  /** 速度スナップ plot 高さ（px）。未指定時は chart plot と同じ */
  speedPlotHeight?: number;
  /** Y クローズアップ倍率（overview=1）。オフセット・stagger も同倍率でスケール */
  yZoomFactor?: number;
  /** hit box 衝突判定用 */
  maxTime?: number;
  /** hit box 衝突判定用（px）。未指定時は OVERLAY 基準幅 */
  plotWidth?: number;
  /** detail: X 重なりでも stagger（expanded 時デフォルト true） */
  xStaggerOnly?: boolean;
}

interface StackLayoutInput {
  tooltipKey: string;
  label: string;
  startTime: number;
  kind: SkillEventKind;
}

function markerBaseLabelY(
  points: GraphPoint[],
  startTime: number,
  kind: SkillEventKind,
  speedPlotHeight: number,
): number {
  const speed = getSpeedAtTime(points, startTime);
  const speedY = speedToOverlayY(speed, speedPlotHeight);
  const kindOffset = kind === "debuff" ? DEBUFF_Y_OFFSET : 0;
  return speedY + SKILL_SPEED_LABEL_OFFSET + kindOffset;
}

/** X+Y hit box 重なりで stackLevel を付与 */
function assignStackLevels(
  items: StackLayoutInput[],
  options: StackAssignOptions,
): { stackLevels: Map<string, number>; maxStack: number } {
  const {
    expanded,
    maxTime,
    plotWidth,
    points,
    speedPlotHeight,
    yZoomFactor,
    xStaggerOnly = false,
  } = options;
  const stackLevels = new Map<string, number>();
  let maxStack = 0;

  if (!items.length || maxTime <= 0 || plotWidth <= 0 || speedPlotHeight <= 0) {
    return { stackLevels, maxStack };
  }

  const sorted = [...items].sort(
    (a, b) => a.startTime - b.startTime || a.tooltipKey.localeCompare(b.tooltipKey),
  );
  const placed: {
    startTime: number;
    hitWidthTime: number;
    stackLevel: number;
    baseY: number;
  }[] = [];

  const staggerStep = STAGGER_ROW * yZoomFactor;
  const hitHeight = SKILL_HIT_HEIGHT;

  for (const item of sorted) {
    const hitWidthPx = estimateSkillHitWidth(item.label);
    const hitWidthTime = (hitWidthPx / plotWidth) * maxTime;
    const baseY = markerBaseLabelY(points, item.startTime, item.kind, speedPlotHeight);
    let stackLevel = 0;

    for (;;) {
      const capped = expanded ? stackLevel : Math.min(stackLevel, MAX_STACK_COLLAPSED - 1);
      if (stackLevel >= STACK_ASSIGN_MAX_ITER) {
        stackLevels.set(item.tooltipKey, capped);
        placed.push({ startTime: item.startTime, hitWidthTime, stackLevel: capped, baseY });
        maxStack = Math.max(maxStack, capped);
        break;
      }

      const yTop = baseY + capped * staggerStep;
      const yBottom = yTop + hitHeight;
      const startX = item.startTime;
      const endX = startX + hitWidthTime;

      const overlaps = placed.some((p) => {
        const pYTop = p.baseY + p.stackLevel * staggerStep;
        const pYBottom = pYTop + hitHeight;
        const pStart = p.startTime;
        const pEnd = p.startTime + p.hitWidthTime;
        const xOverlap = startX < pEnd && endX > pStart;
        const yOverlap = yTop < pYBottom && yBottom > pYTop;
        if (expanded && xStaggerOnly) {
          if (!xOverlap) return false;
          return yOverlap || Math.abs(baseY - p.baseY) < hitHeight;
        }
        return xOverlap && yOverlap;
      });

      if (!overlaps) {
        stackLevels.set(item.tooltipKey, capped);
        placed.push({ startTime: item.startTime, hitWidthTime, stackLevel: capped, baseY });
        maxStack = Math.max(maxStack, capped);
        break;
      }

      stackLevel += 1;
      if (!expanded && stackLevel >= MAX_STACK_COLLAPSED) {
        const cappedOverflow = MAX_STACK_COLLAPSED - 1;
        stackLevels.set(item.tooltipKey, cappedOverflow);
        placed.push({
          startTime: item.startTime,
          hitWidthTime,
          stackLevel: cappedOverflow,
          baseY,
        });
        maxStack = Math.max(maxStack, cappedOverflow);
        break;
      }
    }
  }

  return { stackLevels, maxStack };
}

/** 速度スナップ + ストラグger で percent 軸 y / lineY を確定 */
export function layoutSkillMarkers(
  markers: SkillMarker[],
  chartHeightPx: number,
  options: SkillLayoutOptions = {},
): SkillMarker[] {
  const {
    expanded = true,
    points = [],
    speedPlotHeight: speedPlotHeightOpt,
    yZoomFactor = 1,
    maxTime = 0,
    plotWidth = 800 - OVERLAY_MARGIN_LEFT - OVERLAY_MARGIN_RIGHT,
    xStaggerOnly: xStaggerOnlyOpt,
  } = options;

  const xStaggerOnly = xStaggerOnlyOpt ?? expanded;

  const totalPlotHeight = chartHeightPx - SKILL_CHART_MARGIN_TOP - SKILL_CHART_MARGIN_BOTTOM;
  const speedPlotHeight = speedPlotHeightOpt ?? totalPlotHeight;
  if (totalPlotHeight <= 0 || speedPlotHeight <= 0 || markers.length === 0) return markers;

  const effectiveMaxTime =
    maxTime > 0
      ? maxTime
      : points.length > 0
        ? points[points.length - 1].time
        : Math.max(...markers.map((m) => m.endTime), 1);

  const { stackLevels } = assignStackLevels(
    markers.map((m) => ({
      tooltipKey: m.tooltipKey,
      label: m.label,
      startTime: m.startTime,
      kind: m.kind,
    })),
    { expanded, maxTime: effectiveMaxTime, plotWidth, points, speedPlotHeight, yZoomFactor, xStaggerOnly },
  );

  const lineOffsetPx = SKILL_FONT_SIZE + SKILL_LINE_GAP - SKILL_LINE_Y_NUDGE_UP;

  return markers.map((marker) => {
    const baseY = markerBaseLabelY(points, marker.startTime, marker.kind, speedPlotHeight);
    const stackLevel = stackLevels.get(marker.tooltipKey) ?? marker.stackLevel ?? 0;
    const labelTopPx = baseY + stackLevel * STAGGER_ROW * yZoomFactor;
    const lineTopPx = labelTopPx + lineOffsetPx;

    return {
      ...marker,
      stackLevel,
      row: stackLevel,
      y: 1 - labelTopPx / totalPlotHeight,
      lineY: 1 - lineTopPx / totalPlotHeight,
    };
  });
}

/** layoutSkillMarkers と同一条件で maxStack を算出（expandedChartHeight 用） */
export function computeSkillMaxStack(
  markers: Pick<SkillMarker, "tooltipKey" | "label" | "startTime" | "kind">[],
  maxTime: number,
  plotWidth = 800 - OVERLAY_MARGIN_LEFT - OVERLAY_MARGIN_RIGHT,
  points: GraphPoint[] = [],
  speedPlotHeight = SPEED_PLOT_HEIGHT,
  yZoomFactor = 1,
): number {
  return assignStackLevels(
    markers.map((m) => ({
      tooltipKey: m.tooltipKey,
      label: m.label,
      startTime: m.startTime,
      kind: m.kind,
    })),
    {
      expanded: true,
      maxTime,
      plotWidth,
      points,
      speedPlotHeight,
      yZoomFactor,
      xStaggerOnly: true,
    },
  ).maxStack;
}

/** overlay SVG 座標変換用: Recharts LineChart の固定マージン＋軸幅 */
export const OVERLAY_MARGIN_LEFT = 52; // chart margin.left(4) + left YAxis width(48)
export const OVERLAY_MARGIN_RIGHT = 88; // chart margin.right(48) + right YAxis width(40)

/** overlay SVG 上のスキルマーカーのピクセル座標 */
export interface SkillMarkerPx {
  skillId: string;
  label: string;
  labelColor: string;
  kind: SkillEventKind;
  startTime: number;
  tooltipKey: string;
  effectText: string;
  /** ラベル・赤線の開始 x（px） */
  startX: number;
  /** 赤線の終了 x（px） */
  endX: number;
  /** ラベル上端 y（px、dominantBaseline="hanging" 用） */
  labelY: number;
  /** 赤線 y（px） */
  lineY: number;
  /** 発動区間の水平線を描くか */
  hasDurationLine: boolean;
  /** ラベル hit area 幅（px） */
  hitWidth: number;
  /** ラベル hit area 高さ（px） */
  hitHeight: number;
}

/**
 * layoutSkillMarkers の domain 座標を overlay SVG ピクセル座標に変換する
 *   x = (time / maxTime) * plotWidth + OVERLAY_MARGIN_LEFT
 *   y = (1 - domainY) * plotHeight + SKILL_CHART_MARGIN_TOP
 */
export function skillMarkersToPx(
  markers: SkillMarker[],
  chartHeightPx: number,
  chartWidthPx: number,
  maxTime: number,
): SkillMarkerPx[] {
  if (!markers.length || maxTime <= 0 || chartWidthPx <= 0 || chartHeightPx <= 0) return [];

  const plotHeight = chartHeightPx - SKILL_CHART_MARGIN_TOP - SKILL_CHART_MARGIN_BOTTOM;
  const plotWidth = chartWidthPx - OVERLAY_MARGIN_LEFT - OVERLAY_MARGIN_RIGHT;
  if (plotHeight <= 0 || plotWidth <= 0) return [];

  return markers.map((m) => {
    const hitWidth = estimateSkillHitWidth(m.label);
    return {
      skillId: m.skillId,
      label: m.label,
      labelColor: m.labelColor,
      kind: m.kind,
      startTime: m.startTime,
      tooltipKey: m.tooltipKey,
      effectText: m.effectText,
      startX: (m.startTime / maxTime) * plotWidth + OVERLAY_MARGIN_LEFT,
      endX: (m.endTime / maxTime) * plotWidth + OVERLAY_MARGIN_LEFT,
      labelY: (1 - m.y) * plotHeight + SKILL_CHART_MARGIN_TOP,
      lineY: (1 - m.lineY) * plotHeight + SKILL_CHART_MARGIN_TOP,
      hasDurationLine: m.hasDurationLine,
      hitWidth,
      hitHeight: SKILL_HIT_HEIGHT,
    };
  });
}

/** PROJECT.md スキル色分け正本に合わせたラベル文字色 */
const RARITY_LABEL_COLORS: Record<SkillDisplayRarity, string> = {
  unique: "#60a5fa",
  inherit: "#34d399",
  evo: "#f87171",
  rare: "#fbbf24",
  white: "#e4e4e7",
};

const DEBUFF_LABEL_COLOR = "#a78bfa";

function getSkillLabelColorById(skillId: string): string {
  const info = getSkillRarityInfoById(skillId);
  return RARITY_LABEL_COLORS[info.rarity];
}

/** フレーム index から発動位置％文字列を生成（本家 startRate/endRate 相当） */
function frameIndexToPositionRate(frames: RaceFrameDump[], index: number, courseLength: number): string {
  if (!frames.length || courseLength <= 0) return "0.0%";
  const clamped = Math.min(Math.max(index, 0), frames.length - 1);
  return ((frames[clamped].startPosition / courseLength) * 100).toFixed(1) + "%";
}

/** startTime/endTime から発動位置％範囲文字列（WASM 未更新時の暫定） */
export function buildActivatePositionText(
  frames: RaceFrameDump[],
  courseLength: number,
  startTime: number,
  endTime: number,
  hasEnd: boolean,
): string {
  if (!frames.length || courseLength <= 0) return "";
  const startIndex = Math.min(Math.round(startTime * FRAME_PER_SECOND), frames.length - 1);
  const startRate = frameIndexToPositionRate(frames, startIndex, courseLength);
  if (!hasEnd) return startRate;
  const endIndex = Math.min(Math.round(endTime * FRAME_PER_SECOND), frames.length - 1);
  const endRate = frameIndexToPositionRate(frames, endIndex, courseLength);
  return `${startRate}〜${endRate}`;
}

/** WASM effectText が無い場合の暫定 Tooltip 本文（発動位置％のみ） */
function buildProvisionalEffectText(
  event: SkillEventDump,
  frames: RaceFrameDump[],
  courseLength: number,
): string {
  if (event.effectText) return event.effectText;
  const hasEnd = hasSkillDurationLine(event);
  return buildActivatePositionText(frames, courseLength, event.startTime, event.endTime, hasEnd);
}

function makeTooltipKey(skillId: string, startTime: number): string {
  return `${skillId}@${startTime.toFixed(4)}`;
}

export interface RaceGraphData {
  points: GraphPoint[];
  phaseLines: { label: string; time: number }[];
  staminaMax: number;
  areaBands: AreaBand[];
  skillMarkers: SkillMarker[];
  /** 縦拡大 ON 時のみ使用: maxStack 基準の chartHeight */
  expandedChartHeight: number;
}

/** 距離 m → 経過秒（frameIndex / 15） */
function distanceToTime(frames: RaceFrameDump[], positionM: number): number {
  const index = frames.findIndex((f) => f.startPosition >= positionM);
  if (index < 0) return (frames.length - 1) / FRAME_PER_SECOND;
  return index / FRAME_PER_SECOND;
}

/** 本家 RaceOperation.toGraphData(areas, frameList) 相当 — ReferenceArea 用に変換 */
function buildAreaBands(
  trackDetail: TrackDetailDump | undefined,
  frames: RaceFrameDump[],
): AreaBand[] {
  if (!trackDetail || !frames.length) return [];

  const { straights, corners, slopes } = trackDetail;
  if (!straights.length && !corners.length && !slopes.length) return [];

  const toBands = (
    areas: { start: number; end: number }[],
    y1: number,
    y2: number,
    fill: string,
    stroke?: string,
    strokeDasharray?: string,
    fillOpacity?: number,
  ): AreaBand[] =>
    areas
      .filter((a) => a.end > a.start)
      .map((area) => {
        const x1 = distanceToTime(frames, area.start);
        const x2 = distanceToTime(frames, area.end);
        if (x1 >= x2) return null;
        const band: AreaBand = { x1, x2, y1, y2, fill };
        if (stroke) band.stroke = stroke;
        if (strokeDasharray) band.strokeDasharray = strokeDasharray;
        if (fillOpacity !== undefined) band.fillOpacity = fillOpacity;
        return band;
      })
      .filter((band): band is AreaBand => band !== null);

  return [
    ...toBands(straights, 0, 0.1, AREA_STRAIGHT_FILL, AREA_STRAIGHT_FILL),
    ...toBands(corners, 0, 0.1, AREA_CORNER_FILL, AREA_CORNER_FILL, "3 2"),
    ...toBands(
      slopes.filter((s) => s.slope > 0),
      0.15,
      0.2,
      AREA_UPSLOPE_FILL,
      undefined,
      undefined,
      AREA_SLOPE_FILL_OPACITY,
    ),
    ...toBands(
      slopes.filter((s) => s.slope < 0),
      0.1,
      0.15,
      AREA_DOWNSLOPE_FILL,
      undefined,
      undefined,
      AREA_SLOPE_FILL_OPACITY,
    ),
  ];
}

/** skillEvents から本家準拠のスキルマーカー（発動ごと 1 件）を生成 */
export function buildSkillMarkers(
  skillEvents: SkillEventDump[] | undefined,
  displayState: GraphDisplayState,
  detail?: Pick<RaceDetailDump, "frames" | "courseLength">,
  graphPoints?: Pick<RaceGraphPoints, "points">,
): Pick<RaceGraphData, "skillMarkers" | "expandedChartHeight"> {
  if (!skillEvents?.length) {
    return { skillMarkers: [], expandedChartHeight: SKILL_CHART_BASE_HEIGHT };
  }

  const filtered = skillEvents
    .filter((event) => (event.kind === "debuff" ? displayState.showDebuffs : displayState.showSkills))
    .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);

  if (!filtered.length) {
    return { skillMarkers: [], expandedChartHeight: SKILL_CHART_BASE_HEIGHT };
  }

  const frames = detail?.frames ?? [];
  const courseLength = detail?.courseLength ?? 0;
  const points = graphPoints?.points ?? [];
  const maxTime = points.length > 0 ? points[points.length - 1].time : 0;
  const hasDebuff = filtered.some((event) => event.kind === "debuff");

  const baseMarkers: SkillMarker[] = filtered.map((event, index) => {
    const marker = {
      skillId: event.skillId,
      label: getSkillNameById(event.skillId),
      startTime: event.startTime,
      endTime: event.endTime,
      y: 1,
      lineY: 1,
      labelColor: event.kind === "debuff" ? DEBUFF_LABEL_COLOR : getSkillLabelColorById(event.skillId),
      kind: event.kind,
      row: index,
      stackLevel: 0,
      tooltipKey: makeTooltipKey(event.skillId, event.startTime),
      effectText: buildProvisionalEffectText(event, frames, courseLength),
      hasDurationLine: false,
    };
    return { ...marker, hasDurationLine: hasSkillDurationLine(marker) };
  });

  const maxStack = computeSkillMaxStack(baseMarkers, maxTime, undefined, points, SPEED_PLOT_HEIGHT, 1);
  const yZoomFactor = computeYZoomFactor(SPEED_PLOT_HEIGHT, maxStack, hasDebuff);
  const expandedChartHeight = computeZoomedChartHeight(SKILL_CHART_BASE_HEIGHT, yZoomFactor);
  return { skillMarkers: baseMarkers, expandedChartHeight };
}

/** detail 固定部分（frames 依存）のみを計算する — displayState に依存しない */
export interface RaceGraphPoints {
  points: GraphPoint[];
  phaseLines: { label: string; time: number }[];
  staminaMax: number;
  areaBands: AreaBand[];
}

/**
 * RaceDetailDump から detail 固定の描画データを生成する。
 * displayState（checkbox）が変わっても再計算されないよう分離。
 * skillMarkers は buildSkillMarkers() で別途計算する。
 */
export function buildRaceGraphPoints(detail: RaceDetailDump): RaceGraphPoints {
  const { frames, phase1Start, phase2Start, gateCount, initialLaneAdjuster, trackDetail } = detail;
  if (!frames.length) {
    return { points: [], phaseLines: [], staminaMax: 0, areaBands: [] };
  }

  const staminaMax = frames[0].sp;
  const laneMax = Math.max(gateCount + 1, 11) * HORSE_LANE + initialLaneAdjuster;
  const laneMin = HORSE_LANE / 2;

  const points: GraphPoint[] = frames.map((frame, index) => {
    const spNorm = staminaMax > 0 ? clamp01(frame.sp / staminaMax) : 0;
    const laneRaw = frame.currentLane + HORSE_LANE / 2;
    const laneNorm = clamp01((laneRaw - laneMin) / (laneMax - laneMin));

    return {
      time: index / FRAME_PER_SECOND,
      speed: frame.speed,
      stamina: STAMINA_PLOT_FLOOR + (1 - STAMINA_PLOT_FLOOR) * spNorm,
      lane: LANE_PLOT_FLOOR + (1 - LANE_PLOT_FLOOR) * laneNorm,
      staminaPct: staminaMax > 0 ? (frame.sp / staminaMax) * 100 : 0,
      lanePct: laneNorm * 100,
    };
  });

  const phase0Index = frames.findIndex((f) => f.startPosition >= 0);
  const phase1Index = frames.findIndex((f) => f.startPosition >= phase1Start);
  const phase2Index = frames.findIndex((f) => f.startPosition >= phase2Start);

  const toTime = (index: number) => (index >= 0 ? index / FRAME_PER_SECOND : 0);

  const phaseLines = [
    { label: "スタート", time: toTime(phase0Index) },
    { label: "中盤へ", time: toTime(phase1Index) },
    { label: "終盤へ", time: toTime(phase2Index) },
  ].filter((p) => p.time > 0);

  const areaBands = buildAreaBands(trackDetail, frames);

  return { points, phaseLines, staminaMax, areaBands };
}

/** baseline の1フレームを current と同じ正規化でプロット値に変換 */
function frameToBaselineFields(
  frame: RaceFrameDump,
  staminaMax: number,
  laneMin: number,
  laneMax: number,
): Pick<
  GraphPoint,
  "baselineSpeed" | "baselineStamina" | "baselineLane" | "baselineStaminaPct" | "baselineLanePct"
> {
  const spNorm = staminaMax > 0 ? clamp01(frame.sp / staminaMax) : 0;
  const laneRaw = frame.currentLane + HORSE_LANE / 2;
  const laneNorm = clamp01((laneRaw - laneMin) / (laneMax - laneMin));

  return {
    baselineSpeed: frame.speed,
    baselineStamina: STAMINA_PLOT_FLOOR + (1 - STAMINA_PLOT_FLOOR) * spNorm,
    baselineLane: LANE_PLOT_FLOOR + (1 - LANE_PLOT_FLOOR) * laneNorm,
    baselineStaminaPct: staminaMax > 0 ? (frame.sp / staminaMax) * 100 : 0,
    baselineLanePct: laneNorm * 100,
  };
}

/**
 * current の points に baseline detail を index 基準でマージする。
 * current frames 長を正とし、区間帯・phaseLines は current 正本のまま。
 */
export function mergeBaselineGraphPoints(
  current: RaceGraphPoints,
  baselineDetail: RaceDetailDump | null | undefined,
): RaceGraphPoints {
  if (!baselineDetail?.frames.length || !current.points.length) {
    return current;
  }

  const baselineFrames = baselineDetail.frames;
  const baselineStaminaMax = baselineFrames[0].sp;
  const laneMax =
    Math.max(baselineDetail.gateCount + 1, 11) * HORSE_LANE + baselineDetail.initialLaneAdjuster;
  const laneMin = HORSE_LANE / 2;

  const points = current.points.map((point, index) => {
    const baselineFrame = baselineFrames[index];
    if (!baselineFrame) return point;
    return {
      ...point,
      ...frameToBaselineFields(baselineFrame, baselineStaminaMax, laneMin, laneMax),
    };
  });

  return { ...current, points };
}

/**
 * RaceDetailDump からグラフ描画用データを生成する薄いラッパー。
 * buildRaceGraphPoints + buildSkillMarkers を合成する。
 * 既存の呼び出し元との互換性維持用。
 */
export function buildRaceGraphData(
  detail: RaceDetailDump,
  displayState: GraphDisplayState = DEFAULT_GRAPH_DISPLAY_STATE,
): RaceGraphData {
  if (!detail.frames.length) {
    return {
      points: [],
      phaseLines: [],
      staminaMax: 0,
      areaBands: [],
      skillMarkers: [],
      expandedChartHeight: SKILL_CHART_BASE_HEIGHT,
    };
  }

  const { points, phaseLines, staminaMax, areaBands } = buildRaceGraphPoints(detail);
  const graphPoints = { points, phaseLines, staminaMax, areaBands };
  const { skillMarkers, expandedChartHeight } = buildSkillMarkers(
    detail.skillEvents,
    displayState,
    detail,
    graphPoints,
  );

  return { points, phaseLines, staminaMax, areaBands, skillMarkers, expandedChartHeight };
}
