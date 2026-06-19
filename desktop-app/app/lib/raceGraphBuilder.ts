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

/** 等倍ズーム上限（1 = 俯瞰） */
export const CHART_VIEW_SCALE_MAX = 24;

/** ホイール 1 ノッチの倍率（拡大: ×k、縮小: ×1/k） */
export const CHART_VIEW_WHEEL_ZOOM_FACTOR = 1.2;

/** グラフの表示変換。内部正本は center + scale */
export interface ChartViewState {
  /** 等倍ズーム倍率。1 = 俯瞰 */
  scale: number;
  /** 可視窓中心（秒） */
  centerTime: number;
  /** 可視窓中心（m/s） */
  centerSpeed: number;
  /** 可視窓中心（percent 軸 0〜1） */
  centerPercent: number;
}

export interface VisibleWindow {
  timeMin: number;
  timeMax: number;
  speedMin: number;
  speedMax: number;
  percentMin: number;
  percentMax: number;
}

export interface VisibleWindowOptions {
  /** true: percent を常に [0, 1]（パターン A・将来トグル用） */
  lockPercentFullRange?: boolean;
}

/** scale=1 かつレース全体が viewport に収まる初期値 */
export function createInitialChartViewState(raceEnd: number): ChartViewState {
  return {
    scale: 1,
    centerTime: raceEnd / 2,
    centerSpeed: (SPEED_MIN + SPEED_MAX) / 2,
    centerPercent: 0.5,
  };
}

/** ChartViewState の各フィールドが一致するか（overlay 同期ゲート用） */
export function chartViewStatesEqual(a: ChartViewState, b: ChartViewState): boolean {
  return (
    a.scale === b.scale &&
    a.centerTime === b.centerTime &&
    a.centerSpeed === b.centerSpeed &&
    a.centerPercent === b.centerPercent
  );
}

/** VisibleWindow の各 domain が一致するか */
export function visibleWindowsEqual(a: VisibleWindow, b: VisibleWindow): boolean {
  return (
    a.timeMin === b.timeMin &&
    a.timeMax === b.timeMax &&
    a.speedMin === b.speedMin &&
    a.speedMax === b.speedMax &&
    a.percentMin === b.percentMin &&
    a.percentMax === b.percentMax
  );
}

/** scales が cartesian 矩形と domain 端点で一致するか（Recharts 1 パス遅れ検出） */
const METRICS_SCALE_PROBE_TOLERANCE_PX = 1.5;

export function plotMetricsScalesMatchWindow(metrics: ChartPlotMetrics): boolean {
  const { scales, cartesian, timeMin, timeMax, speedMin, speedMax } = metrics;
  if (!scales) return false;
  if (timeMax <= timeMin || speedMax <= speedMin) return false;
  if (cartesian.width <= 0 || cartesian.height <= 0) return false;

  const xMin = scales.timeToX(timeMin);
  const xMax = scales.timeToX(timeMax);
  const ySpeedMin = scales.speedToY(speedMin);
  const ySpeedMax = scales.speedToY(speedMax);

  if (xMin == null || xMax == null || ySpeedMin == null || ySpeedMax == null) return false;
  if (![xMin, xMax, ySpeedMin, ySpeedMax].every(Number.isFinite)) return false;

  const plotLeft = cartesian.left;
  const plotRight = cartesian.left + cartesian.width;
  const plotTop = cartesian.top;
  const plotBottom = cartesian.top + cartesian.height;
  const tol = METRICS_SCALE_PROBE_TOLERANCE_PX;

  if (Math.abs(xMin - plotLeft) > tol) return false;
  if (Math.abs(xMax - plotRight) > tol) return false;
  // 速度軸: speedMax が上、speedMin が下
  if (Math.abs(ySpeedMax - plotTop) > tol) return false;
  if (Math.abs(ySpeedMin - plotBottom) > tol) return false;

  return true;
}

/** 保存済み metrics と新 metrics が実効同一か（setState ループ防止 + stale scales 検出） */
export function plotMetricsEquivalent(a: ChartPlotMetrics, b: ChartPlotMetrics): boolean {
  if (!chartViewStatesEqual(a.view, b.view)) return false;
  if (!visibleWindowsEqual(a, b)) return false;
  if (
    a.cartesian.left !== b.cartesian.left ||
    a.cartesian.top !== b.cartesian.top ||
    a.cartesian.width !== b.cartesian.width ||
    a.cartesian.height !== b.cartesian.height
  ) {
    return false;
  }
  if (!a.scales || !b.scales) return false;

  const tol = 1e-3;
  const pairs: [number | undefined, number | undefined][] = [
    [a.scales.timeToX(a.timeMin), b.scales.timeToX(b.timeMin)],
    [a.scales.timeToX(a.timeMax), b.scales.timeToX(b.timeMax)],
    [a.scales.speedToY(a.speedMin), b.scales.speedToY(b.speedMin)],
    [a.scales.speedToY(a.speedMax), b.scales.speedToY(b.speedMax)],
  ];
  for (const [av, bv] of pairs) {
    if (av == null || bv == null || !Number.isFinite(av) || !Number.isFinite(bv)) return false;
    if (Math.abs(av - bv) > tol) return false;
  }
  return true;
}

/** handoff（線形 fallback）と measured（Recharts scales）の座標が許容内か */
export function plotMetricsHandoffCompatible(
  handoff: ChartPlotMetrics,
  measured: ChartPlotMetrics,
): boolean {
  const tol = METRICS_SCALE_PROBE_TOLERANCE_PX;
  const samples: [number, number][] = [
    [handoff.timeMin, handoff.speedMin],
    [handoff.timeMax, handoff.speedMax],
    [handoff.timeMin, handoff.speedMax],
    [(handoff.timeMin + handoff.timeMax) / 2, (handoff.speedMin + handoff.speedMax) / 2],
  ];
  for (const [time, speed] of samples) {
    const hx = timeToSvgX(time, handoff);
    const hy = speedToSvgY(speed, handoff);
    const mx = timeToSvgX(time, measured);
    const my = speedToSvgY(speed, measured);
    if (Math.abs(hx - mx) > tol || Math.abs(hy - my) > tol) return false;
  }
  return true;
}

/** viewState から可視窓 domain を算出（パターン B: 全軸連動） */
export function visibleWindowFromViewState(
  view: ChartViewState,
  raceEnd: number,
  options: VisibleWindowOptions = {},
): VisibleWindow {
  const { scale, centerTime, centerSpeed, centerPercent } = view;
  const halfT = raceEnd / (2 * scale);
  const halfS = (SPEED_MAX - SPEED_MIN) / (2 * scale);
  const halfP = 0.5 / scale;
  const lockPercent = options.lockPercentFullRange ?? false;

  return {
    timeMin: centerTime - halfT,
    timeMax: centerTime + halfT,
    speedMin: centerSpeed - halfS,
    speedMax: centerSpeed + halfS,
    percentMin: lockPercent ? 0 : centerPercent - halfP,
    percentMax: lockPercent ? 1 : centerPercent + halfP,
  };
}

/** center を各軸の可視窓半分内に収め、scale を [1, CHART_VIEW_SCALE_MAX] に制限 */
export function clampChartViewState(view: ChartViewState, raceEnd: number): ChartViewState {
  const scale = Math.min(CHART_VIEW_SCALE_MAX, Math.max(1, view.scale));
  const halfT = raceEnd / (2 * scale);
  const halfS = (SPEED_MAX - SPEED_MIN) / (2 * scale);
  const halfP = 0.5 / scale;

  return {
    scale,
    centerTime: Math.min(raceEnd - halfT, Math.max(halfT, view.centerTime)),
    centerSpeed: Math.min(SPEED_MAX - halfS, Math.max(SPEED_MIN + halfS, view.centerSpeed)),
    centerPercent: Math.min(1 - halfP, Math.max(halfP, view.centerPercent)),
  };
}

/** カーソル下データ点を固定して scale / center を更新（時間・速度・percent 全軸） */
export function applyWheelZoom(
  view: ChartViewState,
  raceEnd: number,
  cursorTime: number,
  cursorSpeed: number,
  cursorPercent: number,
  zoomIn: boolean,
  zoomFactor = CHART_VIEW_WHEEL_ZOOM_FACTOR,
): ChartViewState {
  const k = zoomIn ? zoomFactor : 1 / zoomFactor;
  const newScale = Math.min(CHART_VIEW_SCALE_MAX, Math.max(1, view.scale * k));
  if (Math.abs(newScale - view.scale) < 1e-12) {
    return clampChartViewState(view, raceEnd);
  }

  const halfT = raceEnd / (2 * view.scale);
  const halfS = (SPEED_MAX - SPEED_MIN) / (2 * view.scale);
  const halfP = 0.5 / view.scale;
  const newHalfT = raceEnd / (2 * newScale);
  const newHalfS = (SPEED_MAX - SPEED_MIN) / (2 * newScale);
  const newHalfP = 0.5 / newScale;
  const ratioT = newHalfT / halfT;
  const ratioS = newHalfS / halfS;
  const ratioP = newHalfP / halfP;

  return clampChartViewState(
    {
      scale: newScale,
      centerTime: view.centerTime + (cursorTime - view.centerTime) * ratioT,
      centerSpeed: view.centerSpeed + (cursorSpeed - view.centerSpeed) * ratioS,
      centerPercent: view.centerPercent + (cursorPercent - view.centerPercent) * ratioP,
    },
    raceEnd,
  );
}

/** px 差分を現行可視窓に応じて centerTime / centerSpeed / centerPercent へ反映 */
export function applyPanDrag(
  view: ChartViewState,
  raceEnd: number,
  dx: number,
  dy: number,
  plotWidth: number,
  plotHeight: number,
): ChartViewState {
  const window = visibleWindowFromViewState(view, raceEnd);
  const timeSpan = window.timeMax - window.timeMin;
  const speedSpan = window.speedMax - window.speedMin;
  const percentSpan = window.percentMax - window.percentMin;
  const deltaTime = (-dx * timeSpan) / Math.max(plotWidth, 1);
  const deltaSpeed = (dy * speedSpan) / Math.max(plotHeight, 1);
  const deltaPercent = (dy * percentSpan) / Math.max(plotHeight, 1);

  return clampChartViewState(
    {
      ...view,
      centerTime: view.centerTime + deltaTime,
      centerSpeed: view.centerSpeed + deltaSpeed,
      centerPercent: view.centerPercent + deltaPercent,
    },
    raceEnd,
  );
}

/** Recharts cartesian 矩形（overlay SVG 座標系・px） */
export interface CartesianRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Recharts axis scale（Line と同一の pixel 変換） */
export interface ChartPlotScales {
  timeToX: (time: number) => number | undefined;
  speedToY: (speed: number) => number | undefined;
}

/** 座標変換の正本。cartesian は usePlotArea、scales は useXAxisScale / useYAxisScale */
export interface ChartPlotMetrics {
  cartesian: CartesianRect;
  view: ChartViewState;
  timeMin: number;
  timeMax: number;
  speedMin: number;
  speedMax: number;
  percentMin: number;
  percentMax: number;
  /** あるとき speedToSvgY / timeToSvgX の正本（Recharts と同一） */
  scales?: ChartPlotScales;
}

export function createChartPlotMetrics(
  cartesian: CartesianRect,
  window: VisibleWindow,
  view: ChartViewState,
  scales?: ChartPlotScales,
): ChartPlotMetrics {
  return {
    cartesian,
    view,
    timeMin: window.timeMin,
    timeMax: window.timeMax,
    speedMin: window.speedMin,
    speedMax: window.speedMax,
    percentMin: window.percentMin,
    percentMax: window.percentMax,
    scales,
  };
}

/** 操作中の synthetic metrics（固定 cartesian + liveView window。scales なし） */
export function buildInteractionPlotMetrics(
  cartesian: CartesianRect,
  liveView: ChartViewState,
  raceEnd: number,
): ChartPlotMetrics {
  const window = visibleWindowFromViewState(liveView, raceEnd);
  return createChartPlotMetrics(cartesian, window, liveView);
}

function timeSpan(metrics: ChartPlotMetrics): number {
  return Math.max(metrics.timeMax - metrics.timeMin, 1e-9);
}

function speedSpan(metrics: ChartPlotMetrics): number {
  return Math.max(metrics.speedMax - metrics.speedMin, 1e-9);
}

function percentSpan(metrics: ChartPlotMetrics): number {
  return Math.max(metrics.percentMax - metrics.percentMin, 1e-9);
}

/** 経過秒 → overlay SVG x（scales 優先、なければ線形フォールバック） */
export function timeToSvgX(time: number, metrics: ChartPlotMetrics): number {
  const scaled = metrics.scales?.timeToX(time);
  if (scaled != null && Number.isFinite(scaled)) return scaled;
  const t = Math.min(metrics.timeMax, Math.max(metrics.timeMin, time));
  const normalized = (t - metrics.timeMin) / timeSpan(metrics);
  return metrics.cartesian.left + normalized * metrics.cartesian.width;
}

/** 速度 m/s → overlay SVG y（scales 優先、なければ線形フォールバック） */
export function speedToSvgY(speed: number, metrics: ChartPlotMetrics): number {
  const scaled = metrics.scales?.speedToY(speed);
  if (scaled != null && Number.isFinite(scaled)) return scaled;
  const s = Math.min(metrics.speedMax, Math.max(metrics.speedMin, speed));
  const normalized = (s - metrics.speedMin) / speedSpan(metrics);
  return metrics.cartesian.top + (1 - normalized) * metrics.cartesian.height;
}

/** overlay SVG x → 経過秒（layout / ヒット判定の逆変換用） */
export function svgToTime(x: number, metrics: ChartPlotMetrics): number {
  const normalized = (x - metrics.cartesian.left) / Math.max(metrics.cartesian.width, 1e-9);
  return metrics.timeMin + normalized * timeSpan(metrics);
}

/** overlay SVG y → 速度 m/s */
export function svgToSpeed(y: number, metrics: ChartPlotMetrics): number {
  const normalized = 1 - (y - metrics.cartesian.top) / Math.max(metrics.cartesian.height, 1e-9);
  return metrics.speedMin + normalized * speedSpan(metrics);
}

/** overlay SVG y → percent 軸値（体力・レーンと同一 plot 高さ） */
export function svgToPercent(y: number, metrics: ChartPlotMetrics): number {
  const normalized = 1 - (y - metrics.cartesian.top) / Math.max(metrics.cartesian.height, 1e-9);
  return metrics.percentMin + normalized * percentSpan(metrics);
}

/** cartesian 内の相対 Y（上端 0）。speedToSvgY − cartesian.top */
export function speedToPlotY(speed: number, metrics: ChartPlotMetrics): number {
  return speedToSvgY(speed, metrics) - metrics.cartesian.top;
}

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
}

export const DEFAULT_GRAPH_DISPLAY_STATE: GraphDisplayState = {
  showSpeed: true,
  showStamina: true,
  showLane: true,
  showAreas: true,
  showSkills: true,
  showDebuffs: true,
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
/** detail stack 0: 速度折れ線と赤線の視覚合わせ（上方向が負。plot 高さ修正後は 0） */
export const SKILL_LINE_SPEED_ANCHOR_NUDGE = 0;
/** @deprecated 下帯行レイアウト用 */
export const SKILL_ROW_TOP_PAD = 4;
/** 速度点からラベル上端までのオフセット（px） */
export const SKILL_SPEED_LABEL_OFFSET = 12;
/** 衝突解決: 垂直ストラグger 1 段あたり（px） */
export const STAGGER_ROW = 14;
/** 衝突検出: X 方向ビン幅（秒） */
export const STAGGER_BIN_SECONDS = 0.4;
/** map-view の最大ストラグger段数（0..3 = 4 段） */
export const MAX_STACK_COLLAPSED = 4;
/** assignStackLevels の無限ループ防止 */
const STACK_ASSIGN_MAX_ITER = 256;
/** デバフラベル: スキル基準 Y からの追加オフセット（px） */
export const DEBUFF_Y_OFFSET = 20;

interface StackAssignOptions {
  maxTime: number;
  metrics: ChartPlotMetrics;
  points: GraphPoint[];
  /** X 重なり時は同一 stackLevel に置かない（案3）。同時刻以外の X 被りは許容 */
  xStaggerOnly?: boolean;
}
/** LineChart margin と同期（layoutSkillMarkers 用） */
export const SKILL_CHART_MARGIN_TOP = 24;
export const SKILL_CHART_MARGIN_BOTTOM = 4;
/** Recharts Legend（下部）が占有する cartesian 領域の高さ（px）— フォールバック推定のみ */
export const SKILL_CHART_LEGEND_RESERVE = 28;
/** Recharts XAxis が占有する cartesian 下端の高さ（px）— フォールバック推定のみ */
export const SKILL_CHART_XAXIS_RESERVE = 16;

/** ラベル hit box 幅（px）— layout / skillMarkersToPx 共通 */
export function estimateSkillHitWidth(label: string): number {
  return Math.max(label.length * SKILL_FONT_SIZE * 0.55, SKILL_FONT_SIZE * 2) + 4;
}

/** ラベル hit box 高さ（px） */
export const SKILL_HIT_HEIGHT = SKILL_FONT_SIZE + 4;
/** detail 同時刻スタック: hit box 間の追加 gap（px） */
export const COMPACT_STACK_GAP = 2;
/** detail 同時刻スタック: 1 段あたり（px・K 非乗算） */
export const COMPACT_STACK_STEP = SKILL_HIT_HEIGHT + COMPACT_STACK_GAP;

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

/** startTime に対応する current 速度（graphPoints.points）。Recharts type="linear" と同一の線形補間 */
export function getSpeedAtTime(points: GraphPoint[], startTime: number): number {
  if (!points.length) return SPEED_MIN;
  const exactIndex = startTime * FRAME_PER_SECOND;
  const i0 = Math.min(Math.max(Math.floor(exactIndex), 0), points.length - 1);
  const i1 = Math.min(i0 + 1, points.length - 1);
  if (i0 === i1) return points[i0]?.speed ?? SPEED_MIN;
  const t = exactIndex - i0;
  const s0 = points[i0]?.speed ?? SPEED_MIN;
  const s1 = points[i1]?.speed ?? SPEED_MIN;
  return s0 * (1 - t) + s1 * t;
}

export interface SkillLayoutOptions {
  /** 速度スナップ用 */
  points?: GraphPoint[];
  /** hit box 衝突判定用 */
  maxTime?: number;
  /** X 重なり時は同一 stackLevel に置かない（案3）。同時刻以外の X 被りは許容 */
  xStaggerOnly?: boolean;
}

interface StackLayoutInput {
  tooltipKey: string;
  label: string;
  startTime: number;
  kind: SkillEventKind;
}

function markerKindOffsetY(kind: SkillEventKind): number {
  return kind === "debuff" ? DEBUFF_Y_OFFSET : 0;
}

/** 同時刻スタック判定: 1 フレーム以内（ラベル幅による誤スタックを防ぐ） */
const SAME_TIME_STACK_EPSILON = 1 / FRAME_PER_SECOND;

function isSameTimeStack(a: number, b: number): boolean {
  return Math.abs(a - b) <= SAME_TIME_STACK_EPSILON;
}

/** SVG strokeWidth=2 向けの半ピクセル整列 */
function alignOverlayStrokeY(y: number): number {
  return Math.round(y * 2) / 2;
}

/** detail: 赤線 Y（plot 相対 px）。stack 0 は速度折れ線上 */
function markerLineY_px(
  points: GraphPoint[],
  startTime: number,
  kind: SkillEventKind,
  metrics: ChartPlotMetrics,
  yStackOffset: number,
): number {
  const speed = getSpeedAtTime(points, startTime);
  const speedY = speedToPlotY(speed, metrics);
  let lineY = speedY + yStackOffset + markerKindOffsetY(kind);
  if (yStackOffset === 0 && kind !== "debuff") {
    lineY += SKILL_LINE_SPEED_ANCHOR_NUDGE;
  }
  return alignOverlayStrokeY(lineY);
}

/** detail: ラベル hit box 上端 Y（衝突判定用・赤線の上） */
function markerDetailLabelTopY_px(
  points: GraphPoint[],
  startTime: number,
  kind: SkillEventKind,
  metrics: ChartPlotMetrics,
  yStackOffset: number,
  lineOffsetPx: number,
): number {
  const lineY = markerLineY_px(points, startTime, kind, metrics, yStackOffset);
  return lineY - lineOffsetPx - SKILL_HIT_HEIGHT;
}

/** detail: ラベル描画上端 Y（フォント基準・赤線の上。lineY に offset 済み） */
function markerDetailLabelVisualTopY_px(lineY: number): number {
  return lineY - SKILL_LINE_GAP - SKILL_FONT_SIZE;
}

/** blocker の直上に置く段ステップ（compact / full） */
function stackStepAboveBlocker(
  capped: number,
  blocker: {
    startTime: number;
    stackLevel: number;
    yStackOffset: number;
    kind: SkillEventKind;
  },
  item: StackLayoutInput,
  points: GraphPoint[],
  metrics: ChartPlotMetrics,
  lineOffsetPx: number,
): number {
  if (capped === blocker.stackLevel) return COMPACT_STACK_STEP;

  const blockerLabelTop = markerDetailLabelTopY_px(
    points,
    blocker.startTime,
    blocker.kind,
    metrics,
    blocker.yStackOffset,
    lineOffsetPx,
  );
  const blockerLabelBottom = blockerLabelTop + SKILL_HIT_HEIGHT;
  const candidateOffset = blocker.yStackOffset + COMPACT_STACK_STEP;
  const itemLabelTop = markerDetailLabelTopY_px(
    points,
    item.startTime,
    item.kind,
    metrics,
    candidateOffset,
    lineOffsetPx,
  );
  const itemLabelBottom = itemLabelTop + SKILL_HIT_HEIGHT;
  const yOverlapWithCompact =
    itemLabelTop < blockerLabelBottom && itemLabelBottom > blockerLabelTop;

  if (yOverlapWithCompact) return STAGGER_ROW;
  return COMPACT_STACK_STEP;
}

/** X+Y hit box 重なりで stackLevel / yStackOffset を付与 */
function assignStackLevels(
  items: StackLayoutInput[],
  options: StackAssignOptions,
): { stackLevels: Map<string, number>; yStackOffsets: Map<string, number>; maxStack: number } {
  const {
    maxTime,
    metrics,
    points,
    xStaggerOnly = false,
  } = options;
  const plotWidth = metrics.cartesian.width;
  const plotHeight = metrics.cartesian.height;
  const stackLevels = new Map<string, number>();
  const yStackOffsets = new Map<string, number>();
  let maxStack = 0;

  if (!items.length || maxTime <= 0 || plotWidth <= 0 || plotHeight <= 0) {
    return { stackLevels, yStackOffsets, maxStack };
  }

  const sorted = [...items].sort(
    (a, b) => a.startTime - b.startTime || a.tooltipKey.localeCompare(b.tooltipKey),
  );
  const placed: {
    startTime: number;
    hitWidthTime: number;
    stackLevel: number;
    yStackOffset: number;
    kind: SkillEventKind;
  }[] = [];

  const hitHeight = SKILL_HIT_HEIGHT;
  const lineOffsetPx = SKILL_FONT_SIZE + SKILL_LINE_GAP - SKILL_LINE_Y_NUDGE_UP;

  for (const item of sorted) {
    const hitWidthPx = estimateSkillHitWidth(item.label);
    const hitWidthTime = (hitWidthPx / plotWidth) * maxTime;
    let stackLevel = 0;

    for (;;) {
      const capped = Math.min(stackLevel, MAX_STACK_COLLAPSED - 1);
      if (stackLevel >= STACK_ASSIGN_MAX_ITER) {
        stackLevels.set(item.tooltipKey, capped);
        yStackOffsets.set(item.tooltipKey, 0);
        placed.push({
          startTime: item.startTime,
          hitWidthTime,
          stackLevel: capped,
          yStackOffset: 0,
          kind: item.kind,
        });
        maxStack = Math.max(maxStack, capped);
        break;
      }

      const yStackOffset = placed.reduce((maxOffset, p) => {
        if (!isSameTimeStack(item.startTime, p.startTime)) return maxOffset;
        const step = stackStepAboveBlocker(
          capped,
          p,
          item,
          points,
          metrics,
          lineOffsetPx,
        );
        return Math.max(maxOffset, p.yStackOffset + step);
      }, 0);

      const yTop = markerDetailLabelTopY_px(
        points,
        item.startTime,
        item.kind,
        metrics,
        yStackOffset,
        lineOffsetPx,
      );
      const yBottom = yTop + hitHeight;
      const startX = item.startTime;
      const endX = startX + hitWidthTime;

      const overlaps = placed.some((p) => {
        if (xStaggerOnly && !isSameTimeStack(item.startTime, p.startTime)) {
          return false;
        }

        const pYTop = markerDetailLabelTopY_px(
          points,
          p.startTime,
          p.kind,
          metrics,
          p.yStackOffset,
          lineOffsetPx,
        );
        const pYBottom = pYTop + hitHeight;
        const pStart = p.startTime;
        const pEnd = p.startTime + p.hitWidthTime;
        const xOverlap = xStaggerOnly
          ? isSameTimeStack(item.startTime, p.startTime)
          : startX < pEnd && endX > pStart;
        const yOverlap = yTop < pYBottom && yBottom > pYTop;
        if (xStaggerOnly) {
          if (!xOverlap) return false;
          return yOverlap || capped === p.stackLevel;
        }
        return xOverlap && yOverlap;
      });

      if (!overlaps) {
        stackLevels.set(item.tooltipKey, capped);
        yStackOffsets.set(item.tooltipKey, yStackOffset);
        placed.push({
          startTime: item.startTime,
          hitWidthTime,
          stackLevel: capped,
          yStackOffset,
          kind: item.kind,
        });
        maxStack = Math.max(maxStack, capped);
        break;
      }

      stackLevel += 1;
      if (stackLevel >= MAX_STACK_COLLAPSED) {
        const cappedOverflow = MAX_STACK_COLLAPSED - 1;
        stackLevels.set(item.tooltipKey, cappedOverflow);
        yStackOffsets.set(item.tooltipKey, 0);
        placed.push({
          startTime: item.startTime,
          hitWidthTime,
          stackLevel: cappedOverflow,
          yStackOffset: 0,
          kind: item.kind,
        });
        maxStack = Math.max(maxStack, cappedOverflow);
        break;
      }
    }
  }

  return { stackLevels, yStackOffsets, maxStack };
}

/** 速度スナップ + 赤線アンカー + 同時刻 compact で percent 軸 y / lineY を確定 */
export function layoutSkillMarkers(
  markers: SkillMarker[],
  metrics: ChartPlotMetrics,
  options: SkillLayoutOptions = {},
): SkillMarker[] {
  const {
    points = [],
    maxTime = 0,
    xStaggerOnly: xStaggerOnlyOpt,
  } = options;

  const xStaggerOnly = xStaggerOnlyOpt ?? true;
  const speedPlotHeight = metrics.cartesian.height;
  const plotWidth = metrics.cartesian.width;
  const domainPlotHeight = speedPlotHeight;
  if (speedPlotHeight <= 0 || plotWidth <= 0 || markers.length === 0) return markers;

  const effectiveMaxTime =
    maxTime > 0
      ? maxTime
      : points.length > 0
        ? points[points.length - 1].time
        : Math.max(...markers.map((m) => m.endTime), 1);

  const { stackLevels, yStackOffsets } = assignStackLevels(
    markers.map((m) => ({
      tooltipKey: m.tooltipKey,
      label: m.label,
      startTime: m.startTime,
      kind: m.kind,
    })),
    {
      maxTime: effectiveMaxTime,
      metrics,
      points,
      xStaggerOnly,
    },
  );

  return markers.map((marker) => {
    const stackLevel = stackLevels.get(marker.tooltipKey) ?? marker.stackLevel ?? 0;
    const yStackOffset = yStackOffsets.get(marker.tooltipKey) ?? 0;

    const lineTopPx = markerLineY_px(
      points,
      marker.startTime,
      marker.kind,
      metrics,
      yStackOffset,
    );
    const labelTopPx = markerDetailLabelVisualTopY_px(lineTopPx);

    return {
      ...marker,
      stackLevel,
      row: stackLevel,
      y: 1 - labelTopPx / domainPlotHeight,
      lineY: 1 - lineTopPx / domainPlotHeight,
    };
  });
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
 * layoutSkillMarkers の domain 座標を overlay SVG ピクセル座標に変換する（ChartPlotMetrics 経由）
 */
export function skillMarkersToPx(
  markers: SkillMarker[],
  metrics: ChartPlotMetrics,
): SkillMarkerPx[] {
  const { cartesian, timeMax, timeMin } = metrics;
  if (
    !markers.length ||
    timeMax <= timeMin ||
    cartesian.width <= 0 ||
    cartesian.height <= 0
  ) {
    return [];
  }

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
      startX: timeToSvgX(m.startTime, metrics),
      endX: timeToSvgX(m.endTime, metrics),
      labelY: cartesian.top + (1 - m.y) * cartesian.height,
      lineY: cartesian.top + (1 - m.lineY) * cartesian.height,
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
): { skillMarkers: SkillMarker[] } {
  if (!skillEvents?.length) {
    return { skillMarkers: [] };
  }

  const filtered = skillEvents
    .filter((event) => (event.kind === "debuff" ? displayState.showDebuffs : displayState.showSkills))
    .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);

  if (!filtered.length) {
    return { skillMarkers: [] };
  }

  const frames = detail?.frames ?? [];
  const courseLength = detail?.courseLength ?? 0;

  const skillMarkers: SkillMarker[] = filtered.map((event, index) => {
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

  return { skillMarkers };
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
    };
  }

  const { points, phaseLines, staminaMax, areaBands } = buildRaceGraphPoints(detail);
  const { skillMarkers } = buildSkillMarkers(detail.skillEvents, displayState, detail);

  return { points, phaseLines, staminaMax, areaBands, skillMarkers };
}
