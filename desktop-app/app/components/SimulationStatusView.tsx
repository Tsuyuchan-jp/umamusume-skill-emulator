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
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        title="ステータス・条件を確認"
        className={`flex items-center justify-center p-2.5 rounded-lg border transition-all ${
          isExpanded
            ? "bg-zinc-800/80 border-zinc-700 text-zinc-200 shadow-inner"
            : "bg-zinc-900/80 border-zinc-800/50 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200 shadow-sm"
        }`}
      >
        <Activity className="w-4 h-4 text-emerald-500" />
      </button>

      {isExpanded && (
        <>
          {/* 見えないオーバーレイ（外側クリックで閉じる用） */}
          <div 
            className="fixed inset-0 z-[90]" 
            onClick={() => setIsExpanded(false)}
          />
          
          <div className="absolute right-0 top-full mt-3 z-[100] bg-zinc-900 border border-zinc-800 rounded-2xl w-max max-w-lg overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-zinc-950/50">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-zinc-100">実行時のステータス条件</h3>
              </div>
              <button onClick={() => setIsExpanded(false)} className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">
                <span className="text-xs">✕</span>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6 bg-zinc-950/20">
              {/* 基礎ステータス */}
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: 'スピード', value: umaData.speed, color: 'text-blue-400' },
                  { label: 'スタミナ', value: umaData.stamina, color: 'text-rose-400' },
                  { label: 'パワー', value: umaData.power, color: 'text-amber-500' },
                  { label: '根性', value: umaData.guts, color: 'text-pink-400' },
                  { label: '賢さ', value: umaData.wisdom, color: 'text-emerald-400' }
                ].map((stat, i) => (
                  <div key={i} className="flex flex-col items-center bg-zinc-900/80 rounded-xl p-3 border border-zinc-800/50 shadow-inner">
                    <span className="text-[10px] text-zinc-500 font-bold mb-1">{stat.label}</span>
                    <span className={`text-xl font-mono font-black ${stat.color}`}>{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* 条件 */}
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">作戦</span>
                  <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">{strategyLabel}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">調子</span>
                  <span className="text-sm font-bold text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">{conditionLabel}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">人気</span>
                  <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">{umaData.popularity || 1}番人気</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">枠番</span>
                  <span className="text-sm font-bold text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">{umaData.gateNumber && umaData.gateNumber > 0 ? `${umaData.gateNumber}枠` : 'ランダム'}</span>
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
          </div>
        </>
      )}
    </div>
  );
}
