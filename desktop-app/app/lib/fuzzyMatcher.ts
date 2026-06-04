import stringSimilarity from 'string-similarity';
import { umasimSkillNames } from './umasimSkillData';
import { UmaStatusData } from './types';

// マスターデータからスキル名の文字列配列を抽出 (umasimの最新データを使用)
const skillNames = umasimSkillNames;

// 全角英数字を半角に変換するユーティリティ（さらに漢数字のゼロ「〇」を記号の丸「○」に正規化）
function toHalfWidth(str: string): string {
  let s = str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  // AIが誤出力しやすい漢数字のゼロをマスターデータで使われる白丸記号に変換
  s = s.replace(/〇/g, '○');
  return s;
}

// 汎用的なFuzzyMatch生成関数
function createFuzzyMatcher(targetList: string[]) {
  return function(rawInput: string | null | undefined): string {
    if (!rawInput) return "";
    // 空白や改行を除去し、全角英数字を半角化、〇を○に正規化
    let cleanInput = rawInput.replace(/[\s\u3000]+/g, "");
    cleanInput = toHalfWidth(cleanInput);
    if (!cleanInput) return "";

    const matches = stringSimilarity.findBestMatch(cleanInput, targetList);
    let bestMatch = matches.bestMatch;

    // ○、◎、× の特例ルール: 末尾記号が一致するものを優先する
    const inputSuffix = cleanInput.slice(-1);
    const hasSymbol = ['○', '◎', '×'].includes(inputSuffix);
    if (hasSymbol) {
      // 一定以上のスコアがあり、かつ末尾記号が完全一致する候補を探す
      const exactSymbolMatches = matches.ratings.filter(r => r.target.endsWith(inputSuffix) && r.rating > 0.4);
      if (exactSymbolMatches.length > 0) {
        exactSymbolMatches.sort((a, b) => b.rating - a.rating); // スコア順
        bestMatch = exactSymbolMatches[0];
      }
    }

    // スコアが低すぎる場合は誤変換（AIの幻覚）とみなし空欄を返す
    // 0.45未満は誤検出として厳格に弾く
    if (bestMatch.rating < 0.45) return "";
    return bestMatch.target;
  };
}

export const fuzzyMatchSkillName = createFuzzyMatcher(skillNames);

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
      skills: []
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
    skills: rawSkills.map((s: string) => fuzzyMatchSkillName(s)).filter((s: string) => s !== ""),
  };
}
