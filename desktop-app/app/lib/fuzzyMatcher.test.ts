import { describe, expect, it } from "vitest";
import { fuzzyMatchSkillId } from "./fuzzyMatcher";

const UNIQUE_GOLD = "101351"; // 黄金を訪ねて（通常固有）
const INHERIT_GOLD = "901351"; // 黄金を訪ねて（通常継承）
const INHERIT_EVO_GOLD = "91101351"; // 黄金を訪ねて（継承進化）
const INHERIT_EVO_SHINE = "92111091"; // ずっとずっと輝いて（継承進化）

describe("fuzzyMatchSkillId — 継承進化優先", () => {
  it("先頭枠は unique を優先する（既存挙動）", () => {
    expect(fuzzyMatchSkillId("黄金を訪ねて", true)).toBe(UNIQUE_GOLD);
  });

  it("先頭以外の「黄金を訪ねて」は継承進化 ID になる", () => {
    expect(fuzzyMatchSkillId("黄金を訪ねて", false)).toBe(INHERIT_EVO_GOLD);
    // 通常継承には戻さない（自動置換対象外の確認用：解決結果が inherit ではない）
    expect(fuzzyMatchSkillId("黄金を訪ねて", false)).not.toBe(INHERIT_GOLD);
  });

  it("先頭以外の「ずっとずっと輝いて」も継承進化 ID になる", () => {
    expect(fuzzyMatchSkillId("ずっとずっと輝いて", false)).toBe(INHERIT_EVO_SHINE);
  });
});
