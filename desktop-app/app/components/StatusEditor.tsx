"use client";
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { UmaStatusData } from '../lib/types';
import { normalSkillData, uniqueSkillData } from '../lib/data/skillData';

// スキル選択用のオプション
const allSkills = [...normalSkillData({}), ...uniqueSkillData({})];
const skillNames = allSkills.flatMap((s: any) => (s?.variants || []).map((v: any) => v?.name));
const skillOptions = skillNames.map((name) => ({ value: name, label: name }));

const customStyles = {
  control: (base: any) => ({
    ...base,
    backgroundColor: '#09090b',
    borderColor: '#27272a',
    minHeight: '34px',
    boxShadow: 'none',
    '&:hover': { borderColor: '#3f3f46' }
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: '#18181b',
    zIndex: 50
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isFocused ? '#27272a' : '#18181b',
    color: '#e4e4e7',
    cursor: 'pointer'
  }),
  singleValue: (base: any) => ({
    ...base,
    color: '#e4e4e7',
  }),
  input: (base: any) => ({
    ...base,
    color: '#e4e4e7',
  })
};

interface StatusEditorProps {
  initialData: UmaStatusData | null;
  onSave: (data: UmaStatusData) => void;
}

const emptyStatusData: UmaStatusData = {
  speed: 1200,
  stamina: 1200,
  power: 1200,
  guts: 1200,
  wisdom: 1200,
  aptitudes: {
    turf: 'A', dirt: 'G', short: 'G', mile: 'A', medium: 'A', long: 'B', nige: 'G', senkou: 'A', sashi: 'A', oikomi: 'G'
  },
  skills: []
};

const APTITUDE_GRADES = ["S", "A", "B", "C", "D", "E", "F", "G"];

export function StatusEditor({ initialData, onSave }: StatusEditorProps) {
  const [data, setData] = useState<UmaStatusData>(initialData || emptyStatusData);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  const updateStat = (key: keyof UmaStatusData, value: number) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const updateAptitude = (key: keyof UmaStatusData['aptitudes'], value: string) => {
    setData((prev) => ({
      ...prev,
      aptitudes: { ...prev.aptitudes, [key]: value }
    }));
  };

  const addSkill = (skillName: string) => {
    if (!skillName) return;
    setData((prev) => ({
      ...prev,
      skills: [...prev.skills, skillName]
    }));
  };

  const removeSkill = (index: number) => {
    setData((prev) => {
      const newSkills = [...prev.skills];
      newSkills.splice(index, 1);
      return { ...prev, skills: newSkills };
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
        value={data.aptitudes[key]}
        onChange={(e) => updateAptitude(key, e.target.value)}
        className={`bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-sm outline-none focus:border-zinc-500 font-mono font-bold w-16 text-center ${
          data.aptitudes[key] === 'S' ? 'text-amber-400' :
          data.aptitudes[key] === 'A' ? 'text-rose-400' : 'text-zinc-300'
        }`}
      >
        {APTITUDE_GRADES.map(g => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="w-full">
      <h2 className="text-lg font-semibold text-zinc-200 mb-4 flex items-center gap-2">
        <span className="text-emerald-400">📊</span> 詳細ステータス
      </h2>
      
      {/* 基礎ステータス */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mb-4">
        <h3 className="text-zinc-200 font-bold mb-4 text-sm border-b border-zinc-800 pb-2">基礎能力</h3>
        <div className="flex flex-wrap gap-4">
          {renderStatInput('スピード', 'speed', 'text-blue-400')}
          {renderStatInput('スタミナ', 'stamina', 'text-orange-400')}
          {renderStatInput('パワー', 'power', 'text-rose-400')}
          {renderStatInput('根性', 'guts', 'text-pink-400')}
          {renderStatInput('賢さ', 'wisdom', 'text-green-400')}
        </div>
      </div>

      {/* 適性 */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mb-4">
        <h3 className="text-zinc-200 font-bold mb-4 text-sm border-b border-zinc-800 pb-2">適性</h3>
        
        <div className="mb-4">
          <div className="flex gap-4">
            {renderAptitudeSelect('芝', 'turf')}
            {renderAptitudeSelect('ダート', 'dirt')}
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex gap-4">
            {renderAptitudeSelect('短距離', 'short')}
            {renderAptitudeSelect('マイル', 'mile')}
            {renderAptitudeSelect('中距離', 'medium')}
            {renderAptitudeSelect('長距離', 'long')}
          </div>
        </div>

        <div>
          <div className="flex gap-4">
            {renderAptitudeSelect('逃げ', 'nige')}
            {renderAptitudeSelect('先行', 'senkou')}
            {renderAptitudeSelect('差し', 'sashi')}
            {renderAptitudeSelect('追込', 'oikomi')}
          </div>
        </div>
      </div>

      {/* スキル */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mb-6">
        <h3 className="text-zinc-200 font-bold mb-4 text-sm border-b border-zinc-800 pb-2">取得スキル</h3>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1">
            <Select
              options={skillOptions}
              onChange={(selected: any) => {
                if (selected) {
                  addSkill(selected.value);
                }
              }}
              styles={customStyles}
              placeholder="スキルを追加..."
              value={null}
              isClearable={false}
              className="text-sm"
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          {data.skills.map((skill, idx) => (
            <div key={idx} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-lg group">
              <span className="text-sm text-zinc-300 font-medium">{skill}</span>
              <button
                onClick={() => removeSkill(idx)}
                className="text-rose-500/50 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 px-2"
                title="削除"
              >
                ✕
              </button>
            </div>
          ))}
          {data.skills.length === 0 && (
            <div className="text-sm text-zinc-600 text-center py-4">スキルなし</div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => onSave(data)}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98]"
        >
          ✅ 確定してシミュレーションを開始
        </button>
      </div>
    </div>
  );
}
