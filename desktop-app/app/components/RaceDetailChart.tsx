"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from "recharts";
import { RaceDetailDump } from "../lib/types";
import {
  buildRaceGraphPoints,
  buildSkillMarkers,
  computeDetailYZoomFactor,
  DETAIL_ZOOM_PROBE_MAX,
  probeUncappedDetailYZoomMin,
  computeZoomedChartHeight,
  DEFAULT_GRAPH_DISPLAY_STATE,
  GraphDisplayState,
  GraphPoint,
  layoutSkillMarkers,
  mergeBaselineGraphPoints,
  skillMarkersToPx,
  SkillMarkerPx,
  SKILL_CHART_BASE_HEIGHT,
  SKILL_CHART_MARGIN_BOTTOM,
  SKILL_CHART_MARGIN_TOP,
  SKILL_FONT_SIZE,
  OVERLAY_MARGIN_LEFT,
  OVERLAY_MARGIN_RIGHT,
  SPEED_MIN,
  SPEED_MAX,
  STAMINA_PLOT_FLOOR,
} from "../lib/raceGraphBuilder";

interface RaceDetailChartProps {
  detail: RaceDetailDump;
  /** 比較モード時の baseline raceDetail（キャッシュ） */
  baselineDetail?: RaceDetailDump | null;
  /** true のとき baseline 破線を重ね描画 */
  compareActive?: boolean;
}

const formatTime = (seconds: number) => `${seconds.toFixed(1)}秒`;

/** 体力折れ線と同じ色 */
const STAMINA_LINE_COLOR = "#ef4444";
const SPEED_LINE_COLOR = "#3b82f6";
const LANE_LINE_COLOR = "#22c55e";
/** baseline 破線の不透明度 */
const BASELINE_LINE_OPACITY = 0.5;

/** 本家 GraphOutput.kt: スキル発動区間の水平線 */
const SKILL_DURATION_LINE_COLOR = "#ef4444";
const DEBUFF_DURATION_LINE_COLOR = "#a78bfa";

/** 右軸: 体力0のプロット位置に「0」目盛を挿入 */
const PERCENT_AXIS_TICKS = [0, STAMINA_PLOT_FLOOR, 0.25, 0.5, 0.75, 1];

/** Tooltip をカーソル付近（やや上）に表示し、折れ線への被りを減らす */
const TOOLTIP_Y_OFFSET = 70;
/** ツールチップ枠の概算高さ（3 系列 + ラベル） */
const TOOLTIP_APPROX_HEIGHT = 90;
const TOOLTIP_EDGE_GAP = 8;

/** スキル Tooltip をカーソル付近に表示 */
const SKILL_TOOLTIP_X_OFFSET = 12;
const SKILL_TOOLTIP_Y_OFFSET = 8;
/** スキル Tooltip 枠の概算高さ */
const SKILL_TOOLTIP_APPROX_HEIGHT = 120;

/** hover ピル・グローのフェード（ms）— 親 g の opacity でアニメ */
const SKILL_HOVER_FADE_MS = 240;
const SKILL_PILL_GLOW_EXPAND = 3;

/** ピル・グローは全スキル共通アクセント（テキストのみレアリティ色） */
const SKILL_HOVER_PILL_STYLE = {
  skill: {
    glow: "#60a5fa",
    fill: "#18181b",
    fillOpacity: 0.88,
    stroke: "#93c5fd",
    strokeOpacity: 0.7,
    glowFillOpacity: 0.55,
  },
  debuff: {
    glow: "#a78bfa",
    fill: "#18181b",
    fillOpacity: 0.88,
    stroke: "#c4b5fd",
    strokeOpacity: 0.7,
    glowFillOpacity: 0.5,
  },
} as const;

function getSkillPillLayout(
  marker: SkillMarkerPx,
  textWidths: Record<string, number>,
): { pillWidth: number; pillHeight: number; pillY: number; pillRx: number } {
  const measured = textWidths[marker.tooltipKey];
  const pillWidth =
    measured ?? Math.max(marker.hitWidth, SKILL_FONT_SIZE);
  const pillHeight = marker.hitHeight;
  const pillY = marker.labelY - 2;
  const pillRx = pillHeight / 2;
  return { pillWidth, pillHeight, pillY, pillRx };
}

const SkillTooltipPortal: React.FC<{
  clientX: number;
  clientY: number;
  effectText: string;
}> = ({ clientX, clientY, effectText }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !effectText) return null;

  const maxY = typeof window !== "undefined" ? window.innerHeight - SKILL_TOOLTIP_APPROX_HEIGHT - TOOLTIP_EDGE_GAP : clientY;
  const top = Math.min(clientY + SKILL_TOOLTIP_Y_OFFSET, maxY);

  return createPortal(
    <div
      className="pointer-events-none fixed z-[1001] max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 shadow-lg"
      style={{ left: clientX + SKILL_TOOLTIP_X_OFFSET, top }}
    >
      {effectText.split("\n").map((line, index) => (
        <div key={index} className={index > 0 ? "mt-0.5" : undefined}>
          {line}
        </div>
      ))}
    </div>,
    document.body,
  );
};

const DISPLAY_CHECKBOXES: { key: keyof GraphDisplayState; label: string }[] = [
  { key: "showSpeed", label: "速度" },
  { key: "showStamina", label: "体力" },
  { key: "showLane", label: "レーン" },
  { key: "showAreas", label: "区間" },
  { key: "showSkills", label: "スキル" },
  { key: "showDebuffs", label: "デバフ" },
  { key: "expandSkillRows", label: "縦拡大" },
];

/** checkbox 状態と同期する系列 Legend（クリック無効・正本は checkbox） */
const SERIES_LEGEND_ITEMS: {
  stateKey: keyof GraphDisplayState;
  label: string;
  color: string;
}[] = [
  { stateKey: "showSpeed", label: "速度", color: "#3b82f6" },
  { stateKey: "showStamina", label: "体力", color: STAMINA_LINE_COLOR },
  { stateKey: "showLane", label: "走行レーン", color: "#22c55e" },
];

const SyncedChartLegend: React.FC<{
  displayState: GraphDisplayState;
  compareActive?: boolean;
}> = ({ displayState, compareActive = false }) => (
  <ul className="m-0 flex list-none flex-wrap justify-center gap-x-4 gap-y-1 p-0 pt-1 text-xs">
    {SERIES_LEGEND_ITEMS.map(({ stateKey, label, color }) => {
      const visible = displayState[stateKey];
      return (
        <li
          key={stateKey}
          className="inline-flex items-center gap-1.5"
          style={{ opacity: visible ? 1 : 0.4 }}
        >
          <span
            className="inline-block h-0.5 w-3.5 shrink-0"
            style={{
              backgroundColor: color,
              textDecoration: visible ? undefined : "line-through",
            }}
          />
          <span
            className={visible ? "text-zinc-200" : "text-zinc-500 line-through"}
          >
            {label}
          </span>
        </li>
      );
    })}
    {compareActive && (
      <li className="inline-flex items-center gap-1.5 text-zinc-400">
        <span
          className="inline-block h-0 w-3.5 shrink-0 border-t-2 border-dashed border-zinc-400"
          style={{ opacity: BASELINE_LINE_OPACITY }}
        />
        <span>初期構成（破線）</span>
      </li>
    )}
  </ul>
);

const renderPercentAxisTick = (props: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: number };
}) => {
  const x = typeof props.x === "number" ? props.x : Number(props.x ?? 0);
  const y = typeof props.y === "number" ? props.y : Number(props.y ?? 0);
  const { payload } = props;
  const value = payload?.value ?? 0;
  const isStaminaZero = Math.abs(value - STAMINA_PLOT_FLOOR) < 1e-6;
  const label = isStaminaZero ? "0" : `${(value * 100).toFixed(0)}%`;
  const fill = isStaminaZero ? STAMINA_LINE_COLOR : "#71717a";

  return (
    <text x={x} y={y} dy={4} textAnchor="start" fill={fill} fontSize={11}>
      {label}
    </text>
  );
};

const RaceDetailChartInner: React.FC<RaceDetailChartProps> = ({
  detail,
  baselineDetail,
  compareActive = false,
}) => {
  const [displayState, setDisplayState] = useState<GraphDisplayState>(DEFAULT_GRAPH_DISPLAY_STATE);
  const [hoveredSkillKey, setHoveredSkillKey] = useState<string | null>(null);
  const [skillTooltipPos, setSkillTooltipPos] = useState({ clientX: 0, clientY: 0 });

  const showBaselineOverlay =
    compareActive && baselineDetail != null && baselineDetail !== detail;

  /** detail + baselineDetail 固定部分 — displayState 変更で再計算しない */
  const graphPoints = useMemo(() => {
    const current = buildRaceGraphPoints(detail);
    if (!showBaselineOverlay) return current;
    return mergeBaselineGraphPoints(current, baselineDetail);
  }, [detail, baselineDetail, showBaselineOverlay]);

  /** displayState 依存部分（スキル/デバフ表示フィルタ）— checkbox トグル時のみ再計算 */
  const skillData = useMemo(
    () => buildSkillMarkers(detail.skillEvents, displayState, detail, graphPoints),
    [detail, displayState, graphPoints],
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  /** scroll コンテナの可視高さ — LineChart は ON/OFF 共通でこれに合わせる */
  const [viewportHeight, setViewportHeight] = useState(SKILL_CHART_BASE_HEIGHT);
  const [measuredWidth, setMeasuredWidth] = useState(800);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (height > 0) setViewportHeight(height);
      if (width > 0) setMeasuredWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isExpanded = displayState.expandSkillRows && skillData.skillMarkers.length > 0;
  const maxTime =
    graphPoints.points.length > 0 ? graphPoints.points[graphPoints.points.length - 1].time : 0;
  const overlayPlotWidth = Math.max(measuredWidth - OVERLAY_MARGIN_LEFT - OVERLAY_MARGIN_RIGHT, 1);
  const hasDebuffMarkers = skillData.skillMarkers.some((m) => m.kind === "debuff");
  const viewportChartHeight = Math.max(viewportHeight, 1);
  const viewportPlotHeight = Math.max(
    viewportChartHeight - SKILL_CHART_MARGIN_TOP - SKILL_CHART_MARGIN_BOTTOM,
    1,
  );
  const detailYZoom = useMemo(() => {
    if (!isExpanded) {
      return { yZoomFactor: 1 as number, source: null as null };
    }
    return computeDetailYZoomFactor({
      markers: skillData.skillMarkers,
      viewportPlotHeight,
      maxTime,
      plotWidth: overlayPlotWidth,
      points: graphPoints.points,
      hasDebuff: hasDebuffMarkers,
    });
  }, [
    isExpanded,
    skillData.skillMarkers,
    viewportPlotHeight,
    maxTime,
    overlayPlotWidth,
    graphPoints.points,
    hasDebuffMarkers,
  ]);
  const yZoomFactor = detailYZoom.yZoomFactor;
  const detailYZoomParams = useMemo(
    () => ({
      markers: skillData.skillMarkers,
      viewportPlotHeight,
      maxTime,
      plotWidth: overlayPlotWidth,
      points: graphPoints.points,
      hasDebuff: hasDebuffMarkers,
    }),
    [
      skillData.skillMarkers,
      viewportPlotHeight,
      maxTime,
      overlayPlotWidth,
      graphPoints.points,
      hasDebuffMarkers,
    ],
  );
  const uncappedNeedK = useMemo(() => {
    if (process.env.NODE_ENV !== "development" || !isExpanded || detailYZoom.source !== "cap") {
      return undefined;
    }
    return probeUncappedDetailYZoomMin(detailYZoomParams);
  }, [isExpanded, detailYZoom.source, detailYZoomParams]);
  const contentChartHeight = isExpanded
    ? computeZoomedChartHeight(viewportChartHeight, yZoomFactor)
    : viewportChartHeight;
  const contentPlotHeight = viewportPlotHeight * yZoomFactor;
  const skillMarkers = useMemo(
    () =>
      layoutSkillMarkers(skillData.skillMarkers, contentChartHeight, {
        expanded: isExpanded,
        points: graphPoints.points,
        speedPlotHeight: contentPlotHeight,
        yZoomFactor,
        maxTime,
        plotWidth: overlayPlotWidth,
      }),
    [
      skillData.skillMarkers,
      contentChartHeight,
      isExpanded,
      graphPoints.points,
      contentPlotHeight,
      yZoomFactor,
      maxTime,
      overlayPlotWidth,
    ],
  );

  /** overlay 用ピクセル座標。スキル表示 OFF または markers なしのときは空配列 */
  const showSkillOverlay =
    (displayState.showSkills || displayState.showDebuffs) && skillMarkers.length > 0;
  const skillMarkersPx = useMemo(
    () =>
      showSkillOverlay
        ? skillMarkersToPx(skillMarkers, contentChartHeight, measuredWidth, maxTime)
        : [],
    [showSkillOverlay, skillMarkers, contentChartHeight, measuredWidth, maxTime],
  );

  /** 密集時: hover 対象を SVG 末尾へ（z-order 最前面） */
  const orderedSkillMarkersPx = useMemo(() => {
    if (!hoveredSkillKey) return skillMarkersPx;
    const rest = skillMarkersPx.filter((m) => m.tooltipKey !== hoveredSkillKey);
    const hovered = skillMarkersPx.filter((m) => m.tooltipKey === hoveredSkillKey);
    return [...rest, ...hovered];
  }, [skillMarkersPx, hoveredSkillKey]);

  const labelTextRefs = useRef<Map<string, SVGTextElement>>(new Map());
  const [labelTextWidths, setLabelTextWidths] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    if (!showSkillOverlay || skillMarkersPx.length === 0) {
      setLabelTextWidths({});
      return;
    }

    const next: Record<string, number> = {};
    for (const m of skillMarkersPx) {
      const node = labelTextRefs.current.get(m.tooltipKey);
      if (!node) continue;
      try {
        const { width } = node.getBBox();
        if (width > 0) next[m.tooltipKey] = width;
      } catch {
        // 未描画時はスキップ
      }
    }

    setLabelTextWidths((prev) => {
      const keys = Object.keys(next);
      if (keys.length === 0) return prev;
      const unchanged =
        keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === next[k]);
      return unchanged ? prev : next;
    });
  }, [showSkillOverlay, skillMarkersPx, contentChartHeight, measuredWidth, isExpanded]);

  const hoveredSkillMarker = useMemo(
    () => skillMarkersPx.find((m) => m.tooltipKey === hoveredSkillKey) ?? null,
    [skillMarkersPx, hoveredSkillKey],
  );

  const handleSkillLabelEnter = useCallback(
    (marker: SkillMarkerPx) => (event: React.MouseEvent) => {
      setHoveredSkillKey(marker.tooltipKey);
      setSkillTooltipPos({ clientX: event.clientX, clientY: event.clientY });
    },
    [],
  );

  const handleSkillLabelMove = useCallback((event: React.MouseEvent) => {
    setSkillTooltipPos({ clientX: event.clientX, clientY: event.clientY });
  }, []);

  const handleSkillLabelLeave = useCallback(() => {
    setHoveredSkillKey(null);
  }, []);

  /** 折れ線 Tooltip は LineChart plot 内に収める */
  const tooltipPlotHeight = isExpanded ? contentPlotHeight : viewportPlotHeight;
  const getTooltipPosition = useCallback(
    ({ x, y }: { x: number; y: number }) => {
      if (y + TOOLTIP_EDGE_GAP > tooltipPlotHeight - TOOLTIP_APPROX_HEIGHT) {
        return { x, y: Math.max(TOOLTIP_EDGE_GAP, y - TOOLTIP_APPROX_HEIGHT - TOOLTIP_EDGE_GAP) };
      }
      if (y - TOOLTIP_Y_OFFSET < TOOLTIP_EDGE_GAP) {
        return { x, y: y + TOOLTIP_EDGE_GAP };
      }
      return { x, y: y - TOOLTIP_Y_OFFSET };
    },
    [tooltipPlotHeight],
  );

  const toggleDisplay = (key: keyof GraphDisplayState) => {
    setDisplayState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (graphPoints.points.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-sm text-zinc-500">グラフデータがありません</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col">
      <div
        ref={scrollContainerRef}
        className={`race-detail-chart relative min-h-0 flex-1 overflow-x-hidden outline-none ${
          isExpanded
            ? "overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
            : "overflow-y-hidden"
        }`}
        tabIndex={-1}
      >
        <div
          ref={chartAreaRef}
          className="relative w-full overflow-hidden"
          style={{ height: isExpanded ? contentChartHeight : "100%" }}
        >
          <ResponsiveContainer
            width="100%"
            height={isExpanded ? contentChartHeight : "100%"}
            minWidth={0}
            initialDimension={{
              width: 800,
              height: Math.max(contentChartHeight, SKILL_CHART_BASE_HEIGHT),
            }}
          >
            <LineChart data={graphPoints.points} margin={{ top: 24, right: 48, left: 4, bottom: 4 }}>
              {displayState.showAreas &&
                graphPoints.areaBands.map((band, index) => (
                  <React.Fragment key={`area-${index}`}>
                    <ReferenceArea
                      x1={band.x1}
                      x2={band.x2}
                      y1={band.y1}
                      y2={band.y2}
                      yAxisId="percent"
                      fill={band.fill}
                      fillOpacity={band.fillOpacity ?? 0.15}
                      strokeOpacity={0}
                      ifOverflow="visible"
                    />
                    {band.stroke && (
                      <ReferenceLine
                        segment={[
                          { x: band.x1, y: band.y2 },
                          { x: band.x2, y: band.y2 },
                        ]}
                        yAxisId="percent"
                        stroke={band.stroke}
                        strokeWidth={1}
                        strokeOpacity={0.7}
                        strokeDasharray={band.strokeDasharray}
                        ifOverflow="visible"
                      />
                    )}
                  </React.Fragment>
                ))}
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis
                dataKey="time"
                type="number"
                domain={[0, "dataMax"]}
                tickFormatter={formatTime}
                stroke="#71717a"
                fontSize={11}
                label={{ value: "経過時間", position: "insideBottom", offset: -2, fill: "#a1a1aa", fontSize: 11 }}
              />
              <YAxis
                yAxisId="speed"
                orientation="left"
                domain={[SPEED_MIN, SPEED_MAX]}
                allowDataOverflow
                tickFormatter={(v) => v.toFixed(1)}
                stroke="#3b82f6"
                fontSize={11}
                width={48}
                label={{ value: "m/s", angle: -90, position: "insideLeft", fill: "#a1a1aa", fontSize: 11 }}
              />
              <YAxis
                yAxisId="percent"
                orientation="right"
                domain={[0, 1]}
                ticks={PERCENT_AXIS_TICKS}
                tick={renderPercentAxisTick}
                stroke="#71717a"
                fontSize={11}
                width={40}
              />
              <Tooltip
                position={getTooltipPosition as never}
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={{ zIndex: 1000, pointerEvents: "none" }}
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                labelFormatter={(t) => `経過: ${formatTime(Number(t))}`}
                formatter={(value, name, item) => {
                  const payload = item?.payload as GraphPoint | undefined;
                  const key = String(name);

                  // 破線系列は speed/stamina/lane の formatter で併記するため単独行は出さない
                  if (key === "baselineSpeed" || key === "baselineStamina" || key === "baselineLane") {
                    return null;
                  }

                  const labels: Record<string, string> = {
                    speed: "速度",
                    stamina: "体力",
                    lane: "レーン",
                  };
                  const label = labels[key] ?? key;

                  if (key === "speed" && payload) {
                    const current = `${payload.speed.toFixed(1)} m/s`;
                    const baseline =
                      showBaselineOverlay && payload.baselineSpeed != null
                        ? ` / 初期 ${payload.baselineSpeed.toFixed(1)} m/s`
                        : "";
                    return [`${current}${baseline}`, label];
                  }
                  if (key === "stamina" && payload) {
                    const current = `${payload.staminaPct.toFixed(1)}%`;
                    const baseline =
                      showBaselineOverlay && payload.baselineStaminaPct != null
                        ? ` / 初期 ${payload.baselineStaminaPct.toFixed(1)}%`
                        : "";
                    return [`${current}${baseline}`, label];
                  }
                  if (key === "lane" && payload) {
                    const current = `${payload.lanePct.toFixed(1)}%`;
                    const baseline =
                      showBaselineOverlay && payload.baselineLanePct != null
                        ? ` / 初期 ${payload.baselineLanePct.toFixed(1)}%`
                        : "";
                    return [`${current}${baseline}`, label];
                  }

                  const num = typeof value === "number" ? value : 0;
                  return [String(num), label];
                }}
              />
              <Legend
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ pointerEvents: "none" }}
                content={
                  <SyncedChartLegend
                    displayState={displayState}
                    compareActive={showBaselineOverlay}
                  />
                }
              />
              {graphPoints.phaseLines.map((phase) => (
                <ReferenceLine
                  key={phase.label}
                  x={phase.time}
                  yAxisId="percent"
                  stroke="#a1a1aa"
                  strokeDasharray="4 4"
                  ifOverflow="visible"
                  label={{ value: phase.label, position: "top", fill: "#a1a1aa", fontSize: 10 }}
                />
              ))}
              <ReferenceLine
                y={STAMINA_PLOT_FLOOR}
                yAxisId="percent"
                stroke="#71717a"
                strokeOpacity={0.45}
                strokeDasharray="2 4"
                strokeWidth={1}
                ifOverflow="visible"
              />
              <Line
                yAxisId="speed"
                type="monotone"
                dataKey="speed"
                stroke={SPEED_LINE_COLOR}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                hide={!displayState.showSpeed}
              />
              {showBaselineOverlay && (
                <Line
                  yAxisId="speed"
                  type="monotone"
                  dataKey="baselineSpeed"
                  stroke={SPEED_LINE_COLOR}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  strokeOpacity={BASELINE_LINE_OPACITY}
                  dot={false}
                  isAnimationActive={false}
                  hide={!displayState.showSpeed}
                  legendType="none"
                />
              )}
              <Line
                yAxisId="percent"
                type="monotone"
                dataKey="stamina"
                stroke={STAMINA_LINE_COLOR}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                hide={!displayState.showStamina}
              />
              {showBaselineOverlay && (
                <Line
                  yAxisId="percent"
                  type="monotone"
                  dataKey="baselineStamina"
                  stroke={STAMINA_LINE_COLOR}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  strokeOpacity={BASELINE_LINE_OPACITY}
                  dot={false}
                  isAnimationActive={false}
                  hide={!displayState.showStamina}
                  legendType="none"
                />
              )}
              <Line
                yAxisId="percent"
                type="monotone"
                dataKey="lane"
                stroke={LANE_LINE_COLOR}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                hide={!displayState.showLane}
              />
              {showBaselineOverlay && (
                <Line
                  yAxisId="percent"
                  type="monotone"
                  dataKey="baselineLane"
                  stroke={LANE_LINE_COLOR}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  strokeOpacity={BASELINE_LINE_OPACITY}
                  dot={false}
                  isAnimationActive={false}
                  hide={!displayState.showLane}
                  legendType="none"
                />
              )}
            </LineChart>
          </ResponsiveContainer>

          {/* スキル発動 overlay SVG — Recharts 外の absolute レイヤー（ラベルのみ pointer-events） */}
          {showSkillOverlay && skillMarkersPx.length > 0 && (
            <svg
              className="pointer-events-none absolute inset-0"
              width="100%"
              height={isExpanded ? contentChartHeight : "100%"}
              style={{ overflow: "visible" }}
              aria-hidden="true"
            >
              <defs>
                <filter
                  id="skill-label-glow"
                  x="-70%"
                  y="-70%"
                  width="240%"
                  height="240%"
                  colorInterpolationFilters="sRGB"
                >
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                  </feMerge>
                </filter>
              </defs>
              {orderedSkillMarkersPx.map((m, i) => {
                const isHovered = hoveredSkillKey === m.tooltipKey;
                const { pillWidth, pillHeight, pillY, pillRx } = getSkillPillLayout(m, labelTextWidths);
                const pillStyle = SKILL_HOVER_PILL_STYLE[m.kind];
                const glowX = m.startX - SKILL_PILL_GLOW_EXPAND;
                const glowY = pillY - SKILL_PILL_GLOW_EXPAND;
                const glowW = pillWidth + SKILL_PILL_GLOW_EXPAND * 2;
                const glowH = pillHeight + SKILL_PILL_GLOW_EXPAND * 2;
                const glowRx = pillRx + SKILL_PILL_GLOW_EXPAND;

                return (
                <g key={`skill-overlay-${m.tooltipKey}-${i}`}>
                  {/* 発動区間水平線（endedSkills 検出スキルのみ。回復のみ・デバフはラベルのみ） */}
                  {m.hasDurationLine && (
                    <line
                      x1={m.startX}
                      y1={m.lineY}
                      x2={m.endX}
                      y2={m.lineY}
                      stroke={m.kind === "debuff" ? DEBUFF_DURATION_LINE_COLOR : SKILL_DURATION_LINE_COLOR}
                      strokeWidth={2}
                    />
                  )}
                  {/* スキル名ラベルのみ hover 対象（カーソル default・ピル発光） */}
                  <g
                    pointerEvents="all"
                    style={{ cursor: "default" }}
                    onMouseEnter={handleSkillLabelEnter(m)}
                    onMouseMove={handleSkillLabelMove}
                    onMouseLeave={handleSkillLabelLeave}
                  >
                    <g
                      pointerEvents="none"
                      style={{
                        transition: `opacity ${SKILL_HOVER_FADE_MS}ms ease-out`,
                        opacity: isHovered ? 1 : 0,
                      }}
                    >
                      <rect
                        x={glowX}
                        y={glowY}
                        width={glowW}
                        height={glowH}
                        rx={glowRx}
                        fill={pillStyle.glow}
                        fillOpacity={pillStyle.glowFillOpacity}
                        filter="url(#skill-label-glow)"
                      />
                      <rect
                        x={m.startX}
                        y={pillY}
                        width={pillWidth}
                        height={pillHeight}
                        rx={pillRx}
                        fill={pillStyle.fill}
                        fillOpacity={pillStyle.fillOpacity}
                        stroke={pillStyle.stroke}
                        strokeWidth={1}
                        strokeOpacity={pillStyle.strokeOpacity}
                      />
                    </g>
                    <text
                      ref={(node) => {
                        if (node) labelTextRefs.current.set(m.tooltipKey, node);
                        else labelTextRefs.current.delete(m.tooltipKey);
                      }}
                      x={m.startX}
                      y={m.labelY}
                      textAnchor="start"
                      dominantBaseline="hanging"
                      fill={m.labelColor}
                      fontSize={SKILL_FONT_SIZE}
                      pointerEvents="none"
                    >
                      {m.label}
                    </text>
                    <rect
                      x={m.startX}
                      y={pillY}
                      width={pillWidth}
                      height={pillHeight}
                      fill="transparent"
                      style={{ cursor: "default" }}
                    />
                  </g>
                </g>
                );
              })}
            </svg>
          )}

          {hoveredSkillMarker && (
            <SkillTooltipPortal
              clientX={skillTooltipPos.clientX}
              clientY={skillTooltipPos.clientY}
              effectText={hoveredSkillMarker.effectText}
            />
          )}

          {displayState.showAreas && graphPoints.areaBands.length > 0 && (
            <div className="pointer-events-none absolute bottom-1 left-1 flex flex-col gap-0.5 text-[10px] text-zinc-300">
              <span className="rounded bg-black/50 px-1.5 py-0.5">直線 / コーナー</span>
              <span className="rounded bg-black/50 px-1.5 py-0.5">上り(上) / 下り(下)</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex w-full shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-1 py-1.5 text-xs text-zinc-300">
        {DISPLAY_CHECKBOXES.map(({ key, label }) => (
          <label key={key} className="inline-flex cursor-pointer items-center gap-1">
            <input
              type="checkbox"
              className="accent-blue-500"
              checked={displayState[key]}
              onChange={() => toggleDisplay(key)}
            />
            {label}
          </label>
        ))}
        {/* 検証用: 縦拡大 Y zoom 倍率（development のみ。本番前に削除） */}
        {process.env.NODE_ENV === "development" && (
          <span
            className="ml-auto font-mono text-[10px] text-amber-400/90"
            title={
              detailYZoom.source === "cap"
                ? uncappedNeedK != null
                  ? `K=5.0 でも被り検出。cap なし推定最小 K≈${uncappedNeedK.toFixed(2)}（探索上限 ${DETAIL_ZOOM_PROBE_MAX}）`
                  : `K=5.0 でも被り検出。${DETAIL_ZOOM_PROBE_MAX} 超も必要（解消不能の可能性）`
                : detailYZoom.source === "min-lo"
                  ? "分析目標 K（下限 3.0 または maxStack 由来）で被りなし"
                  : detailYZoom.source === "min-search"
                    ? "目標 K から被り解消まで引き上げ（二分探索）"
                    : "overview（zoom=1）"
            }
          >
            Y zoom: {yZoomFactor.toFixed(2)}
            {!isExpanded
              ? " (OFF)"
              : detailYZoom.source === "cap"
                ? uncappedNeedK != null
                  ? ` (cap → need ${uncappedNeedK.toFixed(2)})`
                  : ` (cap → need >${DETAIL_ZOOM_PROBE_MAX})`
                : " (min)"}
          </span>
        )}
      </div>
    </div>
  );
};

/** detail / baselineDetail 参照が同じなら親再描画をスキップ */
export const RaceDetailChart = React.memo(
  RaceDetailChartInner,
  (prev, next) =>
    prev.detail === next.detail &&
    prev.baselineDetail === next.baselineDetail &&
    prev.compareActive === next.compareActive,
);
