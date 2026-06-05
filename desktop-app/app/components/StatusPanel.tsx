"use client";
import React from 'react';
import { UmaStatusData, RaceCondition } from '../lib/types';
import { getCourseById, getSurfaceKey, getDistanceKey, getStyleKey } from '../lib/aptitudeHelper';

interface StatusPanelProps {
  data: UmaStatusData;
  onChange: (data: UmaStatusData) => void;
  raceCondition: RaceCondition;
}

import { APTITUDE_GRADES, APTITUDE_LABELS, STRATEGIES, CONDITIONS } from '../lib/constants';
import { useToast } from '../hooks/useToast';
import { getSkillNameById } from '../lib/umasimSkillData';
import { ToastNotification } from './ToastNotification';

export function StatusPanel({ data, onChange, raceCondition }: StatusPanelProps) {
  const { showToast, toastMessage, toastType, showToastMessage } = useToast();
  const updateStat = (key: keyof UmaStatusData, value: number | string) => {
    onChange({ ...data, [key]: value });
  };

  const updateAptitude = (key: keyof UmaStatusData['aptitudes'], value: string) => {
    onChange({
      ...data,
      aptitudes: { ...data.aptitudes, [key]: value }
    });
  };

  const renderStatInput = (label: string, key: keyof UmaStatusData, colorClass: string) => (
    <div className="flex flex-col gap-1">
      <span className={`text-xs font-bold ${colorClass}`}>{label}</span>
      <input
        type="number"
        min={0}
        max={2000}
        value={data[key] as number}
        onChange={(e) => updateStat(key, parseInt(e.target.value) || 0)}
        className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500 w-24 font-mono"
      />
    </div>
  );

  const renderAptitudeSelect = (label: string, key: keyof UmaStatusData['aptitudes']) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-zinc-400">{label}</span>
      <select
        value={data.aptitudes[key] || "A"}
        onChange={(e) => updateAptitude(key, e.target.value)}
        className={`bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-sm outline-none focus:border-zinc-500 font-mono font-bold w-16 text-center ${
          (data.aptitudes[key] || "A") === 'S' ? 'text-amber-400' :
          (data.aptitudes[key] || "A") === 'A' ? 'text-rose-400' : 'text-zinc-300'
        }`}
      >
        {APTITUDE_GRADES.map(g => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
    </div>
  );

  const course = getCourseById(raceCondition.locationId, raceCondition.courseId);
  const surfaceKey = getSurfaceKey(course);
  const distanceKey = getDistanceKey(course);
  const styleKey = getStyleKey(data.strategy);

  const handleExport = () => {
    const surfaceApt = data.aptitudes[surfaceKey] || "A";
    const distanceApt = data.aptitudes[distanceKey] || "A";
    const strategyApt = data.aptitudes[styleKey] || "A";

    const skillNames = (data.skillIds || []).map(id => getSkillNameById(id));

    const parts = [
      data.name || "名称未設定",
      data.speed || 0,
      data.stamina || 0,
      data.power || 0,
      data.guts || 0,
      data.wisdom || 0,
      surfaceApt,
      distanceApt,
      strategyApt,
      ...skillNames
    ];

    const csvText = parts.join(',');

    navigator.clipboard.writeText(csvText).then(() => {
      showToastMessage("umasim/race形式でクリップボードにコピーしました", "success");
    }).catch(err => {
      console.error("Failed to copy:", err);
      showToastMessage("コピーに失敗しました", "error");
    });
  };

  return (
    <>
    <div className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 flex flex-col gap-5">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
        <h3 className="text-zinc-200 font-bold text-sm">ステータス</h3>
        <button
          onClick={handleExport}
          className="text-xs flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-md transition-colors border border-zinc-700/50"
          title="umasim/raceでインポートできるCSV形式でクリップボードにコピーします"
        >
          <svg className="w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
          </svg>
          umasim形式でコピー
        </button>
      </div>
      
      {/* 基礎能力 */}
      <div className="flex flex-wrap gap-4">
        {renderStatInput('スピード', 'speed', 'text-blue-400')}
        {renderStatInput('スタミナ', 'stamina', 'text-orange-400')}
        {renderStatInput('パワー', 'power', 'text-rose-400')}
        {renderStatInput('根性', 'guts', 'text-pink-400')}
        {renderStatInput('賢さ', 'wisdom', 'text-green-400')}
      </div>

      {/* 作戦・適性・コンディション */}
      <div className="flex flex-col gap-4 mt-2">
        {/* 1行目: 作戦・適性×3・調子 */}
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-zinc-400">作戦</span>
            <select
              id="strategy-select"
              value={data.strategy || ""}
              onChange={(e) => updateStat('strategy', e.target.value)}
              className={`rounded-md px-2 py-1.5 text-sm outline-none text-zinc-200 transition-all ${
                !data.strategy || data.strategy === "" 
                  ? "bg-zinc-950 border border-rose-500 ring-1 ring-rose-500 animate-pulse focus:border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.3)]" 
                  : "bg-zinc-950 border border-zinc-800 focus:border-zinc-500"
              }`}
            >
              <option value="" disabled className="bg-zinc-950 text-zinc-400">-- 選択 --</option>
              {STRATEGIES.map(s => <option key={s.value} value={s.value} className="bg-zinc-950 text-zinc-200">{s.label}</option>)}
            </select>
          </div>
          
          {renderAptitudeSelect(`${APTITUDE_LABELS[surfaceKey]}適性`, surfaceKey)}
          {renderAptitudeSelect(`${APTITUDE_LABELS[distanceKey]}適性`, distanceKey)}
          {renderAptitudeSelect(`${APTITUDE_LABELS[styleKey]}適性`, styleKey)}

          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-zinc-400">調子</span>
            <select
              value={data.condition || "BEST"}
              onChange={(e) => updateStat('condition', e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-sm outline-none focus:border-zinc-500 text-zinc-200"
            >
              {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {/* 2行目: 人気・ゲート番号 */}
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-zinc-400">人気</span>
            <select
              value={data.popularity || 1}
              onChange={(e) => updateStat('popularity', parseInt(e.target.value))}
              className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-sm outline-none focus:border-zinc-500 text-zinc-200"
            >
              {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-zinc-400">ゲート番号</span>
            <select
              value={data.gateNumber !== undefined ? data.gateNumber : 0}
              onChange={(e) => updateStat('gateNumber', parseInt(e.target.value))}
              className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-sm outline-none focus:border-zinc-500 text-zinc-200"
            >
              <option value={0}>ランダム</option>
              {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
    <ToastNotification show={showToast} message={toastMessage} type={toastType} />
    </>
  );
}
