"use client";

import React, { useState } from "react";
import { UmaStatusData } from "../lib/types";
import { SkillCommandPalette } from "./SkillCommandPalette";
import { getSkillRarityInfo } from "../lib/skillRarityData";

interface SkillVerifierProps {
  umaData: UmaStatusData;
  disabledSkills: string[];
  onToggleSkill: (skillName: string) => void;
  onRunComparativeSimulation: () => void;
  isSimulating: boolean;
  onResetSkills: () => void;
  onDuplicateTab: (rect?: DOMRect) => void;
  addedSkills?: string[];
  appliedDisabledSkills?: string[];
  appliedAddedSkills?: string[];
  onAddSkill: (skillName: string) => void;
  onRemoveSkill: (skillName: string) => void;
  onShowToast: (msg: string, type: 'error'|'success', dur: number) => void;
}

export const SkillVerifier: React.FC<SkillVerifierProps> = ({
  umaData,
  disabledSkills,
  onToggleSkill,
  onRunComparativeSimulation,
  isSimulating,
  onResetSkills,
  onDuplicateTab,
  addedSkills = [],
  appliedDisabledSkills = [],
  appliedAddedSkills = [],
  onAddSkill,
  onRemoveSkill,
  onShowToast,
}) => {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // スキルが無い場合は非表示
  if (!umaData.skills || umaData.skills.length === 0) {
    return null;
  }

  const activeSkillsCount = umaData.skills.length - disabledSkills.length;
  const excludedSkillsList = disabledSkills.filter(s => !addedSkills.includes(s));
  const activeAddedSkillsList = addedSkills.filter(s => !disabledSkills.includes(s));
  
  const initialSkillsDisabledCount = excludedSkillsList.length;
  const activeAddedSkillsCount = activeAddedSkillsList.length;
  
  // 確定済みの構成（確定状態でのサマリー）
  const appliedActiveAddedSkillsList = appliedAddedSkills.filter(s => !appliedDisabledSkills.includes(s));
  const appliedExcludedSkillsList = appliedDisabledSkills.filter(s => !appliedAddedSkills.includes(s));

  // 未反映ステータスの計算（意味的なリスト同士の差分をとる）
  const unappliedAddedCount = activeAddedSkillsList.filter(s => !appliedActiveAddedSkillsList.includes(s)).length;
  const removedAddedCount = appliedActiveAddedSkillsList.filter(s => !activeAddedSkillsList.includes(s)).length;
  const unappliedExcludedCount = excludedSkillsList.filter(s => !appliedExcludedSkillsList.includes(s)).length;
  const removedExcludedCount = appliedExcludedSkillsList.filter(s => !excludedSkillsList.includes(s)).length;
  const totalUnappliedCount = unappliedAddedCount + removedAddedCount + unappliedExcludedCount + removedExcludedCount;
  const isDirty = totalUnappliedCount > 0;

  const canSimulate = initialSkillsDisabledCount > 0 || activeAddedSkillsCount > 0;
  const hasChanges = initialSkillsDisabledCount > 0 || addedSkills.length > 0;

  // ボタンテキストの動的生成
  let simulateButtonText = "変更がありません";
  if (isDirty) {
    simulateButtonText = `📊 検証して結果を更新 (未反映: ${totalUnappliedCount}件)`;
  } else if (canSimulate) {
    simulateButtonText = `✅ 最新の構成が反映されています`;
  }

  const containerStyle = isDirty 
    ? "bg-orange-950/10 border-orange-500/50 border-dashed" 
    : "bg-zinc-950/30 border-zinc-800/50";

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mt-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
          スキル影響検証モード
        </h3>
        <div className="flex items-center gap-4">
          {hasChanges && (
            <button
              onClick={onResetSkills}
              disabled={isSimulating}
              className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors disabled:opacity-50"
              title="追加・除外したスキルをすべてリセットし、初期状態のシミュレーション結果に戻します"
            >
              🔄 初期状態にリセット
            </button>
          )}
          <span className="text-xs text-zinc-500">
            有効スキル: <span className="font-bold text-zinc-300">{activeSkillsCount}</span> / {umaData.skills.length}
          </span>
        </div>
      </div>

      <p className="text-xs text-zinc-500 mb-4">
        検証したいスキルのチェックを外して再シミュレーションすることで、そのスキルがない場合のタイムへの影響（Delta）を確認できます。
      </p>

      {/* 変更サマリー（抽出UI）常に表示してレイアウトシフトを防ぐ */}
      <div className={`relative flex flex-col gap-2 mb-4 p-3 rounded-lg min-h-[76px] border transition-colors ${containerStyle}`}>
        {isDirty && (
          <div className="absolute -top-2 -right-2 bg-orange-500 text-[10px] font-bold text-white px-2 py-0.5 rounded shadow-sm border border-orange-400">
            ⚠️ 未反映の変更があります
          </div>
        )}
        
        {/* 追加行 */}
        <div className="flex flex-wrap gap-2 items-center min-h-[28px]">
          <span className="text-xs font-bold text-emerald-500/70 w-8">追加</span>
          {activeAddedSkillsList.length > 0 ? (
            activeAddedSkillsList.map(skill => {
              const rarityInfo = getSkillRarityInfo(skill);
              return (
                <span key={`ad-${skill}`} className="text-xs font-bold px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 border-l-[3px] border-l-emerald-500">
                  <span className={rarityInfo.colorClass}>{rarityInfo.icon}{skill}</span>
                </span>
              );
            })
          ) : (
            <span className="text-xs text-zinc-600 font-medium">なし</span>
          )}
        </div>
        
        {/* 除外行 */}
        <div className="flex flex-wrap gap-2 items-center min-h-[28px]">
          <span className="text-xs font-bold text-rose-500/70 w-8">除外</span>
          {excludedSkillsList.length > 0 ? (
            excludedSkillsList.map(skill => {
              const rarityInfo = getSkillRarityInfo(skill);
              return (
                <span key={`ex-${skill}`} className="text-xs font-bold px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 border-l-[3px] border-l-rose-500">
                  <span className={rarityInfo.colorClass}>{rarityInfo.icon}{skill}</span>
                </span>
              );
            })
          ) : (
            <span className="text-xs text-zinc-600 font-medium">なし</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-6 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {umaData.skills.map((skillName, index) => {
          const isDisabled = disabledSkills.includes(skillName);
          const isAdded = addedSkills.includes(skillName);
          return (
            <div
              key={index}
              className={`flex items-center gap-2 pr-2 rounded-lg border transition-colors group ${
                isDisabled 
                  ? 'bg-zinc-900/80 border-zinc-800/50 opacity-60' 
                  : isAdded 
                    ? 'bg-indigo-900/30 border-indigo-500/30 hover:bg-indigo-900/40'
                    : 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800'
              }`}
            >
              <label className="flex items-center gap-2 p-2 flex-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!isDisabled}
                  onChange={() => onToggleSkill(skillName)}
                  className="w-4 h-4 rounded border-zinc-700 text-purple-500 focus:ring-purple-500/30 focus:ring-offset-0 bg-zinc-900"
                />
                <span className={`text-xs font-bold truncate flex-1 ${isDisabled ? 'text-zinc-500 line-through' : getSkillRarityInfo(skillName).colorClass}`}>
                  {getSkillRarityInfo(skillName).icon}{skillName}
                </span>
                {isAdded && (
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 py-0.5 rounded leading-none whitespace-nowrap">
                    ✨仮想
                  </span>
                )}
              </label>
              {isAdded && (
                <button
                  onClick={() => onRemoveSkill(skillName)}
                  className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
                  title="この仮想スキルを削除"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setIsPaletteOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2 mb-4 rounded-lg border border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-900/30 hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 transition-colors text-xs font-bold"
      >
        <span>＋ 未所持スキルを追加</span>
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[9px] font-sans font-normal">
          Ctrl K
        </kbd>
      </button>

      <div className="flex gap-2">
        <button
          onClick={onRunComparativeSimulation}
          disabled={isSimulating || !isDirty}
          className={`flex-1 font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            isDirty 
              ? 'bg-purple-600 hover:bg-purple-500 text-white hover:shadow-purple-500/20 active:scale-[0.98] animate-pulse' 
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          {isSimulating ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white inline-block mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              検証シミュレーション中...
            </>
          ) : (
            <>
              {simulateButtonText}
            </>
          )}
        </button>
        <button
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onDuplicateTab(rect);
          }}
          disabled={isSimulating}
          className="px-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 text-zinc-300 text-xs font-bold rounded-xl transition-all active:scale-[0.98] flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
          title="現在の状態を新しいタブとして複製します"
        >
          <span className="text-base mb-0.5 group-hover:scale-110 transition-transform">💾</span>
          <span>複製</span>
        </button>
      </div>

      <SkillCommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onSelect={onAddSkill}
        existingSkills={umaData.skills}
        onError={(msg) => onShowToast(msg, 'error', 3000)}
        variant="verifier"
      />
    </div>
  );
};
