import React, { useEffect } from "react";
import { X } from "lucide-react";
import { SimTab } from "../lib/types";

/** タブ到着の種別（シミュ完了 / 複製）。Phase B でも同じシグナルを再利用する */
export type TabArrivalKind = "sim" | "duplicate";

interface TabBarProps {
  tabs: SimTab[];
  setTabs: React.Dispatch<React.SetStateAction<SimTab[]>>;
  activeTabId: string | null;
  setActiveTabId: (id: string | null) => void;
  /** 到着演出中のタブ ID（page 側で約 3 秒保持） */
  newlyArrivedTabId?: string | null;
  newlyArrivedKind?: TabArrivalKind | null;
}

export function TabBar(props: TabBarProps) {
  const {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    newlyArrivedTabId = null,
    newlyArrivedKind = null,
  } = props;

  // 新タブが横スクロール外なら見える位置へ
  useEffect(() => {
    if (!newlyArrivedTabId) return;
    const el = document.getElementById(`tab-${newlyArrivedTabId}`);
    el?.scrollIntoView({ behavior: "smooth", inline: "end", block: "nearest" });
  }, [newlyArrivedTabId]);

  if (tabs.length === 0) return null;

  return (
    <div
      className="mb-3 min-w-0"
      role="tablist"
      aria-label="シミュレーション結果タブ"
    >
      <div className="flex gap-2 overflow-x-auto scrollbar-thin rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-1.5 pl-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm">
        {tabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          const isArriving = newlyArrivedTabId === tab.id;
          const ringClass =
            newlyArrivedKind === "duplicate"
              ? "tab-arrive-ring-amber"
              : "tab-arrive-ring-emerald";

          return (
            <div
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTabId(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveTabId(tab.id);
                }
              }}
              className={`group relative flex-shrink-0 cursor-pointer rounded-lg outline-none transition-[box-shadow,opacity,transform] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                isArriving ? "tab-arriving" : ""
              } ${
                isActive
                  ? "z-10 shadow-[0_0_20px_rgba(16,185,129,0.22),0_4px_14px_rgba(0,0,0,0.45)] ring-1 ring-emerald-500/45"
                  : "opacity-70 hover:opacity-100 hover:ring-1 hover:ring-zinc-600/40 hover:shadow-md active:scale-[0.98]"
              }`}
            >
              {/* 外周の拡散リング（到着時のみ） */}
              {isArriving && (
                <span
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 rounded-[inherit] ${ringClass}`}
                />
              )}

              <div className="relative h-11 w-[152px] overflow-hidden rounded-[inherit] bg-zinc-950">
                {tab.thumbnailUrl ? (
                  <>
                    <img
                      src={tab.thumbnailUrl}
                      alt={tab.title}
                      className={`h-full w-full object-cover transition-[filter,transform] duration-300 pointer-events-none ${
                        isActive
                          ? "brightness-105 saturate-110"
                          : "brightness-75 saturate-90 group-hover:brightness-90"
                      }`}
                      draggable={false}
                    />
                    <div
                      className={`absolute inset-0 transition-colors duration-200 pointer-events-none ${
                        isActive
                          ? "bg-gradient-to-t from-emerald-950/70 via-emerald-950/10 to-transparent"
                          : "bg-gradient-to-t from-zinc-950/90 via-zinc-950/30 to-zinc-950/10 group-hover:from-zinc-950/75"
                      }`}
                    />
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-800/80 px-2">
                    <span className="truncate text-xs font-bold text-zinc-400">{tab.title}</span>
                  </div>
                )}

                {/* タイトル（サムネ下部） */}
                {tab.thumbnailUrl && (
                  <span
                    className={`absolute bottom-1 left-2 right-7 truncate text-[10px] font-bold tracking-tight pointer-events-none ${
                      isActive ? "text-emerald-50" : "text-zinc-300"
                    }`}
                  >
                    {tab.title}
                  </span>
                )}

                {/* アクティブインジケータ（到着時は一瞬太く光る） */}
                <div
                  className={`absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-200 ${
                    isActive ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-transparent"
                  } ${isArriving && isActive ? "tab-arrive-underline" : ""}`}
                />

                {/* シミュ: NEW バッジ（約 3 秒でフェード）。複製: 既存のコピーバッジを維持 */}
                {isArriving && newlyArrivedKind === "sim" && (
                  <span className="tab-arrive-badge-new absolute top-1 left-1 rounded border border-emerald-500/40 bg-emerald-500/20 px-1 py-px text-[9px] font-black tracking-wide text-emerald-300 backdrop-blur-sm">
                    NEW
                  </span>
                )}
                {tab.isDuplicate && (
                  <span className="absolute top-1 left-1 rounded border border-amber-500/30 bg-amber-500/15 px-1 py-px text-[9px] font-black tracking-wide text-amber-300 backdrop-blur-sm">
                    コピー
                  </span>
                )}
              </div>

              <button
                type="button"
                aria-label={`${tab.title} を閉じる`}
                onClick={(e) => {
                  e.stopPropagation();
                  setTabs((prev) => prev.filter((t) => t.id !== tab.id));
                  if (activeTabId === tab.id) {
                    const remaining = tabs.filter((t) => t.id !== tab.id);
                    setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
                  }
                }}
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-md border border-zinc-700/50 bg-zinc-950/70 text-zinc-400 opacity-0 backdrop-blur-md transition-all duration-150 group-hover:opacity-100 hover:border-red-500/50 hover:bg-red-500/90 hover:text-white focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-red-400/60"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
