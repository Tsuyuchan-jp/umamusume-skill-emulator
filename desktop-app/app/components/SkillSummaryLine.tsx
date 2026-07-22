import React from "react";
import { countSkillSummary } from "../lib/skillSummary";

interface SkillSummaryLineProps {
  skillIds: string[];
  /** true のとき先頭に「スキル」を付ける（SimulationStatusView 用） */
  withSkillPrefix?: boolean;
  className?: string;
}

/**
 * 所持スキルの総数・金・進化を1行で表示する共有コンポーネント。
 * 集計は skillIds から都度算出（独自 state なし）。
 */
export function SkillSummaryLine({
  skillIds,
  withSkillPrefix = false,
  className = "",
}: SkillSummaryLineProps) {
  const { total, rare, evo } = countSkillSummary(skillIds ?? []);
  const prefix = withSkillPrefix ? "スキル " : "";

  return (
    <p className={`text-xs text-zinc-400 ${className}`.trim()}>
      {prefix}総数 <span className="font-bold text-zinc-300">{total}</span>
      {"　"}
      <span className="text-amber-400">✦金</span>{" "}
      <span className="font-bold text-amber-400">{rare}</span>
      {"　"}
      <span className="text-red-400">★進化</span>{" "}
      <span className="font-bold text-red-400">{evo}</span>
    </p>
  );
}
