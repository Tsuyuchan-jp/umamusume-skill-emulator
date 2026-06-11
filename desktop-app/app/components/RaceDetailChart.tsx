"use client";

import React, { useMemo, useState } from "react";
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
  buildRaceGraphData,
  DEFAULT_GRAPH_DISPLAY_STATE,
  GraphDisplayState,
  GraphPoint,
  SKILL_CHART_BASE_HEIGHT,
  SPEED_MIN,
  SPEED_MAX,
  STAMINA_PLOT_FLOOR,
} from "../lib/raceGraphBuilder";

interface RaceDetailChartProps {
  detail: RaceDetailDump;
}

const formatTime = (seconds: number) => `${seconds.toFixed(1)}秒`;

/** 体力折れ線と同じ色 */
const STAMINA_LINE_COLOR = "#ef4444";

/** 本家 GraphOutput.kt: スキル発動区間の水平線 */
const SKILL_DURATION_LINE_COLOR = "#ef4444";
const DEBUFF_DURATION_LINE_COLOR = "#a78bfa";

/** 右軸: 体力0のプロット位置に「0」目盛を挿入 */
const PERCENT_AXIS_TICKS = [0, STAMINA_PLOT_FLOOR, 0.25, 0.5, 0.75, 1];

/** Tooltip をカーソル付近（やや下）に表示し、折れ線への被りを減らす */
const TOOLTIP_Y_OFFSET = 70;

const DISPLAY_CHECKBOXES: { key: keyof GraphDisplayState; label: string }[] = [
  { key: "showSpeed", label: "速度" },
  { key: "showStamina", label: "体力" },
  { key: "showLane", label: "レーン" },
  { key: "showAreas", label: "区間" },
  { key: "showSkills", label: "スキル" },
  { key: "showDebuffs", label: "デバフ" },
  { key: "expandSkillRows", label: "縦拡大" },
];

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

export const RaceDetailChart: React.FC<RaceDetailChartProps> = ({ detail }) => {
  const [displayState, setDisplayState] = useState<GraphDisplayState>(DEFAULT_GRAPH_DISPLAY_STATE);
  const graphData = useMemo(() => buildRaceGraphData(detail, displayState), [detail, displayState]);

  const toggleDisplay = (key: keyof GraphDisplayState) => {
    setDisplayState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (graphData.points.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-sm text-zinc-500">グラフデータがありません</p>
      </div>
    );
  }

  const isExpanded = displayState.expandSkillRows && graphData.skillMarkers.length > 0;
  const chartHeight = isExpanded ? graphData.expandedChartHeight : SKILL_CHART_BASE_HEIGHT;

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className={`relative min-h-0 flex-1 ${isExpanded ? "overflow-y-auto" : ""}`}>
        <div className="relative w-full" style={{ height: isExpanded ? chartHeight : "100%" }}>
          <ResponsiveContainer
            width="100%"
            height={isExpanded ? chartHeight : "100%"}
            minWidth={0}
            initialDimension={{ width: 800, height: chartHeight }}
          >
            <LineChart data={graphData.points} margin={{ top: 24, right: 48, left: 4, bottom: 4 }}>
              {displayState.showAreas &&
                graphData.areaBands.map((band, index) => (
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
              {graphData.skillMarkers.map((marker, index) => (
                <React.Fragment key={`skill-${marker.skillId}-${marker.startTime}-${index}`}>
                  <ReferenceLine
                    segment={[
                      { x: marker.startTime, y: marker.lineY },
                      { x: marker.endTime, y: marker.lineY },
                    ]}
                    yAxisId="percent"
                    stroke={marker.kind === "debuff" ? DEBUFF_DURATION_LINE_COLOR : SKILL_DURATION_LINE_COLOR}
                    strokeWidth={2}
                    ifOverflow="visible"
                  />
                  <ReferenceLine
                    x={marker.startTime}
                    y={marker.y}
                    yAxisId="percent"
                    stroke="transparent"
                    strokeWidth={0}
                    ifOverflow="visible"
                    label={{
                      value: marker.label,
                      position: "insideTopLeft",
                      fill: marker.labelColor,
                      fontSize: 10,
                    }}
                  />
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
                position={
                  (({ x, y }: { x: number; y: number }) => ({ x, y: y - TOOLTIP_Y_OFFSET })) as never
                }
                allowEscapeViewBox={{ x: false, y: true }}
                wrapperStyle={{ zIndex: 1000 }}
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                labelFormatter={(t) => `経過: ${formatTime(Number(t))}`}
                formatter={(value, name, item) => {
                  const payload = item?.payload as GraphPoint | undefined;
                  const labels: Record<string, string> = {
                    speed: "速度",
                    stamina: "体力",
                    lane: "レーン",
                  };
                  const key = String(name);
                  const label = labels[key] ?? key;

                  if (key === "speed" && payload) {
                    return [`${payload.speed.toFixed(1)} m/s`, label];
                  }
                  if (key === "stamina" && payload) {
                    return [`${payload.staminaPct.toFixed(1)}%`, label];
                  }
                  if (key === "lane" && payload) {
                    return [`${payload.lanePct.toFixed(1)}%`, label];
                  }

                  const num = typeof value === "number" ? value : 0;
                  return [String(num), label];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, pointerEvents: "none" }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    speed: "速度",
                    stamina: "体力",
                    lane: "走行レーン",
                  };
                  return labels[value] ?? value;
                }}
              />
              {graphData.phaseLines.map((phase) => (
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
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                hide={!displayState.showSpeed}
              />
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
              <Line
                yAxisId="percent"
                type="monotone"
                dataKey="lane"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                hide={!displayState.showLane}
              />
            </LineChart>
          </ResponsiveContainer>
          {displayState.showAreas && graphData.areaBands.length > 0 && (
            <div className="pointer-events-none absolute bottom-1 left-1 flex flex-col gap-0.5 text-[10px] text-zinc-300">
              <span className="rounded bg-black/50 px-1.5 py-0.5">直線 / コーナー</span>
              <span className="rounded bg-black/50 px-1.5 py-0.5">上り(上) / 下り(下)</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 px-1 py-1.5 text-xs text-zinc-300">
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
      </div>
    </div>
  );
};
