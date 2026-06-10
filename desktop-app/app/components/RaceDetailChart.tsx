"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { RaceDetailDump } from "../lib/types";
import { buildRaceGraphData, GraphPoint, SPEED_MIN, SPEED_MAX, STAMINA_PLOT_FLOOR } from "../lib/raceGraphBuilder";

interface RaceDetailChartProps {
  detail: RaceDetailDump;
}

const formatTime = (seconds: number) => `${seconds.toFixed(1)}秒`;

/** Tooltip をカーソル付近（やや下）に表示し、折れ線への被りを減らす */
const TOOLTIP_Y_OFFSET = 70;

export const RaceDetailChart: React.FC<RaceDetailChartProps> = ({ detail }) => {
  const graphData = useMemo(() => buildRaceGraphData(detail), [detail]);

  if (graphData.points.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-sm text-zinc-500">グラフデータがありません</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 min-w-0">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        initialDimension={{ width: 800, height: 360 }}
      >
        <LineChart data={graphData.points} margin={{ top: 24, right: 48, left: 4, bottom: 4 }}>
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
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            stroke="#71717a"
            fontSize={11}
            width={40}
          />
          <Tooltip
            position={({ x, y }) => ({ x, y: y - TOOLTIP_Y_OFFSET })}
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
            wrapperStyle={{ fontSize: 12 }}
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
          />
          <Line
            yAxisId="percent"
            type="monotone"
            dataKey="stamina"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="percent"
            type="monotone"
            dataKey="lane"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
