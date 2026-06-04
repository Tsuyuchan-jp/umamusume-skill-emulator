import React from 'react';
import { SimTab } from '../lib/types';

interface TabBarProps {
  tabs: SimTab[];
  setTabs: React.Dispatch<React.SetStateAction<SimTab[]>>;
  activeTabId: string | null;
  setActiveTabId: (id: string | null) => void;
  highlightedTabId: string | null;
}

export function TabBar(props: TabBarProps) {
  const { tabs, setTabs, activeTabId, setActiveTabId, highlightedTabId } = props;

  if (tabs.length === 0) return null;

  return (
    <div className="flex gap-3 mb-6 border-b border-zinc-800 pb-4 overflow-x-auto scrollbar-thin">
      {tabs.map(tab => {
        const isActive = activeTabId === tab.id;
        return (
          <div 
            key={tab.id}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTabId(tab.id)}
            className={`group relative flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-300 h-16 ${
              isActive 
                ? 'border-emerald-500 w-56 opacity-100 shadow-[0_0_15px_rgba(16,185,129,0.3)] z-10' 
                : 'border-transparent w-48 opacity-60 hover:opacity-100 hover:border-zinc-700'
            } ${highlightedTabId === tab.id ? 'ring-4 ring-emerald-400 animate-pulse' : ''}`}
          >
            {tab.thumbnailUrl ? (
              <div className="w-full h-full relative bg-zinc-900 pointer-events-none">
                <img 
                  src={tab.thumbnailUrl} 
                  alt={tab.title} 
                  className="w-full h-full object-cover"
                />
                <div className={`absolute inset-0 transition-opacity ${isActive ? 'bg-black/0' : 'bg-black/50 group-hover:bg-black/20'}`}></div>
                {tab.isDuplicate && (
                  <div className="absolute top-1 left-1 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded shadow-lg z-10">
                    🎨 コピー
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                <span className="text-sm font-bold text-zinc-400">{tab.title}</span>
              </div>
            )}
            
            {/* Close button */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setTabs(prev => prev.filter(t => t.id !== tab.id));
                if (activeTabId === tab.id) {
                  const remaining = tabs.filter(t => t.id !== tab.id);
                  setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
                }
              }}
              className={`absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white backdrop-blur-md`}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
