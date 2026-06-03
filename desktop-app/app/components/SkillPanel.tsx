"use client";
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { UmaStatusData, RawSkillData } from '../lib/types';
import { fetchSkillData } from '../lib/engine/umaemuAdapter';

interface SkillPanelProps {
  data: UmaStatusData;
  onChange: (data: UmaStatusData) => void;
}

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

export function SkillPanel({ data, onChange }: SkillPanelProps) {
  const [skillOptions, setSkillOptions] = useState<{value: string, label: string}[]>([]);
  const [skillLoadError, setSkillLoadError] = useState<boolean>(false);

  const loadSkills = async () => {
    setSkillLoadError(false);
    try {
      const skillsData = await fetchSkillData();
      const names = Array.from(new Set(skillsData.map((s: RawSkillData) => s.name)));
      const options = names.map((name: string) => ({ value: name, label: name }));
      setSkillOptions(options);
    } catch (err) {
      console.error("Failed to load skills for editor:", err);
      setSkillLoadError(true);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const addSkill = (skillName: string) => {
    if (!skillName) return;
    onChange({
      ...data,
      skills: [...data.skills, skillName]
    });
  };

  const removeSkill = (index: number) => {
    const newSkills = [...data.skills];
    newSkills.splice(index, 1);
    onChange({ ...data, skills: newSkills });
  };

  const clearAllSkills = () => {
    onChange({ ...data, skills: [] });
  };

  return (
    <div className="w-full">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-4">
          <h3 className="text-zinc-200 font-bold text-sm">取得スキル</h3>
          <button
            onClick={clearAllSkills}
            className="text-xs text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 rounded-md"
          >
            すべてのスキルを削除
          </button>
        </div>
        
        {skillLoadError && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-lg mb-4 text-sm flex items-center justify-between">
            <span>スキルの読み込みに失敗しました。ネットワークを確認してください。</span>
            <button 
              onClick={loadSkills}
              className="bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 px-3 py-1 rounded transition-colors"
            >
              再試行
            </button>
          </div>
        )}
        
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
        
        <div className="grid grid-cols-2 gap-3">
          {data.skills.map((skill, idx) => (
            <div 
              key={idx} 
              className="group flex items-center justify-between bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700/50 hover:border-zinc-500 px-3 py-2.5 rounded-lg transition-all"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80 flex-shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                <span className="text-sm text-zinc-200 font-medium truncate" title={skill}>{skill}</span>
              </div>
              <button
                onClick={() => removeSkill(idx)}
                className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100 ml-2"
                title="削除"
              >
                ✕
              </button>
            </div>
          ))}
          {data.skills.length === 0 && (
            <div className="col-span-2 text-sm text-zinc-500 text-center py-8 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/30">
              取得スキルがありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
