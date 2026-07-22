"use client";
import React, { useState } from 'react';
import { UmaStatusData } from '../lib/types';
import { useToast } from '../hooks/useToast';
import { SkillCommandPalette } from './SkillCommandPalette';

import { canPlaceSkillAtIndex, getSkillNameById, getSkillRarityInfoById, isUniqueSkillId } from '../lib/umasimSkillData';
import { SkillSummaryLine } from './SkillSummaryLine';

interface SkillPanelProps {
  data: UmaStatusData;
  onChange: (data: UmaStatusData) => void;
}

export function SkillPanel({ data, onChange }: SkillPanelProps) {

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isUniquePaletteOpen, setIsUniquePaletteOpen] = useState(false);
  const { showToastMessage } = useToast();

  const addSkill = (skillId: string) => {
    if (!skillId) return;
    if (data.skillIds.includes(skillId)) return;

    if (isUniqueSkillId(skillId)) {
      const others = data.skillIds.filter(id => !isUniqueSkillId(id));
      onChange({
        ...data,
        skillIds: [skillId, ...others],
      });
      return;
    }

    const insertIndex = data.skillIds.length;
    if (!canPlaceSkillAtIndex(skillId, insertIndex)) {
      showToastMessage('通常固有スキルは先頭スロットのみ配置できます', 'error', 3000);
      return;
    }

    onChange({
      ...data,
      skillIds: [...data.skillIds, skillId],
    });
  };

  const removeSkill = (index: number) => {
    const newSkills = [...data.skillIds];
    newSkills.splice(index, 1);
    onChange({ ...data, skillIds: newSkills });
  };

  const clearAllSkills = () => {
    onChange({ ...data, skillIds: [] });
  };

  const hasNormalUniqueAtFirst =
    data.skillIds?.length > 0 && isUniqueSkillId(data.skillIds[0]);

  return (
    <div className="w-full relative">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2">
          <h3 className="text-zinc-200 font-bold text-sm">取得スキル</h3>
          <button
            onClick={clearAllSkills}
            className="text-xs text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 rounded-md"
          >
            すべてのスキルを削除
          </button>
        </div>
        <SkillSummaryLine skillIds={data.skillIds ?? []} className="mb-4" />

        {!hasNormalUniqueAtFirst && (
          <div className="bg-rose-950/40 border border-rose-500/50 rounded-lg p-3 mb-4 animate-shake">
            <p className="text-sm font-bold text-rose-400 mb-2">⚠️ 通常固有スキルが設定されていません</p>
            <p className="text-xs text-rose-300/80 mb-3">シミュレーションの精度が著しく落ちるため、正しい固有スキルを追加してください。</p>
            <button
              onClick={() => setIsUniquePaletteOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-rose-500/50 hover:bg-rose-500/20 text-rose-300 transition-colors text-xs font-bold bg-rose-500/10"
            >
              ＋ 通常固有スキルを選択する
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          {data.skillIds && data.skillIds.map((skillId, idx) => {
            const skillName = getSkillNameById(skillId);
            const rarityInfo = getSkillRarityInfoById(skillId);
            return (
              <div 
                key={idx} 
                className="group flex items-center justify-between bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700/50 hover:border-zinc-500 px-3 py-2.5 rounded-lg transition-all"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span className={`text-sm font-medium truncate ${rarityInfo.colorClass}`} title={skillName}>
                    {rarityInfo.icon}{skillName}
                  </span>
                </div>
                <button
                  onClick={() => removeSkill(idx)}
                  className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100 ml-2"
                  title="削除"
                >
                  ✕
                </button>
              </div>
            );
          })}
          {(!data.skillIds || data.skillIds.length === 0) && (
            <div className="col-span-2 text-sm text-zinc-500 text-center py-8 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/30">
              取得スキルがありません
            </div>
          )}
        </div>

        {/* Trigger Button */}
        <button
          onClick={() => setIsPaletteOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-900/30 hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 transition-colors text-sm font-medium"
        >
          <span>＋ スキルを追加</span>
        </button>
      </div>

      {/* Command Palette Modal */}
      <SkillCommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onSelect={addSkill}
        existingSkills={data.skillIds}
        onError={(msg) => showToastMessage(msg, 'error', 3000)}
      />
      <SkillCommandPalette
        isOpen={isUniquePaletteOpen}
        onClose={() => setIsUniquePaletteOpen(false)}
        onSelect={(id) => {
          addSkill(id);
          setIsUniquePaletteOpen(false);
        }}
        existingSkills={data.skillIds}
        onError={(msg) => showToastMessage(msg, 'error', 3000)}
        onlyUnique={true}
      />
    </div>
  );
}
