import React from 'react';
import { UmaStatusData, SimTab, RaceCondition } from "../lib/types";
import { isUniqueSkillId } from "../lib/umasimSkillData";

interface SimulationLauncherProps {
  simulationCount: number;
  setSimulationCount: (val: number) => void;
  isSimulating: boolean;
  setIsSimulating: (val: boolean) => void;
  simulationProgress: {current: number, total: number} | null;
  setSimulationProgress: (val: {current: number, total: number} | null) => void;
  umaData: UmaStatusData | null;
  raceCondition: RaceCondition;
  resultImage: string | null;
  tabs: SimTab[];
  setTabs: React.Dispatch<React.SetStateAction<SimTab[]>>;
  setActiveTabId: (id: string) => void;
  showToastMessage: (msg: string, type: 'success'|'error', time: number) => void;
  onAnimateNewTab?: (tabId: string, thumbUrl: string | null) => void;
}

export function SimulationLauncher(props: SimulationLauncherProps) {
  const {
    simulationCount, setSimulationCount, isSimulating, setIsSimulating,
    simulationProgress, setSimulationProgress, umaData, raceCondition,
    resultImage, tabs, setTabs, setActiveTabId, showToastMessage
  } = props;

  const firstSkillId = umaData?.skillIds?.[0];
  const hasNormalUniqueAtFirst = firstSkillId != null && isUniqueSkillId(firstSkillId);

  const handleRunSimulation = async () => {
    if (!umaData) return;
    if (!umaData.strategy || umaData.strategy === "") {
      showToastMessage("作戦が未選択です。ステータス枠から作戦を選択してください！", "error", 5000);
      const strategySelect = document.getElementById("strategy-select");
      if (strategySelect) {
        strategySelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
        strategySelect.focus();
      }
      return;
    }
    setIsSimulating(true);
    setSimulationProgress({ current: 0, total: simulationCount });
    showToastMessage(`${simulationCount.toLocaleString()}回シミュレーションを実行中...`, 'success', 3000);
    try {
      const { runMultipleSimulations } = await import('../lib/engine/umaemuAdapter');
      const simResult = await runMultipleSimulations(
        umaData, 
        raceCondition, 
        simulationCount,
        (current, total) => setSimulationProgress({ current, total })
      );
    
      // サムネイル画像の生成
      let thumbUrl = null;
      if (resultImage) {
        const { cropThumbnail } = await import('../lib/imageUtils');
        thumbUrl = await cropThumbnail(resultImage);
      }

      // タブを追加
      const newTabId = Date.now().toString();
      const newTab: SimTab = {
        id: newTabId,
        title: umaData.name || `ウマ娘 ${tabs.length + 1}`,
        umaData: { ...umaData },
        raceCondition: { ...raceCondition },
        simResultDump: simResult,
        baselineResult: simResult,
        disabledSkillIds: [],
        appliedDisabledSkillIds: [],
        appliedAddedSkillIds: [],
        thumbnailUrl: thumbUrl
      };
      
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTabId);
      
      if (props.onAnimateNewTab) {
        props.onAnimateNewTab(newTabId, thumbUrl);
      }
      
      showToastMessage(`${simulationCount.toLocaleString()}回のシミュレーションが完了しました！`, 'success', 5000);
    } catch (e: any) {
      console.error("Simulation error:", e);
      const msg = e && e.message ? e.message : String(e);
      showToastMessage(`シミュレーションエラー: ${msg}`, 'error', 5000);
    } finally {
      setIsSimulating(false);
      setSimulationProgress(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 sticky bottom-0 z-20 pb-4 bg-[#09090b] pt-4 border-t border-zinc-900/50">
      <div className="flex flex-col gap-2 min-w-0 bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0 w-full">
          <span className="text-xs font-medium text-zinc-300 shrink-0 pl-3">試行回数</span>
          <input
            type="number"
            min="1"
            max="100000"
            value={simulationCount}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 100;
              setSimulationCount(val);
              localStorage.setItem("simulationCount", val.toString());
            }}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500 w-24 shrink-0 font-mono font-bold"
          />
        </div>
        <div className="grid grid-cols-3 gap-1.5 w-full min-w-0">
          {[100, 1000, 10000].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => {
                setSimulationCount(num);
                localStorage.setItem("simulationCount", num.toString());
              }}
              className={`min-w-0 px-2 py-1 text-xs font-bold rounded-md transition-all ${
                simulationCount === num
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
            >
              {num.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleRunSimulation}
        disabled={isSimulating || !hasNormalUniqueAtFirst}
        className={`relative overflow-hidden w-full font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 ${
          !hasNormalUniqueAtFirst 
            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
            : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/20 active:scale-[0.98]'
        }`}
      >
        {isSimulating && simulationProgress && (
          <div 
            className="absolute inset-y-0 left-0 bg-emerald-400/50 transition-all duration-100 ease-linear"
            style={{ width: `${(simulationProgress.current / simulationProgress.total) * 100}%` }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2 drop-shadow-md">
          {!hasNormalUniqueAtFirst
            ? '⚠️ 固有スキルを選択してください'
            : isSimulating && simulationProgress 
              ? `実行中... ${Math.floor((simulationProgress.current / simulationProgress.total) * 100)}% (${simulationProgress.current.toLocaleString()} / ${simulationProgress.total.toLocaleString()})` 
              : `🚀 ${simulationCount.toLocaleString()}回シミュレーションを実行`}
        </span>
      </button>
    </div>
  );
}
