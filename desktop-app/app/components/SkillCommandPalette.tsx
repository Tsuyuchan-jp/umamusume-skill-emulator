"use client";
import React, { useState, useEffect, useRef } from 'react';
import { RawSkillData } from '../lib/types';
import { fetchSkillData } from '../lib/engine/umaemuAdapter';
import { getSkillRarityInfo } from '../lib/skillRarityData';

interface SkillCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (skillName: string) => void;
  existingSkills?: string[];
  onError?: (message: string) => void;
  variant?: 'default' | 'verifier';
}

export function SkillCommandPalette({ isOpen, onClose, onSelect, existingSkills = [], onError, variant = 'default' }: SkillCommandPaletteProps) {
  const [skillOptions, setSkillOptions] = useState<{value: string, label: string}[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isShaking, setIsShaking] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    const loadSkills = async () => {
      try {
        const skillsData = await fetchSkillData();
        const names = Array.from(new Set(skillsData.map((s: RawSkillData) => s.name)));
        const options = names.map((name: string) => ({ value: name, label: name }));
        setSkillOptions(options);
      } catch (err) {
        console.error("Failed to load skills for palette:", err);
      }
    };
    loadSkills();
    
    setTimeout(() => inputRef.current?.focus(), 50);
    setSearchQuery("");
    setFocusedIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  const filteredOptions = skillOptions.filter(o => 
    o.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const triggerError = (skillName: string) => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400); // match animation duration
    if (onError) {
      onError(`${skillName} は既に所持しています`);
    }
  };

  const handleSelect = (skillName: string) => {
    if (existingSkills.includes(skillName)) {
      triggerError(skillName);
      return;
    }
    onSelect(skillName);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, filteredOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[focusedIndex]) {
        handleSelect(filteredOptions[focusedIndex].value);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[20vh] px-4">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <div className={`relative w-full max-w-lg bg-zinc-900 shadow-2xl rounded-xl overflow-hidden flex flex-col ${isShaking ? 'animate-shake' : ''} ${variant === 'verifier' ? 'border border-indigo-500/50 shadow-indigo-500/10' : 'border border-zinc-700'}`}>
        <div className="flex items-center px-4 py-3 border-b border-zinc-800">
          <span className="text-zinc-400 mr-3">{variant === 'verifier' ? '✨' : '🔍'}</span>
          <input
            ref={inputRef}
            type="text"
            placeholder={variant === 'verifier' ? "仮想スキルを追加して検証..." : "初期取得スキルを検索..."}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setFocusedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-zinc-200 placeholder-zinc-500"
          />
          <button 
            onClick={onClose}
            className="text-xs text-zinc-500 hover:text-zinc-300 ml-2 px-2 py-1 bg-zinc-800 rounded"
          >
            ESC
          </button>
        </div>
        
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, idx) => {
              const isExisting = existingSkills.includes(option.value);
              return (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    idx === focusedIndex 
                      ? variant === 'verifier'
                        ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/30" 
                        : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                      : "text-zinc-300 hover:bg-zinc-800/50 border border-transparent"
                  } ${isExisting ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      idx === focusedIndex 
                        ? variant === 'verifier'
                          ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]'
                          : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                        : 'bg-zinc-600'
                    }`} />
                    <span className={`text-sm font-medium ${getSkillRarityInfo(option.value).colorClass}`}>
                      {getSkillRarityInfo(option.value).icon}{option.label}
                    </span>
                  </div>
                  {isExisting && (
                    <span className="text-[10px] font-bold bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                      所持済み
                    </span>
                  )}
                </div>
              );
            })
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
  );
}
