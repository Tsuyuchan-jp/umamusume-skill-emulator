"use client";
import React, { useState, useEffect, useRef } from 'react';
import { UmaStatusData, RawSkillData } from '../lib/types';
import { fetchSkillData } from '../lib/engine/umaemuAdapter';

interface SkillPanelProps {
  data: UmaStatusData;
  onChange: (data: UmaStatusData) => void;
}

export function SkillPanel({ data, onChange }: SkillPanelProps) {
  const [skillOptions, setSkillOptions] = useState<{value: string, label: string}[]>([]);
  const [skillLoadError, setSkillLoadError] = useState<boolean>(false);

  // Command Palette states
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when palette opens
  useEffect(() => {
    if (isPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearchQuery("");
      setFocusedIndex(0);
    }
  }, [isPaletteOpen]);

  // Scroll focused item into view
  useEffect(() => {
    if (listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  const addSkill = (skillName: string) => {
    if (!skillName) return;
    if (!data.skills.includes(skillName)) {
      onChange({
        ...data,
        skills: [...data.skills, skillName]
      });
    }
  };

  const removeSkill = (index: number) => {
    const newSkills = [...data.skills];
    newSkills.splice(index, 1);
    onChange({ ...data, skills: newSkills });
  };

  const clearAllSkills = () => {
    onChange({ ...data, skills: [] });
  };

  const filteredOptions = skillOptions.filter(o => 
    o.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, filteredOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[focusedIndex]) {
        addSkill(filteredOptions[focusedIndex].value);
        setSearchQuery("");
        setFocusedIndex(0);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsPaletteOpen(false);
    }
  };

  return (
    <div className="w-full relative">
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
        
        <div className="grid grid-cols-2 gap-3 mb-4">
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

        {/* Trigger Button */}
        <button
          onClick={() => setIsPaletteOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-900/30 hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 transition-colors text-sm font-medium"
        >
          <span>＋ スキルを追加</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-sans">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Command Palette Modal */}
      {isPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[20vh] px-4">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setIsPaletteOpen(false)} 
          />
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700 shadow-2xl rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center px-4 py-3 border-b border-zinc-800">
              <span className="text-zinc-400 mr-3">🔍</span>
              <input
                ref={inputRef}
                type="text"
                placeholder="スキル名で検索..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setFocusedIndex(0);
                }}
                onKeyDown={handlePaletteKeyDown}
                className="flex-1 bg-transparent border-none outline-none text-zinc-200 placeholder-zinc-500"
              />
              <button 
                onClick={() => setIsPaletteOpen(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300 ml-2 px-2 py-1 bg-zinc-800 rounded"
              >
                ESC
              </button>
            </div>
            
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, idx) => (
                  <div
                    key={option.value}
                    onClick={() => {
                      addSkill(option.value);
                      setSearchQuery("");
                      setFocusedIndex(0);
                      inputRef.current?.focus();
                    }}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      idx === focusedIndex 
                        ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/30" 
                        : "text-zinc-300 hover:bg-zinc-800/50 border border-transparent"
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${idx === focusedIndex ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'bg-zinc-600'}`} />
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-zinc-500">
                  該当するスキルが見つかりません
                </div>
              )}
            </div>
            
            <div className="px-4 py-2 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
              <div className="flex gap-4">
                <span><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400">↓</kbd> 移動</span>
                <span><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400">Enter</kbd> 追加</span>
              </div>
              <span><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400">Esc</kbd> 閉じる</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
