"use client";

import React, { useMemo } from "react";
import { SimResultDump, UmaStatusData, RaceCondition } from "../lib/types";
import { calculateHorseLength, estimateSpurtTargetSpeed } from "../lib/mathUtils";
import { RaceDetailChart } from "./RaceDetailChart";

interface ResultCardProps {
  result?: SimResultDump;
  baseline?: SimResultDump;
  /** 比較 sim 適用後のみ true（グラフ baseline 破線） */
  graphCompareActive?: boolean;
  /** Tab Arrival Phase B: 到着演出中のタブのみ true */
  isArriving?: boolean;
  disabledSkillIds?: string[];
  displayUnit?: 'seconds' | 'lengths';
  umaData?: UmaStatusData;
  raceCondition?: RaceCondition;
  rightPane?: React.ReactNode;
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

export const ResultCard = React.memo<ResultCardProps>(function ResultCard({
  result,
  baseline,
  graphCompareActive = false,
  isArriving = false,
  displayUnit = 'seconds',
  umaData,
  raceCondition,
  rightPane,
}) {
  const spurtTargetSpeed = useMemo(() => {
    if (!umaData || !raceCondition) return 24.0;
    return estimateSpurtTargetSpeed(umaData, raceCondition);
  }, [umaData, raceCondition]);

  if (!result) return null;
  const { all, maxSpurt, nonMaxSpurt } = result.summary;
  const completedCount = result.completedCount ?? result.iterations;

  const showGraphCompare =
    graphCompareActive &&
    baseline?.raceDetail != null &&
    result.raceDetail != null;
  const graphSubtitle = showGraphCompare
    ? "検証後（実線） / 初期構成（破線）"
    : "速度・体力・走行レーン";

  const spurtComplete = (maxSpurt?.count || 0) === completedCount;
  const spurtRate = formatPercent((maxSpurt?.count || 0) / completedCount);
  
  // 差分計算用のヘルパー
  const renderDelta = (current: number, base: number, isTime: boolean = false, isPercent: boolean = false) => {
    if (base === undefined || current === base) return null;
    const diff = current - base;
    
    // isTime: タイムなどは少ない方が「良い（緑）」
    const isGood = isTime ? diff < 0 : diff > 0;
    const color = isGood ? 'text-emerald-400' : 'text-red-400';
    
    // バ身差モードの場合の処理
    if (isTime && displayUnit === 'lengths') {
      const lengths = calculateHorseLength(diff, spurtTargetSpeed);
      // バ身差の符号は直感的に「-（マイナス）」が短縮（良い）、「+」が遅延
      const sign = lengths > 0 ? '+' : '';
      const displayValue = `${sign}${lengths.toFixed(2)}バ身`;
      return (
        <span className={`text-xs font-bold ml-2 ${color}`} title={`${diff > 0 ? '+' : ''}${diff.toFixed(3)}秒`}>
          {displayValue}
        </span>
      );
    }
    
    // 秒数・その他モードの処理
    const sign = diff > 0 ? '+' : '';
    let formatted = '';
    if (isPercent) {
      formatted = `${sign}${(diff * 100).toFixed(1)}%`;
    } else {
      formatted = isTime ? `${sign}${diff.toFixed(3)}s` : `${sign}${diff.toFixed(2)}`;
    }
      
    return (
      <span className={`text-xs font-bold ml-2 ${color}`}>
        {formatted}
      </span>
    );
  };

  const heroKpiPopClass = isArriving ? "tab-arrive-kpi-pop" : "";

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {/* 行1: ヒーロー KPI + スパートコンパクトチップ */}
      <div className="shrink-0 flex items-stretch gap-2 min-h-[52px]">
        <div className="flex flex-1 gap-2 min-w-0">
          <div className={`flex-1 min-w-0 bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 flex flex-col justify-center relative overflow-hidden ${heroKpiPopClass}`}>
            <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500/50" />
            <span className="text-zinc-500 text-[10px] font-bold leading-none mb-1">最速</span>
            <div className="flex items-baseline min-w-0 gap-1">
              <span className="text-2xl font-black text-blue-400 font-mono tracking-tighter leading-none truncate">
                {formatTime(all.minTime)}
              </span>
              {baseline && renderDelta(all.minTime, baseline.summary.all.minTime, true)}
            </div>
          </div>
          <div className={`flex-1 min-w-0 bg-zinc-900/80 border border-emerald-500/30 rounded-lg px-3 py-2 flex flex-col justify-center relative overflow-hidden ${heroKpiPopClass}`}>
            <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-500" />
            <span className="text-emerald-400/80 text-[10px] font-bold leading-none mb-1">平均</span>
            <div className="flex items-baseline min-w-0 gap-1">
              <span className="text-2xl font-black text-emerald-400 font-mono tracking-tighter leading-none truncate">
                {formatTime(all.avgTime)}
              </span>
              {baseline && renderDelta(all.avgTime, baseline.summary.all.avgTime, true)}
            </div>
          </div>
          <div className={`flex-1 min-w-0 bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 flex flex-col justify-center relative overflow-hidden ${heroKpiPopClass}`}>
            <div className="absolute top-0 left-0 w-full h-0.5 bg-orange-500/50" />
            <span className="text-zinc-500 text-[10px] font-bold leading-none mb-1">最遅</span>
            <div className="flex items-baseline min-w-0 gap-1">
              <span className="text-2xl font-black text-orange-400 font-mono tracking-tighter leading-none truncate">
                {formatTime(all.maxTime)}
              </span>
              {baseline && renderDelta(all.maxTime, baseline.summary.all.maxTime, true)}
            </div>
          </div>
        </div>
        <div
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border ${
            spurtComplete
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
          title={
            spurtComplete
              ? 'スパート完走（全レースで最大スパート成功）'
              : `スタミナ切れリスクあり${
                  nonMaxSpurt && nonMaxSpurt.count > 0
                    ? `（失敗時平均: ${formatTime(nonMaxSpurt.avgTime)}）`
                    : ''
                }`
          }
        >
          <span className="text-sm leading-none">{spurtComplete ? '✅' : '⚠️'}</span>
          <span className="text-sm font-bold font-mono whitespace-nowrap">{spurtRate}</span>
        </div>
      </div>

      {/* 行2: サブ KPI 横ストリップ（1行・サブ項目常時表示） */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-2 min-h-[36px] bg-zinc-900/50 border border-zinc-800 rounded-lg">
        <div className="flex-1 min-w-0 flex items-baseline gap-1">
          <span className="text-zinc-500 text-xs font-bold shrink-0">余剰体力</span>
          <span className="text-base font-bold text-zinc-100 font-mono shrink-0">{all.avgStamina.toFixed(1)}</span>
          {baseline && renderDelta(all.avgStamina, baseline.summary.all.avgStamina, false)}
          <span className="text-[10px] text-zinc-500 font-medium truncate min-w-0">
            · 最小 {all.minStamina.toFixed(1)} / 最大 {all.maxStamina.toFixed(1)} HP
          </span>
        </div>
        <div className="w-px h-4 bg-zinc-700 shrink-0" />
        <div className="flex-1 min-w-0 flex items-baseline gap-1">
          <span className="text-zinc-500 text-xs font-bold shrink-0">位置取り</span>
          <span className="text-base font-bold text-zinc-100 font-mono shrink-0">{all.avgPosAdjust.toFixed(2)}</span>
          {baseline && renderDelta(all.avgPosAdjust, baseline.summary.all.avgPosAdjust, false)}
          <span className="text-[10px] text-zinc-500 font-medium truncate min-w-0">· 平均位置取り補正</span>
        </div>
        <div className="w-px h-4 bg-zinc-700 shrink-0" />
        <div className="flex-1 min-w-0 flex items-baseline gap-1">
          <span className="text-zinc-500 text-xs font-bold shrink-0">持久力温存</span>
          <span className="text-base font-bold text-zinc-100 font-mono shrink-0">{formatPercent(all.staminaKeepRate)}</span>
          {baseline && renderDelta(all.staminaKeepRate, baseline.summary.all.staminaKeepRate, false, true)}
          <span className="text-[10px] text-zinc-500 font-medium truncate min-w-0">
            · 平均距離 {all.avgStaminaKeepDist.toFixed(1)}m
          </span>
        </div>
        <div className="w-px h-4 bg-zinc-700 shrink-0" />
        <div className="flex-1 min-w-0 flex items-baseline gap-1">
          <span className="text-zinc-500 text-xs font-bold shrink-0">追い比べ</span>
          <span className="text-base font-bold text-zinc-100 font-mono shrink-0">{formatPercent(all.competeFightRate)}</span>
          {baseline && renderDelta(all.competeFightRate, baseline.summary.all.competeFightRate, false, true)}
          <span className="text-[10px] text-zinc-500 font-medium truncate min-w-0">
            · 平均時間 {all.avgCompeteFightTime.toFixed(2)}秒
          </span>
        </div>
      </div>

      {/* 直近レース詳細グラフ + 右ペイン（SkillVerifier） */}
      {rightPane ? (
        <div className="grid grid-cols-[1fr_360px] gap-3 flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col min-h-0 h-full min-w-0 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="shrink-0 px-4 py-2 bg-zinc-900/60 border-b border-zinc-800">
              <div className="text-sm font-bold text-zinc-200">直近レース詳細</div>
              <div className="text-xs text-zinc-500">{graphSubtitle}</div>
            </div>
            <div className="relative flex-1 min-h-0 min-w-0 px-4 py-3 bg-zinc-950/50">
              {result.raceDetail ? (
                <div className="absolute inset-0 min-h-0">
                  <RaceDetailChart
                    detail={result.raceDetail}
                    baselineDetail={baseline?.raceDetail}
                    compareActive={showGraphCompare}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-zinc-500">グラフデータを取得中…</p>
                </div>
              )}
            </div>
          </div>
          <div className="min-w-0 min-h-0 h-full overflow-hidden flex flex-col">{rightPane}</div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-[360px] min-w-0 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="shrink-0 px-4 py-2 bg-zinc-900/60 border-b border-zinc-800">
            <div className="text-sm font-bold text-zinc-200">直近レース詳細</div>
            <div className="text-xs text-zinc-500">{graphSubtitle}</div>
          </div>
          <div className="relative flex-1 min-h-[320px] min-w-0 px-4 py-3 bg-zinc-950/50">
            {result.raceDetail ? (
              <div className="absolute inset-0 min-h-0">
                <RaceDetailChart
                  detail={result.raceDetail}
                  baselineDetail={baseline?.raceDetail}
                  compareActive={showGraphCompare}
                />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-zinc-500">グラフデータを取得中…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
