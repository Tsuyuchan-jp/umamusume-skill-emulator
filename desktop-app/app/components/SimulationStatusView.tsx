import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { UmaStatusData, RaceCondition } from '../lib/types';
import { getCourseById, getSurfaceKey, getDistanceKey, getStyleKey } from '../lib/aptitudeHelper';
import { STRATEGIES, CONDITIONS, APTITUDE_LABELS } from '../lib/constants';

interface SimulationStatusViewProps {
  umaData: UmaStatusData;
  raceCondition: RaceCondition;
}

export default function SimulationStatusView({ umaData, raceCondition }: SimulationStatusViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const strategyLabel = STRATEGIES.find(s => s.value === umaData.strategy)?.label || umaData.strategy || '未設定';
  const condVal = umaData.condition || "BEST";
  const conditionLabel = CONDITIONS.find(c => c.value === condVal)?.label || condVal;

  const course = getCourseById(raceCondition.locationId, raceCondition.courseId);
  const distanceKey = getDistanceKey(course);
  const surfaceKey = getSurfaceKey(course);
  const styleKey = getStyleKey(umaData.strategy || "NIGE");

  const renderAptitudeBadge = (label: string, value: string) => {
    // S〜Gの色分け
    let colorClass = "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
    if (value === "S") colorClass = "text-amber-400 bg-amber-500/10 border-amber-500/20";
    else if (value === "A") colorClass = "text-rose-400 bg-rose-500/10 border-rose-500/20";
    else if (value === "B") colorClass = "text-pink-400 bg-pink-500/10 border-pink-500/20";
    else if (value === "C" || value === "D") colorClass = "text-blue-400 bg-blue-500/10 border-blue-500/20";

    return (
      <div className={`flex items-center gap-2 px-3 py-1 rounded border ${colorClass}`}>
        <span className="text-xs font-bold opacity-80">{label}</span>
        <span className="text-sm font-black">{value}</span>
      </div>
    );
  };

  return (
    <div className="w-full bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden mb-6 mt-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-bold text-zinc-200">実行時のステータス条件</span>
        </div>
        <div className="flex items-center gap-3">
          {!isExpanded && (
            <div className="flex gap-3 text-xs text-zinc-400 mr-2">
              <span>{strategyLabel}</span>
              <span>{conditionLabel}</span>
            </div>
          )}
          {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-zinc-800/50 flex flex-col gap-5 bg-zinc-950/20">
          
          {/* 基礎ステータス */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: 'スピード', value: umaData.speed, color: 'text-blue-400' },
              { label: 'スタミナ', value: umaData.stamina, color: 'text-rose-400' },
              { label: 'パワー', value: umaData.power, color: 'text-amber-500' },
              { label: '根性', value: umaData.guts, color: 'text-pink-400' },
              { label: '賢さ', value: umaData.wisdom, color: 'text-emerald-400' }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center bg-zinc-900/80 rounded-lg p-2 border border-zinc-800/50">
                <span className="text-[10px] text-zinc-400 font-bold">{stat.label}</span>
                <span className={`text-lg font-mono font-bold ${stat.color}`}>{stat.value}</span>
              </div>
            ))}
          </div>

          {/* 条件 */}
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">作戦</span>
              <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">{strategyLabel}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">調子</span>
              <span className="text-sm font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">{conditionLabel}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">人気</span>
              <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">{umaData.popularity || 1}番人気</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">枠番</span>
              <span className="text-sm font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">{umaData.gateNumber && umaData.gateNumber > 0 ? `${umaData.gateNumber}枠` : 'ランダム'}</span>
            </div>
          </div>

          {/* 適性 */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">シミュレーション使用適性</span>
            <div className="flex flex-wrap gap-2">
              {renderAptitudeBadge(APTITUDE_LABELS[surfaceKey] || 'バ場', umaData.aptitudes[surfaceKey as keyof typeof umaData.aptitudes] || 'G')}
              {renderAptitudeBadge(APTITUDE_LABELS[distanceKey] || '距離', umaData.aptitudes[distanceKey as keyof typeof umaData.aptitudes] || 'G')}
              {renderAptitudeBadge(APTITUDE_LABELS[styleKey] || '脚質', umaData.aptitudes[styleKey as keyof typeof umaData.aptitudes] || 'G')}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
