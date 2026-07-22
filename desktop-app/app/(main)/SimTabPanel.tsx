"use client";

import React from "react";
import { SimTab } from "../lib/types";
import { canPlaceSkillAtIndex } from "../lib/umasimSkillData";
import {
  formatSimulationErrorMessage,
  RACE_DETAIL_FETCH_FAILED_MESSAGE,
  SKILL_DATA_FALLBACK_TOAST_MESSAGE,
} from "../lib/engine/simulationErrors";
import { ResultCard } from "../components/ResultCard";
import { SkillVerifier } from "../components/SkillVerifier";
import type { TabArrivalKind } from "../components/TabBar";

interface SimTabPanelProps {
  tab: SimTab;
  displayUnit: "seconds" | "lengths";
  isSimulating: boolean;
  simulationCount: number;
  setTabs: React.Dispatch<React.SetStateAction<SimTab[]>>;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsSimulating: React.Dispatch<React.SetStateAction<boolean>>;
  setSimulationProgress: React.Dispatch<
    React.SetStateAction<{ current: number; total: number } | null>
  >;
  onTabArrived: (tabId: string, kind: TabArrivalKind) => void;
  isArriving?: boolean;
  showToastMessage: (message: string, type: "success" | "error", duration: number) => void;
}

export const SimTabPanel: React.FC<SimTabPanelProps> = ({
  tab,
  displayUnit,
  isSimulating,
  simulationCount,
  setTabs,
  setActiveTabId,
  setIsSimulating,
  setSimulationProgress,
  onTabArrived,
  isArriving = false,
  showToastMessage,
}) => {
  const tabId = tab.id;

  if (!tab.simResultDump) return null;

  return (
    <ResultCard
      result={tab.simResultDump}
      baseline={tab.baselineResult || undefined}
      isArriving={isArriving}
      graphCompareActive={
        tab.simResultDump !== tab.baselineResult &&
        ((tab.appliedDisabledSkillIds?.length ?? 0) > 0 ||
          (tab.appliedAddedSkillIds?.length ?? 0) > 0)
      }
      disabledSkillIds={tab.disabledSkillIds}
      displayUnit={displayUnit}
      umaData={tab.umaData}
      raceCondition={tab.raceCondition}
      rightPane={
        tab.umaData && tab.baselineResult ? (
          <SkillVerifier
            umaData={tab.umaData}
            disabledSkillIds={tab.disabledSkillIds}
            appliedDisabledSkillIds={tab.appliedDisabledSkillIds || []}
            appliedAddedSkillIds={tab.appliedAddedSkillIds || []}
            onToggleSkill={(skillId) => {
              setTabs((prev) =>
                prev.map((t) => {
                  if (t.id === tabId) {
                    return {
                      ...t,
                      disabledSkillIds: t.disabledSkillIds.includes(skillId)
                        ? t.disabledSkillIds.filter((s) => s !== skillId)
                        : [...t.disabledSkillIds, skillId],
                    };
                  }
                  return t;
                })
              );
            }}
            isSimulating={isSimulating}
            onResetSkills={() => {
              setTabs((prev) =>
                prev.map((t) => {
                  if (t.id === tabId) {
                    return {
                      ...t,
                      disabledSkillIds: t.addedSkillIds ? [...t.addedSkillIds] : [],
                      appliedDisabledSkillIds: t.addedSkillIds ? [...t.addedSkillIds] : [],
                      appliedAddedSkillIds: t.addedSkillIds ? [...t.addedSkillIds] : [],
                      simResultDump: t.baselineResult,
                    };
                  }
                  return t;
                })
              );
              showToastMessage("スキル構成と結果を初期状態にリセットしました", "success", 3000);
            }}
            onDuplicateTab={() => {
              const newTab: SimTab = {
                ...tab,
                id: Date.now().toString(),
                isDuplicate: true,
              };

              setTabs((prev) => [...prev, newTab]);
              setActiveTabId(newTab.id);
              onTabArrived(newTab.id, "duplicate");
              showToastMessage("タブを複製しました", "success", 3000);
            }}
            addedSkillIds={tab.addedSkillIds || []}
            onAddSkill={(skillId) => {
              const insertIndex = tab.umaData.skillIds.length;
              if (!canPlaceSkillAtIndex(skillId, insertIndex)) {
                showToastMessage(
                  "通常固有スキルは先頭スロットのみ配置できます",
                  "error",
                  3000
                );
                return;
              }
              setTabs((prev) =>
                prev.map((t) => {
                  if (t.id === tabId) {
                    return {
                      ...t,
                      umaData: {
                        ...t.umaData,
                        skillIds: [...t.umaData.skillIds, skillId],
                      },
                      addedSkillIds: [...(t.addedSkillIds || []), skillId],
                    };
                  }
                  return t;
                })
              );
              showToastMessage("仮想追加しました！差分検証を実行してください。", "success", 4000);
            }}
            onRemoveSkill={(skillId) => {
              setTabs((prev) =>
                prev.map((t) => {
                  if (t.id === tabId) {
                    return {
                      ...t,
                      umaData: {
                        ...t.umaData,
                        skillIds: t.umaData.skillIds.filter((s) => s !== skillId),
                      },
                      addedSkillIds: (t.addedSkillIds || []).filter((s) => s !== skillId),
                      disabledSkillIds: t.disabledSkillIds.filter((s) => s !== skillId),
                    };
                  }
                  return t;
                })
              );
              showToastMessage("削除しました", "success", 3000);
            }}
            onShowToast={showToastMessage}
            onRunComparativeSimulation={async () => {
              if (!tab.umaData) return;
              setIsSimulating(true);
              setSimulationProgress({ current: 0, total: simulationCount });
              showToastMessage("検証シミュレーションを実行中...", "success", 3000);
              try {
                const { runMultipleSimulations } = await import("../lib/engine/umaemuAdapter");
                const clonedUmaData = {
                  ...tab.umaData,
                  skillIds: tab.umaData.skillIds.filter(
                    (s) => !tab.disabledSkillIds.includes(s)
                  ),
                };
                const simResult = await runMultipleSimulations(
                  clonedUmaData,
                  tab.raceCondition,
                  simulationCount,
                  (current, total) => setSimulationProgress({ current, total })
                );

                setTabs((prev) =>
                  prev.map((t) => {
                    if (t.id === tabId) {
                      return {
                        ...t,
                        simResultDump: simResult,
                        appliedDisabledSkillIds: [...t.disabledSkillIds],
                        appliedAddedSkillIds: t.addedSkillIds ? [...t.addedSkillIds] : [],
                      };
                    }
                    return t;
                  })
                );

                const completedCount = simResult.completedCount ?? simResult.iterations;
                const failedCount = simResult.failedCount ?? 0;
                if (failedCount === 0) {
                  showToastMessage("比較検証が完了しました！", "success", 5000);
                } else {
                  showToastMessage(
                    `比較検証完了: ${simulationCount.toLocaleString()}回中${completedCount.toLocaleString()}回完走（${failedCount.toLocaleString()}回は内部エラーのためスキップ）`,
                    "success",
                    5000
                  );
                }
                const { getLastSkillDataMeta } = await import("../lib/engine/umaemuAdapter");
                if (getLastSkillDataMeta()?.usedFallback) {
                  showToastMessage(SKILL_DATA_FALLBACK_TOAST_MESSAGE, "error", 5000);
                }
                if (simResult.raceDetailFetchFailed) {
                  showToastMessage(RACE_DETAIL_FETCH_FAILED_MESSAGE, "error", 5000);
                }
              } catch (e: unknown) {
                console.error("Verification error:", e);
                showToastMessage(formatSimulationErrorMessage(e), "error", 5000);
              } finally {
                setIsSimulating(false);
                setSimulationProgress(null);
              }
            }}
          />
        ) : undefined
      }
    />
  );
};
