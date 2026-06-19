import { curveMonotoneX, line } from "d3-shape";
import type {
  CartesianRect,
  GraphDisplayState,
  GraphPoint,
  SkillMarker,
  VisibleWindow,
} from "./raceGraphBuilder";
import { getSpeedAtTime } from "./raceGraphBuilder";

/** Canvas 描画コンテキスト（論理 px。DPR は resizeCanvasToDisplaySize で ctx スケール済み想定） */
export interface ChartLineRenderContext {
  ctx: CanvasRenderingContext2D;
  cartesian: CartesianRect;
  window: VisibleWindow;
}

export type ChartLineYAxis = "speed" | "percent";

export type ChartLineInterpolation = "linear" | "monotone";

export interface ChartLineSeriesSpec {
  /** GraphPoint のキー（baseline* 含む） */
  dataKey: keyof GraphPoint;
  yAxis: ChartLineYAxis;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  strokeOpacity?: number;
  interpolation: ChartLineInterpolation;
  visible: boolean;
}

export interface DrawChartLinesOptions {
  displayState: GraphDisplayState;
  showBaseline: boolean;
  /** RaceDetailChart と同色定数を渡す */
  colors: {
    speed: string;
    stamina: string;
    lane: string;
    baselineOpacity: number;
  };
}

export interface DrawSkillActivationDotsOptions {
  displayState: GraphDisplayState;
  /** buildSkillMarkers 出力（layoutSkillMarkers 前） */
  markers: Pick<SkillMarker, "startTime" | "labelColor" | "kind">[];
  /** 丸の半径（CSS px。DPR スケール済み ctx 上） */
  radius?: number;
}

export const SKILL_ACTIVATION_DOT_RADIUS = 2.5;

function timeSpan(window: VisibleWindow): number {
  return Math.max(window.timeMax - window.timeMin, 1e-9);
}

function speedSpan(window: VisibleWindow): number {
  return Math.max(window.speedMax - window.speedMin, 1e-9);
}

function percentSpan(window: VisibleWindow): number {
  return Math.max(window.percentMax - window.percentMin, 1e-9);
}

/** データ座標 → Canvas ピクセル X（cartesian 内。クリップ前提） */
export function timeToCanvasX(
  time: number,
  window: VisibleWindow,
  cartesian: CartesianRect,
): number {
  const t = Math.min(window.timeMax, Math.max(window.timeMin, time));
  const normalized = (t - window.timeMin) / timeSpan(window);
  return cartesian.left + normalized * cartesian.width;
}

/** 速度 m/s → Canvas ピクセル Y */
export function speedToCanvasY(
  speed: number,
  window: VisibleWindow,
  cartesian: CartesianRect,
): number {
  const s = Math.min(window.speedMax, Math.max(window.speedMin, speed));
  const normalized = (s - window.speedMin) / speedSpan(window);
  return cartesian.top + (1 - normalized) * cartesian.height;
}

/** percent 軸値 → Canvas ピクセル Y */
export function percentValueToCanvasY(
  value: number,
  window: VisibleWindow,
  cartesian: CartesianRect,
): number {
  const p = Math.min(window.percentMax, Math.max(window.percentMin, value));
  const normalized = (p - window.percentMin) / percentSpan(window);
  return cartesian.top + (1 - normalized) * cartesian.height;
}

function valueToCanvasY(
  value: number,
  yAxis: ChartLineYAxis,
  window: VisibleWindow,
  cartesian: CartesianRect,
): number {
  return yAxis === "speed"
    ? speedToCanvasY(value, window, cartesian)
    : percentValueToCanvasY(value, window, cartesian);
}

function getSeriesValue(point: GraphPoint, dataKey: keyof GraphPoint): number | undefined {
  const value = point[dataKey];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function applySeriesStrokeStyle(ctx: CanvasRenderingContext2D, spec: ChartLineSeriesSpec): void {
  ctx.strokeStyle = spec.stroke;
  ctx.lineWidth = spec.strokeWidth;
  ctx.globalAlpha = spec.strokeOpacity ?? 1;
  if (spec.strokeDasharray) {
    const dash = spec.strokeDasharray
      .split(/[\s,]+/)
      .map((part) => Number(part))
      .filter((n) => Number.isFinite(n));
    ctx.setLineDash(dash.length > 0 ? dash : []);
  } else {
    ctx.setLineDash([]);
  }
}

function withCartesianClip(
  ctx: CanvasRenderingContext2D,
  cartesian: CartesianRect,
  draw: () => void,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(cartesian.left, cartesian.top, cartesian.width, cartesian.height);
  ctx.clip();
  draw();
  ctx.restore();
}

function drawLinearSeries(
  ctx: CanvasRenderingContext2D,
  coords: { x: number; y: number }[],
): void {
  if (coords.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);
  for (let i = 1; i < coords.length; i += 1) {
    ctx.lineTo(coords[i].x, coords[i].y);
  }
  ctx.stroke();
}

function drawMonotoneSeries(
  ctx: CanvasRenderingContext2D,
  coords: { x: number; y: number }[],
): void {
  if (coords.length === 0) return;
  const pathGenerator = line<{ x: number; y: number }>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(curveMonotoneX);
  const pathData = pathGenerator(coords);
  if (!pathData) return;
  const path = new Path2D(pathData);
  ctx.stroke(path);
}

/** 1 系列を描画（可視窓外は clip で切る） */
export function drawChartLineSeries(
  renderCtx: ChartLineRenderContext,
  points: GraphPoint[],
  spec: ChartLineSeriesSpec,
): void {
  if (!spec.visible || points.length === 0) return;

  const { ctx, cartesian, window } = renderCtx;
  const coords: { x: number; y: number }[] = [];

  for (const point of points) {
    const value = getSeriesValue(point, spec.dataKey);
    if (value == null) continue;
    coords.push({
      x: timeToCanvasX(point.time, window, cartesian),
      y: valueToCanvasY(value, spec.yAxis, window, cartesian),
    });
  }

  if (coords.length === 0) return;

  withCartesianClip(ctx, cartesian, () => {
    const prevAlpha = ctx.globalAlpha;
    const prevDash = ctx.getLineDash();
    applySeriesStrokeStyle(ctx, spec);
    if (spec.interpolation === "monotone") {
      drawMonotoneSeries(ctx, coords);
    } else {
      drawLinearSeries(ctx, coords);
    }
    ctx.globalAlpha = prevAlpha;
    ctx.setLineDash(prevDash);
  });
}

function buildChartLineSeriesSpecs(options: DrawChartLinesOptions): ChartLineSeriesSpec[] {
  const { displayState, showBaseline, colors } = options;
  const specs: ChartLineSeriesSpec[] = [];

  if (displayState.showSpeed) {
    specs.push({
      dataKey: "speed",
      yAxis: "speed",
      stroke: colors.speed,
      strokeWidth: 2,
      interpolation: "linear",
      visible: true,
    });
  }
  if (displayState.showStamina) {
    specs.push({
      dataKey: "stamina",
      yAxis: "percent",
      stroke: colors.stamina,
      strokeWidth: 2,
      interpolation: "monotone",
      visible: true,
    });
  }
  if (displayState.showLane) {
    specs.push({
      dataKey: "lane",
      yAxis: "percent",
      stroke: colors.lane,
      strokeWidth: 2,
      interpolation: "monotone",
      visible: true,
    });
  }

  if (!showBaseline) return specs;

  if (displayState.showSpeed) {
    specs.push({
      dataKey: "baselineSpeed",
      yAxis: "speed",
      stroke: colors.speed,
      strokeWidth: 2,
      strokeDasharray: "6 4",
      strokeOpacity: colors.baselineOpacity,
      interpolation: "linear",
      visible: true,
    });
  }
  if (displayState.showStamina) {
    specs.push({
      dataKey: "baselineStamina",
      yAxis: "percent",
      stroke: colors.stamina,
      strokeWidth: 2,
      strokeDasharray: "6 4",
      strokeOpacity: colors.baselineOpacity,
      interpolation: "monotone",
      visible: true,
    });
  }
  if (displayState.showLane) {
    specs.push({
      dataKey: "baselineLane",
      yAxis: "percent",
      stroke: colors.lane,
      strokeWidth: 2,
      strokeDasharray: "6 4",
      strokeOpacity: colors.baselineOpacity,
      interpolation: "monotone",
      visible: true,
    });
  }

  return specs;
}

/** 速度・体力・レーン（+ baseline）を一括描画 */
export function drawChartLines(
  renderCtx: ChartLineRenderContext,
  points: GraphPoint[],
  options: DrawChartLinesOptions,
): void {
  const specs = buildChartLineSeriesSpecs(options);
  for (const spec of specs) {
    drawChartLineSeries(renderCtx, points, spec);
  }
}

function markerVisible(
  kind: SkillMarker["kind"],
  displayState: GraphDisplayState,
): boolean {
  return kind === "debuff" ? displayState.showDebuffs : displayState.showSkills;
}

/** 速度折れ線上にスキル発動点の小丸を描画（Phase 3 で Canvas rAF から呼ぶ） */
export function drawSkillActivationDots(
  renderCtx: ChartLineRenderContext,
  points: GraphPoint[],
  options: DrawSkillActivationDotsOptions,
): void {
  const { displayState, markers, radius = SKILL_ACTIVATION_DOT_RADIUS } = options;
  if (!markers.length || points.length === 0) return;
  if (!displayState.showSkills && !displayState.showDebuffs) return;

  const { ctx, cartesian, window } = renderCtx;

  withCartesianClip(ctx, cartesian, () => {
    const prevAlpha = ctx.globalAlpha;
    ctx.setLineDash([]);

    for (const marker of markers) {
      if (!markerVisible(marker.kind, displayState)) continue;

      const speed = getSpeedAtTime(points, marker.startTime);
      const x = timeToCanvasX(marker.startTime, window, cartesian);
      const y = speedToCanvasY(speed, window, cartesian);

      ctx.beginPath();
      ctx.fillStyle = marker.labelColor;
      ctx.globalAlpha = 1;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = prevAlpha;
  });
}

/** Canvas の bitmap サイズを DPR に合わせる（width/height は CSS px） */
export function resizeCanvasToDisplaySize(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
): { width: number; height: number; dpr: number } {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const bitmapWidth = Math.max(1, Math.round(cssWidth * dpr));
  const bitmapHeight = Math.max(1, Math.round(cssHeight * dpr));

  if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
    canvas.width = bitmapWidth;
    canvas.height = bitmapHeight;
  }

  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return { width: cssWidth, height: cssHeight, dpr };
}
