import stringSimilarity from 'string-similarity';
import {
  isInheritEvolutionSkill,
  isUniqueSkillId,
  sanitizeSkillIds,
  umasimSkillDataList,
  umasimSkillNames,
} from './umasimSkillData';
import { UmaStatusData } from './types';

// 全角英数字を半角に変換するユーティリティ（さらに漢数字のゼロ「〇」を記号の丸「○」に正規化）
function toHalfWidth(str: string): string {
  let s = str.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  s = s.replace(/〇/g, '○');
  return s;
}

export function fuzzyMatchSkillId(rawInput: string | null | undefined, isFirstSkill: boolean): string {
  if (!rawInput) return "";
  let cleanInput = rawInput.replace(/[\s\u3000]+/g, "");
  cleanInput = toHalfWidth(cleanInput);
  if (!cleanInput) return "";

  const matches = stringSimilarity.findBestMatch(cleanInput, umasimSkillNames);
  let bestMatch = matches.bestMatch;

  const inputSuffix = cleanInput.slice(-1);
  const hasSymbol = ['○', '◎', '×'].includes(inputSuffix);
  if (hasSymbol) {
    const exactSymbolMatches = matches.ratings.filter(r => r.target.endsWith(inputSuffix) && r.rating > 0.4);
    if (exactSymbolMatches.length > 0) {
      exactSymbolMatches.sort((a, b) => b.rating - a.rating);
      bestMatch = exactSymbolMatches[0];
    }
  }

  if (bestMatch.rating < 0.45) return "";

  // Find the exact skill objects that match the best matched name
  const matchedSkills = umasimSkillDataList.filter(s => s.name === bestMatch.target);
  if (matchedSkills.length === 0) return "";

  if (matchedSkills.length === 1) {
    const only = matchedSkills[0];
    if (!isFirstSkill && only.rarity === 'unique') return '';
    return String(only.id);
  }

  // 同名スキルが複数ある場合、先頭のみ通常固有（unique）を優先
  if (isFirstSkill) {
    const uniqueSkill = matchedSkills.find(s => s.rarity === 'unique');
    if (uniqueSkill) return String(uniqueSkill.id);
    return String(matchedSkills[0].id);
  }

  // 先頭以外: 継承進化（special）があれば通常継承より優先（枠色 OCR なし・ガチ勢寄り）
  const inheritEvolution = matchedSkills.find((s) => isInheritEvolutionSkill(s));
  if (inheritEvolution) return String(inheritEvolution.id);

  const nonUniqueSkill = matchedSkills.find(s => s.rarity !== 'unique');
  if (nonUniqueSkill) return String(nonUniqueSkill.id);
  return '';
}

// 適性の補正用 (A~G, S)
const validAptitudes = ["A", "B", "C", "D", "E", "F", "G", "S"];
function normalizeAptitude(raw: string | null | undefined): string {
  if (!raw) return "G";
  const clean = toHalfWidth(raw.trim()).toUpperCase();
  if (validAptitudes.includes(clean)) return clean;
  // OCRの誤認識対策 (Sと5、Aと4、Gと6などの類似文字)
  if (clean === "5") return "S";
  if (clean === "4") return "A";
  if (clean === "8") return "B";
  if (clean === "6" || clean === "0") return "G";
  return "G";
}

/**
 * Gemini OCRから返ってきた生の UmaStatusData オブジェクトに対して、
 * スキル名の Fuzzy Matching と適性の正規化を適用します。
 */
export function normalizeStatusData(data: any): UmaStatusData {
  if (!data) {
    return {
      speed: 0, stamina: 0, power: 0, guts: 0, wisdom: 0,
      aptitudes: { turf: 'G', dirt: 'G', short: 'G', mile: 'G', medium: 'G', long: 'G', nige: 'G', senkou: 'G', sashi: 'G', oikomi: 'G' },
      skillIds: []
    };
  }

  const rawStats = data.stats || {};
  const rawAptitudes = data.aptitudes || {};
  const rawSkills = data.skills || [];

  return {
    name: data.name,
    speed: parseInt(rawStats.speed) || 0,
    stamina: parseInt(rawStats.stamina) || 0,
    power: parseInt(rawStats.power) || 0,
    guts: parseInt(rawStats.guts) || 0,
    wisdom: parseInt(rawStats.wisdom) || 0,
    aptitudes: {
      turf: normalizeAptitude(rawAptitudes.turf),
      dirt: normalizeAptitude(rawAptitudes.dirt),
      short: normalizeAptitude(rawAptitudes.short),
      mile: normalizeAptitude(rawAptitudes.mile),
      medium: normalizeAptitude(rawAptitudes.medium),
      long: normalizeAptitude(rawAptitudes.long),
      nige: normalizeAptitude(rawAptitudes.nige),
      senkou: normalizeAptitude(rawAptitudes.senkou),
      sashi: normalizeAptitude(rawAptitudes.sashi),
      oikomi: normalizeAptitude(rawAptitudes.oikomi),
    },
    skillIds: sanitizeSkillIds(
      rawSkills
        .map((s: string, index: number) => fuzzyMatchSkillId(s, index === 0))
        .filter((id: string) => id !== "")
    ),
  };
}
