"use client";

import React from "react";
import { SimResultDump } from "../lib/types";

interface ResultCardProps {
  result?: SimResultDump;
  baseline?: SimResultDump;
}

const formatTime = (seconds: number) => {
  if (seconds === 0) return "0:00.000";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
};

const formatPercent = (rate: number) => {
  return `${(rate * 100).toFixed(1)}%`;
};

export const ResultCard: React.FC<ResultCardProps> = ({ result, baseline }) => {
  if (!result) return null;
  const { all, maxSpurt, nonMaxSpurt } = result.summary;
  
  // 差分計算用のヘルパー
  const renderDelta = (current: number, base: number, inverse: boolean = false, isPercent: boolean = false) => {
    if (base === undefined || current === base) return null;
    const diff = current - base;
    
    // inverse: タイムなどは少ない方が「良い（緑）」
    const isGood = inverse ? diff < 0 : diff > 0;
    const color = isGood ? 'text-emerald-400' : 'text-red-400';
    const sign = diff > 0 ? '+' : '';
    const formatted = isPercent 
      ? `${sign}${(diff * 100).toFixed(1)}%`
      : `${sign}${diff.toFixed(2)}`;
      
    return (
      <span className={`text-xs font-bold ml-2 ${color}`}>
        {formatted}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ヒーロー KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/50"></div>
          <span className="text-zinc-400 text-sm font-bold mb-1">最速タイム</span>
          <div className="flex items-baseline">
            <span className="text-3xl font-black text-blue-400 font-mono tracking-tighter">
              {formatTime(all.minTime)}
            </span>
            {baseline && renderDelta(all.minTime, baseline.summary.all.minTime, true)}
          </div>
        </div>
        <div className="bg-zinc-900/80 border border-emerald-500/30 rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg relative overflow-hidden scale-105 z-10 ring-1 ring-emerald-500/20">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
          <span className="text-emerald-400/80 text-sm font-bold mb-1">平均タイム</span>
          <div className="flex items-baseline">
            <span className="text-4xl font-black text-emerald-400 font-mono tracking-tighter shadow-emerald-500/20 drop-shadow-md">
              {formatTime(all.avgTime)}
            </span>
            {baseline && renderDelta(all.avgTime, baseline.summary.all.avgTime, true)}
          </div>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-orange-500/50"></div>
          <span className="text-zinc-400 text-sm font-bold mb-1">最遅タイム</span>
          <div className="flex items-baseline">
            <span className="text-3xl font-black text-orange-400 font-mono tracking-tighter">
              {formatTime(all.maxTime)}
            </span>
            {baseline && renderDelta(all.maxTime, baseline.summary.all.maxTime, true)}
          </div>
        </div>
      </div>

      {/* スタミナ評価バッジ (スパート分析の代替) */}
      <div className={`flex items-center justify-between px-4 py-2 rounded-lg border ${
        (maxSpurt?.count || 0) === result.iterations 
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          : 'bg-red-500/10 border-red-500/20 text-red-400'
      }`}>
        <div className="flex items-center gap-2">
          <span>{(maxSpurt?.count || 0) === result.iterations ? '✅' : '⚠️'}</span>
          <span className="text-sm font-bold">
            {(maxSpurt?.count || 0) === result.iterations ? 'スパート完走 (全レースで最大スパート成功)' : 'スタミナ切れリスクあり (最大スパート失敗が発生)'}
          </span>
        </div>
        <div className="flex gap-4 text-xs font-bold items-center">
          <span>最大スパート率: {formatPercent((maxSpurt?.count || 0) / result.iterations)}</span>
          {(nonMaxSpurt && nonMaxSpurt.count > 0) && (
            <span className="opacity-80 font-normal">
              (失敗時平均: {formatTime(nonMaxSpurt.avgTime)})
            </span>
          )}
        </div>
      </div>

      {/* サブKPI グリッド */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col">
          <span className="text-zinc-500 text-xs font-bold mb-2">平均余剰体力</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-100">{all.avgStamina.toFixed(1)}</span>
            <span className="text-xs text-zinc-500">HP</span>
            {baseline && renderDelta(all.avgStamina, baseline.summary.all.avgStamina, false)}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-zinc-500">
            <span>最小: {all.minStamina.toFixed(1)}</span>
            <span>最大: {all.maxStamina.toFixed(1)}</span>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col">
          <span className="text-zinc-500 text-xs font-bold mb-2">位置取り調整 (平均)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-100">{all.avgPosAdjust.toFixed(2)}</span>
            <span className="text-xs text-zinc-500">回</span>
            {baseline && renderDelta(all.avgPosAdjust, baseline.summary.all.avgPosAdjust, false)}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col">
          <span className="text-zinc-500 text-xs font-bold mb-2">持久力温存</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-100">{formatPercent(all.staminaKeepRate)}</span>
            {baseline && renderDelta(all.staminaKeepRate, baseline.summary.all.staminaKeepRate, false, true)}
          </div>
          <div className="mt-2 text-[10px] text-zinc-500">
            <span>平均距離: {all.avgStaminaKeepDist.toFixed(1)}m</span>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col">
          <span className="text-zinc-500 text-xs font-bold mb-2">追い比べ完走</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-100">{formatPercent(all.competeFightRate)}</span>
            {baseline && renderDelta(all.competeFightRate, baseline.summary.all.competeFightRate, false, true)}
          </div>
          <div className="mt-2 text-[10px] text-zinc-500">
            <span>平均時間: {all.avgCompeteFightTime.toFixed(2)}秒</span>
          </div>
        </div>
      </div>
    </div>
  );
};
