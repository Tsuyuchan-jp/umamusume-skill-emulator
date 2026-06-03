"use client";
import React from 'react';
import { UmaStatusData } from '../lib/types';
import { RaceCondition } from './RaceConditionSelector';
import { getCourseById, getSurfaceKey, getDistanceKey, getStyleKey } from '../lib/aptitudeHelper';

interface StatusPanelProps {
  data: UmaStatusData;
  onChange: (data: UmaStatusData) => void;
  raceCondition: RaceCondition;
}

const APTITUDE_GRADES = ["S", "A", "B", "C", "D", "E", "F", "G"];
const STRATEGIES = [
  { value: "NIGE", label: "逃げ" },
  { value: "SEN", label: "先行" },
  { value: "SASI", label: "差し" },
  { value: "OI", label: "追込" },
  { value: "OONIGE", label: "大逃げ" },
];
const CONDITIONS = [
  { value: "BEST", label: "絶好調" },
  { value: "GOOD", label: "好調" },
  { value: "NORMAL", label: "普通" },
  { value: "BAD", label: "不調" },
  { value: "WORST", label: "絶不調" },
];

export function StatusPanel({ data, onChange, raceCondition }: StatusPanelProps) {
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

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-zinc-200 font-bold mb-4 text-sm border-b border-zinc-800 pb-2">基礎能力</h3>
        <div className="flex flex-wrap gap-4">
          {renderStatInput('スピード', 'speed', 'text-blue-400')}
          {renderStatInput('スタミナ', 'stamina', 'text-orange-400')}
          {renderStatInput('パワー', 'power', 'text-rose-400')}
          {renderStatInput('根性', 'guts', 'text-pink-400')}
          {renderStatInput('賢さ', 'wisdom', 'text-green-400')}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 min-w-[280px]">
          <h3 className="text-zinc-200 font-bold mb-4 text-sm border-b border-zinc-800 pb-2">コンディション・作戦</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-zinc-400">作戦</span>
              <select
                value={data.strategy || "NIGE"}
                onChange={(e) => updateStat('strategy', e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-sm outline-none focus:border-zinc-500 text-zinc-200"
              >
                {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
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

        <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 min-w-[280px]">
          <h3 className="text-zinc-200 font-bold mb-4 text-sm border-b border-zinc-800 pb-2">適性</h3>
          <div className="flex gap-4">
            {renderAptitudeSelect('バ場適性', surfaceKey)}
            {renderAptitudeSelect('距離適性', distanceKey)}
            {renderAptitudeSelect('脚質適性', styleKey)}
          </div>
        </div>
      </div>
    </div>
  );
}
