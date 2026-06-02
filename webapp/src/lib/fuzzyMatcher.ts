import stringSimilarity from 'string-similarity';
import type { UmaStatusData } from './types';
import { normalSkillData, uniqueSkillData, extraUniqueSkillData } from '../engine/data/skillData';

// 各データ生成関数から全スキル名フラットリストを生成
const allSkillData = [
  ...normalSkillData({}), 
  ...uniqueSkillData({}), 
  ...extraUniqueSkillData({})
];

const skillNames: string[] = [];
for (const item of allSkillData) {
  if (item.variants) {
    for (const v of item.variants) {
      if (v.name) skillNames.push(v.name);
    }
  }
}
// 固有スキル等、同じ名前で別ID（継承版など）がある場合は重複を排除
const uniqueSkillNames = Array.from(new Set(skillNames));

/**
 * 汎用的なFuzzyMatch生成関数（指定されたリスト内でのみ検索する）
 */
function createFuzzyMatcher(targetList: string[]) {
  return function(rawInput: string | null | undefined): string {
    if (!rawInput) return "";
    const cleanInput = rawInput.replace(/[\\s\\u3000]+/g, "");
    if (!cleanInput) return "";

    const matches = stringSimilarity.findBestMatch(cleanInput, targetList);
    // スコアが低すぎる場合は誤変換（AIの幻覚）とみなし空文字を返す
    if (matches.bestMatch.rating < 0.2) return "";
    return matches.bestMatch.target;
  };
}

export const fuzzyMatchSkillName = createFuzzyMatcher(uniqueSkillNames);

/**
 * Geminiが抽出した生データを正規化します。
 */
export function normalizeStatusData(raw: UmaStatusData): UmaStatusData {
  const normalizedSkills: string[] = [];
  
  if (Array.isArray(raw.skills)) {
    for (const skillName of raw.skills) {
      const matched = fuzzyMatchSkillName(skillName);
      if (matched) {
        normalizedSkills.push(matched);
      }
    }
  }

  // ステータスや適性は基本的にGeminiがJSONキーとして抽出するため、
  // 大きな揺らぎはないと想定しそのまま通すか、必要ならここで補正する。
  
  return {
    ...raw,
    skills: normalizedSkills,
  };
}
