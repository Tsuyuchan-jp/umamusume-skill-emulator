"use client";

import React, { useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { UmaStatusData } from "../lib/types";
import { SkillCommandPalette } from "./SkillCommandPalette";
import { getSkillNameById, getSkillRarityInfoById } from "../lib/umasimSkillData";

interface SkillVerifierProps {
  umaData: UmaStatusData;
  disabledSkillIds: string[];
  onToggleSkill: (skillId: string) => void;
  onRunComparativeSimulation: () => void;
  isSimulating: boolean;
  onResetSkills: () => void;
  onDuplicateTab: () => void;
  addedSkillIds?: string[];
  appliedDisabledSkillIds?: string[];
  appliedAddedSkillIds?: string[];
  onAddSkill: (skillId: string) => void;
  onRemoveSkill: (skillId: string) => void;
  onShowToast: (msg: string, type: 'error'|'success', dur: number) => void;
}

export const SkillVerifier: React.FC<SkillVerifierProps> = ({
  umaData,
  disabledSkillIds,
  onToggleSkill,
  onRunComparativeSimulation,
  isSimulating,
  onResetSkills,
  onDuplicateTab,
  addedSkillIds = [],
  appliedDisabledSkillIds = [],
  appliedAddedSkillIds = [],
  onAddSkill,
  onRemoveSkill,
  onShowToast,
}) => {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

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
  if (!umaData.skillIds || umaData.skillIds.length === 0) {
    return null;
  }

  const activeSkillsCount = umaData.skillIds.length - disabledSkillIds.length;
  const excludedSkillsList = disabledSkillIds.filter(s => !addedSkillIds.includes(s));
  const activeAddedSkillsList = addedSkillIds.filter(s => !disabledSkillIds.includes(s));
  
  const initialSkillsDisabledCount = excludedSkillsList.length;
  const activeAddedSkillsCount = activeAddedSkillsList.length;
  
  // 確定済みの構成（確定状態でのサマリー）
  const appliedActiveAddedSkillsList = appliedAddedSkillIds.filter(s => !appliedDisabledSkillIds.includes(s));
  const appliedExcludedSkillsList = appliedDisabledSkillIds.filter(s => !appliedAddedSkillIds.includes(s));

  // 未反映ステータスの計算（意味的なリスト同士の差分をとる）
  const unappliedAddedCount = activeAddedSkillsList.filter(s => !appliedActiveAddedSkillsList.includes(s)).length;
  const removedAddedCount = appliedActiveAddedSkillsList.filter(s => !activeAddedSkillsList.includes(s)).length;
  const unappliedExcludedCount = excludedSkillsList.filter(s => !appliedExcludedSkillsList.includes(s)).length;
  const removedExcludedCount = appliedExcludedSkillsList.filter(s => !excludedSkillsList.includes(s)).length;
  const totalUnappliedCount = unappliedAddedCount + removedAddedCount + unappliedExcludedCount + removedExcludedCount;
  const isDirty = totalUnappliedCount > 0;

  const canSimulate = initialSkillsDisabledCount > 0 || activeAddedSkillsCount > 0;
  // 元スキルの除外 or 有効な仮想スキルがあるときのみリセット表示（仮想がオフのまま残っているだけでは非表示）
  const hasChanges = excludedSkillsList.length > 0 || activeAddedSkillsList.length > 0;

  const addedSummaryCount = activeAddedSkillsList.length;
  const excludedSummaryCount = excludedSkillsList.length;
  const hasSummaryItems = addedSummaryCount > 0 || excludedSummaryCount > 0;

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

  const renderSummaryChip = (skillId: string, variant: 'added' | 'excluded') => {
    const skillName = getSkillNameById(skillId);
    const rarityInfo = getSkillRarityInfoById(skillId);
    const borderColor = variant === 'added' ? 'border-l-emerald-500' : 'border-l-rose-500';
    return (
      <span
        key={`${variant}-${skillId}`}
        title={skillName}
        className={`block max-w-[140px] min-w-0 truncate text-xs font-bold px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 border-l-[3px] ${borderColor} ${rarityInfo.colorClass}`}
      >
        {rarityInfo.icon}{skillName}
      </span>
    );
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 h-full min-h-0 flex flex-col animate-fadeIn">
      <div className="shrink-0 flex items-center justify-between mb-3 gap-2">
        <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
          <span className="truncate">スキル影響検証モード</span>
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {hasChanges && (
            <button
              type="button"
              onClick={onResetSkills}
              disabled={isSimulating}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/30 transition-colors disabled:opacity-50"
              title="元スキルの除外を解除し、仮想スキルをオフにして結果を初期状態に戻します（仮想スキルはリストに残ります）"
            >
              <RotateCcw className="w-5 h-5" strokeWidth={2.25} />
            </button>
          )}
          <span className="text-xs text-zinc-500 whitespace-nowrap">
            有効: <span className="font-bold text-zinc-300">{activeSkillsCount}</span>/{umaData.skillIds.length}
          </span>
        </div>
      </div>

      <p className="shrink-0 text-xs text-zinc-500 mb-3">
        検証したいスキルのチェックを外して再シミュレーションすることで、そのスキルがない場合のタイムへの影響（Delta）を確認できます。
      </p>

      {/* 変更サマリー（折りたたみ） */}
      <div className={`shrink-0 relative mb-3 rounded-lg border transition-colors ${containerStyle}`}>
        {isDirty && (
          <div className="absolute -top-2 -right-2 bg-orange-500 text-[10px] font-bold text-white px-2 py-0.5 rounded shadow-sm border border-orange-400">
            ⚠️ 未反映の変更があります
          </div>
        )}

        <button
          type="button"
          onClick={() => hasSummaryItems && setIsSummaryExpanded(!isSummaryExpanded)}
          disabled={!hasSummaryItems}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left ${hasSummaryItems ? 'cursor-pointer hover:bg-zinc-800/30' : 'cursor-default'} rounded-lg transition-colors`}
        >
          <div className="flex items-center gap-3 min-w-0 text-xs">
            <span className="font-bold text-emerald-500/70 shrink-0">
              追加 <span className="text-zinc-300 font-bold">{addedSummaryCount > 0 ? `${addedSummaryCount}件` : 'なし'}</span>
            </span>
            <span className="font-bold text-rose-500/70 shrink-0">
              除外 <span className="text-zinc-300 font-bold">{excludedSummaryCount > 0 ? `${excludedSummaryCount}件` : 'なし'}</span>
            </span>
          </div>
          {hasSummaryItems && (
            <ChevronDown
              className={`w-4 h-4 shrink-0 text-zinc-500 transition-transform ${isSummaryExpanded ? 'rotate-180' : ''}`}
            />
          )}
        </button>

        {isSummaryExpanded && hasSummaryItems && (
          <div className="px-3 pb-3 flex flex-col gap-2 max-h-[80px] overflow-y-auto border-t border-zinc-800/50 pt-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {activeAddedSkillsList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] font-bold text-emerald-500/70 w-8 shrink-0">追加</span>
                {activeAddedSkillsList.map(skillId => renderSummaryChip(skillId, 'added'))}
              </div>
            )}
            {excludedSkillsList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] font-bold text-rose-500/70 w-8 shrink-0">除外</span>
                {excludedSkillsList.map(skillId => renderSummaryChip(skillId, 'excluded'))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        <div className="grid grid-cols-2 gap-2">
        {umaData.skillIds.map((skillId, index) => {
          const skillName = getSkillNameById(skillId);
          const isDisabled = disabledSkillIds.includes(skillId);
          const isAdded = addedSkillIds.includes(skillId);
          return (
            <div
              key={index}
              className={`flex min-w-0 items-center gap-1 pr-1 rounded-lg border transition-colors group ${
                isDisabled 
                  ? 'bg-zinc-900/80 border-zinc-800/50 opacity-60' 
                  : isAdded 
                    ? 'bg-indigo-900/30 border-indigo-500/30 hover:bg-indigo-900/40'
                    : 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800'
              }`}
            >
              <label className="flex min-w-0 flex-1 items-center gap-1.5 p-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!isDisabled}
                  onChange={() => onToggleSkill(skillId)}
                  className="w-4 h-4 shrink-0 rounded border-zinc-700 text-purple-500 focus:ring-purple-500/30 focus:ring-offset-0 bg-zinc-900"
                />
                <span
                  title={skillName}
                  className={`min-w-0 truncate text-xs font-bold flex-1 ${isDisabled ? 'text-zinc-500 line-through' : getSkillRarityInfoById(skillId).colorClass}`}
                >
                  {getSkillRarityInfoById(skillId).icon}{skillName}
                </span>
                {isAdded && (
                  <span className="shrink-0 text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 py-0.5 rounded leading-none whitespace-nowrap">
                    ✨仮想
                  </span>
                )}
              </label>
              {isAdded && (
                <button
                  type="button"
                  onClick={() => onRemoveSkill(skillId)}
                  className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
                  title="この仮想スキルを削除"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsPaletteOpen(true)}
        className="shrink-0 w-full flex items-center justify-center gap-2 py-2 mb-3 rounded-lg border border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-900/30 hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 transition-colors text-xs font-bold"
      >
        <span>＋ 未所持スキルを追加</span>
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[9px] font-sans font-normal">
          Ctrl K
        </kbd>
      </button>

      <div className="shrink-0 flex gap-2">
        <button
          type="button"
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
          type="button"
          onClick={onDuplicateTab}
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
        existingSkills={umaData.skillIds}
        onError={(msg) => onShowToast(msg, 'error', 3000)}
        variant="verifier"
      />
    </div>
  );
};
