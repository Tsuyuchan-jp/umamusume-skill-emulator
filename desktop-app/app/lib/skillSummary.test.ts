import { describe, expect, it } from "vitest";
import { countSkillSummary } from "./skillSummary";
import {
  buildPaletteSkillOptions,
  getSkillRarityInfoById,
  isInheritEvolutionSkillId,
} from "./umasimSkillData";

/** 実データ上の代表 ID（umasimSkillData.ts） */
const UNIQUE_ID = "10071"; // 波乱注意砲！
const INHERIT_ID = "900011"; // シューティングスター
const RARE_ID = "202051"; // 大逃げ
const EVO_ID = "106701211"; // 右回りの輪舞曲
const SCENARIO_ID = "414011"; // バリカタ、一丁上がり！
const SCENARIO_ID_2 = "414031"; // シナリオ進化（代表2件目）
const WHITE_ID = "200011"; // 右回り◎
const UNKNOWN_ID = "999999999";

/** 継承進化（special）と対応する通常継承 */
const INHERIT_EVO_GOLD = "91101351"; // 黄金を訪ねて（継承進化）
const INHERIT_NORMAL_GOLD = "901351"; // 黄金を訪ねて（通常継承）
const INHERIT_EVO_SHINE = "92111091"; // ずっとずっと輝いて（継承進化）
const SPECIAL_OTHER = "300131"; // 日本総大将（通常 special・パレット非表示）

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

  it("継承進化は evo（★・赤）として集計する", () => {
    expect(
      countSkillSummary([INHERIT_EVO_GOLD, INHERIT_NORMAL_GOLD, INHERIT_EVO_SHINE])
    ).toEqual({ total: 3, rare: 0, evo: 2 });
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

describe("getSkillRarityInfoById — 継承進化", () => {
  it("継承進化 ID は evo（★・赤）、通常継承は inherit（❖・緑）", () => {
    const evoInfo = getSkillRarityInfoById(EVO_ID);
    expect(isInheritEvolutionSkillId(INHERIT_EVO_GOLD)).toBe(true);
    expect(isInheritEvolutionSkillId(INHERIT_EVO_SHINE)).toBe(true);
    expect(isInheritEvolutionSkillId(INHERIT_NORMAL_GOLD)).toBe(false);
    expect(isInheritEvolutionSkillId(SPECIAL_OTHER)).toBe(false);

    expect(getSkillRarityInfoById(INHERIT_EVO_GOLD)).toEqual(evoInfo);
    expect(getSkillRarityInfoById(INHERIT_EVO_SHINE)).toEqual(evoInfo);
    expect(getSkillRarityInfoById(INHERIT_NORMAL_GOLD)).toEqual({
      rarity: "inherit",
      icon: "❖",
      colorClass: "text-emerald-400",
    });
    // 通常 special は白のまま
    expect(getSkillRarityInfoById(SPECIAL_OTHER)).toEqual({
      rarity: "white",
      icon: "",
      colorClass: "text-zinc-200",
    });
  });
});

describe("buildPaletteSkillOptions — 継承進化", () => {
  it("通常継承と継承進化を2行出し、通常 special は出さない", () => {
    const options = buildPaletteSkillOptions();
    const gold = options.filter((o) => o.label.startsWith("黄金を訪ねて"));
    const shine = options.filter((o) => o.label.startsWith("ずっとずっと輝いて"));

    expect(gold).toEqual(
      expect.arrayContaining([
        { value: INHERIT_NORMAL_GOLD, label: "黄金を訪ねて" },
        { value: INHERIT_EVO_GOLD, label: "黄金を訪ねて（継承進化）" },
      ])
    );
    expect(gold).toHaveLength(2);

    expect(shine).toEqual(
      expect.arrayContaining([
        { value: "911091", label: "ずっとずっと輝いて" },
        { value: INHERIT_EVO_SHINE, label: "ずっとずっと輝いて（継承進化）" },
      ])
    );
    expect(shine).toHaveLength(2);

    expect(options.some((o) => o.value === SPECIAL_OTHER || o.label.includes("日本総大将"))).toBe(
      false
    );
  });
});
