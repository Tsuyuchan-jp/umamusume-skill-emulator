import { getSkillRarityInfoById } from "./umasimSkillData";

/** 所持スキルの総数・金・進化の集計結果 */
export interface SkillSummary {
  total: number;
  rare: number;
  evo: number;
}

/**
 * skillIds から総数・金（rare）・進化（evo）を集計する。
 * 未知 ID・unique・inherit・white は総数のみ（金・進化には入れない）。
 */
export function countSkillSummary(skillIds: string[]): SkillSummary {
  let rare = 0;
  let evo = 0;

  for (const id of skillIds) {
    const { rarity } = getSkillRarityInfoById(id);
    if (rarity === "rare") rare += 1;
    else if (rarity === "evo") evo += 1;
  }

  return {
    total: skillIds.length,
    rare,
    evo,
  };
}
