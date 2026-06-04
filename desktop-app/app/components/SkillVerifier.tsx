"use client";

import React, { useState } from "react";
import { UmaStatusData } from "../lib/types";

interface SkillVerifierProps {
  umaData: UmaStatusData;
  disabledSkills: string[];
  onToggleSkill: (skillName: string) => void;
  onRunComparativeSimulation: () => void;
  isSimulating: boolean;
  onResetSkills: () => void;
  onDuplicateTab: (rect?: DOMRect) => void;
}

export const SkillVerifier: React.FC<SkillVerifierProps> = ({
  umaData,
  disabledSkills,
  onToggleSkill,
  onRunComparativeSimulation,
  isSimulating,
  onResetSkills,
  onDuplicateTab,
}) => {
  // スキルが無い場合は非表示
  if (!umaData.skills || umaData.skills.length === 0) {
    return null;
  }

  const activeSkillsCount = umaData.skills.length - disabledSkills.length;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mt-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
          スキル影響検証モード
        </h3>
        <div className="flex items-center gap-4">
          {disabledSkills.length > 0 && (
            <button
              onClick={onResetSkills}
              disabled={isSimulating}
              className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors disabled:opacity-50"
              title="初期状態のシミュレーション結果に戻します"
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

      <div className="grid grid-cols-2 gap-2 mb-6 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {umaData.skills.map((skillName, index) => {
          const isDisabled = disabledSkills.includes(skillName);
          return (
            <label
              key={index}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${
                isDisabled 
                  ? 'bg-zinc-900/80 border-zinc-800/50 opacity-60' 
                  : 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800'
              }`}
            >
              <input
                type="checkbox"
                checked={!isDisabled}
                onChange={() => onToggleSkill(skillName)}
                className="w-4 h-4 rounded border-zinc-700 text-purple-500 focus:ring-purple-500/30 focus:ring-offset-0 bg-zinc-900"
              />
              <span className={`text-xs font-bold truncate ${isDisabled ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                {skillName}
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onRunComparativeSimulation}
          disabled={isSimulating || disabledSkills.length === 0}
          className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSimulating ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white inline-block mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              検証シミュレーション中...
            </>
          ) : (
            <>
              📊 差分検証を実行 ({disabledSkills.length}個除外)
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
    </div>
  );
};
