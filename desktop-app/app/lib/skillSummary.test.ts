import { describe, expect, it } from "vitest";
import { countSkillSummary } from "./skillSummary";
import { getSkillRarityInfoById } from "./umasimSkillData";

/** 実データ上の代表 ID（umasimSkillData.ts） */
const UNIQUE_ID = "10071"; // 波乱注意砲！
const INHERIT_ID = "900011"; // シューティングスター
const RARE_ID = "202051"; // 大逃げ
const EVO_ID = "106701211"; // 右回りの輪舞曲
const SCENARIO_ID = "414011"; // バリカタ、一丁上がり！
const SCENARIO_ID_2 = "414031"; // シナリオ進化（代表2件目）
const WHITE_ID = "200011"; // 右回り◎
const UNKNOWN_ID = "999999999";

describe("countSkillSummary", () => {
  it("空配列はすべて 0", () => {
    expect(countSkillSummary([])).toEqual({ total: 0, rare: 0, evo: 0 });
  });

  it("rare / evo 混在を正しく数える", () => {
    expect(
      countSkillSummary([RARE_ID, EVO_ID, RARE_ID, WHITE_ID])
    ).toEqual({ total: 4, rare: 2, evo: 1 });
  });

  it("未知 ID は総数のみ増える（金・進化に入れない）", () => {
    expect(countSkillSummary([UNKNOWN_ID, RARE_ID])).toEqual({
      total: 2,
      rare: 1,
      evo: 0,
    });
  });

  it("unique / inherit は総数のみ増える（内訳は出さない）", () => {
    expect(
      countSkillSummary([UNIQUE_ID, INHERIT_ID, EVO_ID])
    ).toEqual({ total: 3, rare: 0, evo: 1 });
  });

  it("scenario は evo（★・赤）として集計する", () => {
    expect(countSkillSummary([SCENARIO_ID, EVO_ID, SCENARIO_ID_2])).toEqual({
      total: 3,
      rare: 0,
      evo: 3,
    });
  });
});

describe("getSkillRarityInfoById — scenario", () => {
  it("scenario ID は evo と同一の表示情報を返す", () => {
    const evoInfo = getSkillRarityInfoById(EVO_ID);
    expect(getSkillRarityInfoById(SCENARIO_ID)).toEqual(evoInfo);
    expect(getSkillRarityInfoById(SCENARIO_ID_2)).toEqual(evoInfo);
    expect(evoInfo).toEqual({
      rarity: "evo",
      icon: "★",
      colorClass: "text-red-400",
    });
  });
});
