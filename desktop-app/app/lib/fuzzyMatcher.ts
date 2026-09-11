import stringSimilarity from 'string-similarity';
import {
  getActiveSkillDataList,
  isInheritEvolutionSkill,
  isUniqueSkillId,
  sanitizeSkillIds,
} from './umasimSkillData';
import { skillRarityMap } from './skillRarityData';
import { UmaStatusData } from './types';

// 全角英数字を半角に変換するユーティリティ（さらに漢数字のゼロ「〇」を記号の丸「○」に正規化）
function toHalfWidth(str: string): string {
  let s = str.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  s = s.replace(/〇/g, '○');
  return s;
}

/**
 * OCR と辞書を同じ土台に乗せる。
 * NFC: Gemini が返す結合濁点（ハ+゙ → バ）を1文字にまとめる。
 * 末尾 Lv 数字: 固有スキル枠のレベル表記が名前に混ざるのを除く。
 */
function canonicalizeSkillText(str: string): string {
  let s = str.normalize("NFC").replace(/[\s\u3000]+/g, "");
  s = toHalfWidth(s);
  s = s.replace(/Lv\.?\d+$/i, "");
  return s;
}

let cachedCanonicalSkillNames: string[] | null = null;

function getActiveSkillNames(): string[] {
  return getActiveSkillDataList().map((s) => s.name);
}

function getCanonicalSkillNames(): string[] {
  if (!cachedCanonicalSkillNames) {
    cachedCanonicalSkillNames = getActiveSkillNames().map((n) => canonicalizeSkillText(n));
  }
  return cachedCanonicalSkillNames;
}

/** 実行時にスキル一覧を差し替えたあと呼ぶ */
export function resetCanonicalSkillNameCache(): void {
  cachedCanonicalSkillNames = null;
}

/** ファジーマッチ閾値（fuzzyMatchSkillId と診断で共有。変更時は両方に影響） */
export const FUZZY_MATCH_THRESHOLD = 0.45;

/**
 * OCR 既知誤読 → 正式スキル名（正規化後の完全一致のみ）。
 * 骨格・編集距離1で拾える千鍛系は表に足さない。2文字差だけ残す。
 */
const OCR_SKILL_ALIASES: Record<string, string> = {
  千銀万錬: "千鍛万錬",
  千段万錬: "千鍛万錬",
  勝利へ至る累積: "勝利ヘ至ル累積",
  聡せめ心: "臆せぬ心",
};

function applyOcrSkillAlias(cleanInput: string): string {
  return OCR_SKILL_ALIASES[cleanInput] ?? cleanInput;
}

/** カタログで /^千.万.$/ に合うのは千鍛万錬のみ。成語寄せの4文字誤読を吸収する */
const SENMAN_SKELETON = /^千.万.$/;

/** エイリアス後。骨格だけ合いカタログに無いとき、唯一の千.万.正式名へ */
export function applySenmanSkeleton(cleanInput: string): string {
  if (!SENMAN_SKELETON.test(cleanInput)) return cleanInput;
  const skeletonHits = [...new Set(getCanonicalSkillNames().filter((n) => SENMAN_SKELETON.test(n)))];
  if (skeletonHits.includes(cleanInput)) return cleanInput;
  if (skeletonHits.length !== 1) return cleanInput;
  return skeletonHits[0];
}

/** Levenshtein。短いラベルの1文字ずれ用 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const prev = new Array<number>(m + 1);
  const cur = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= m; j++) prev[j] = cur[j]!;
  }
  return prev[m]!;
}

/** 編集距離1の救済は短名（快速など）を巻き込まない */
const MIN_EDIT_RESCUE_LEN = 4;

/** 空白除去・半角正規化・エイリアス／骨格／編集距離1のあと最良一致（rating 含む） */
function findBestSkillMatch(rawInput: string): { cleanInput: string; target: string; rating: number } | null {
  let cleanInput = canonicalizeSkillText(rawInput);
  if (!cleanInput) return null;
  cleanInput = applyOcrSkillAlias(cleanInput);
  cleanInput = applySenmanSkeleton(cleanInput);

  const originalNames = getActiveSkillNames();
  const canonicalNames = getCanonicalSkillNames();

  if (cleanInput.length >= MIN_EDIT_RESCUE_LEN) {
    let editBestIndex = -1;
    let editDist = Infinity;
    let editDice = -1;
    for (let i = 0; i < canonicalNames.length; i++) {
      const norm = canonicalNames[i];
      if (!norm || norm.length < MIN_EDIT_RESCUE_LEN) continue;
      const d = editDistance(cleanInput, norm);
      if (d > 1) continue;
      const rating = stringSimilarity.compareTwoStrings(cleanInput, norm);
      if (d < editDist || (d === editDist && rating > editDice)) {
        editDist = d;
        editDice = rating;
        editBestIndex = i;
      }
    }
    if (editBestIndex >= 0 && editDist <= 1) {
      const originalName = originalNames[editBestIndex];
      if (!originalName) return null;
      return {
        cleanInput,
        target: originalName,
        rating: editDist === 0 ? 1 : Math.max(editDice, FUZZY_MATCH_THRESHOLD),
      };
    }
  }

  const matches = stringSimilarity.findBestMatch(cleanInput, canonicalNames);
  let bestIndex = matches.bestMatchIndex;
  let bestRating = matches.bestMatch.rating;

  const inputSuffix = cleanInput.slice(-1);
  const hasSymbol = ['○', '◎', '×'].includes(inputSuffix);
  if (hasSymbol) {
    const exactSymbolMatches = matches.ratings
      .map((r, i) => ({ rating: r.rating, target: r.target, index: i }))
      .filter((r) => r.target.endsWith(inputSuffix) && r.rating > 0.4);
    if (exactSymbolMatches.length > 0) {
      exactSymbolMatches.sort((a, b) => b.rating - a.rating);
      bestIndex = exactSymbolMatches[0].index;
      bestRating = exactSymbolMatches[0].rating;
    }
  }

  const originalName = getActiveSkillNames()[bestIndex];
  if (!originalName) return null;

  return { cleanInput, target: originalName, rating: bestRating };
}

export function fuzzyMatchSkillId(rawInput: string | null | undefined, isFirstSkill: boolean): string {
  if (!rawInput) return "";
  const best = findBestSkillMatch(rawInput);
  if (!best) return "";

  if (best.rating < FUZZY_MATCH_THRESHOLD) return "";

  // Find the exact skill objects that match the best matched name
  const matchedSkills = getActiveSkillDataList().filter(s => s.name === best.target);
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

/** 生 OCR スキル1件分のマッチ診断（読み取り専用・一覧ロジックは変更しない） */
export interface OcrSkillEntryDiag {
  /** OCR が返した生のスキル名 */
  input: string;
  /** umasim 側の最良一致名（無ければ空） */
  bestMatchName: string;
  /** 類似度 0〜1 */
  rating: number;
  /** 閾値 0.45 以上なら採用候補 */
  accepted: boolean;
  /** fuzzyMatchSkillId で解決した skillId（未解決は空） */
  skillId: string;
}

/** 注目スキル（千鍛万錬・快速など）の切り分け用 */
export interface OcrFocusSkillDiag {
  name: string;
  /** 生配列に完全一致（空白無視）があるか */
  presentInRaw: boolean;
  /** 完全一致した生文字列（複数可） */
  rawHits: string[];
  /** ヒット行があれば先頭ヒットのマッチ結果。無ければ注目名そのもので評価 */
  match: OcrSkillEntryDiag;
}

export interface OcrSkillDiagnostics {
  rawSkills: string[];
  entries: OcrSkillEntryDiag[];
  focus: OcrFocusSkillDiag[];
}

const DEFAULT_FOCUS_SKILLS = ["千鍛万錬", "快速"];

function normalizeSkillLabel(s: string): string {
  return canonicalizeSkillText(s);
}

function diagnoseOneSkill(rawInput: string, isFirstSkill: boolean): OcrSkillEntryDiag {
  const best = findBestSkillMatch(rawInput);
  const skillId = fuzzyMatchSkillId(rawInput, isFirstSkill);
  if (!best) {
    return { input: rawInput, bestMatchName: "", rating: 0, accepted: false, skillId: "" };
  }
  return {
    input: rawInput,
    bestMatchName: best.target,
    rating: best.rating,
    accepted: best.rating >= FUZZY_MATCH_THRESHOLD,
    skillId,
  };
}

/**
 * OCR 生 skills の切り分け診断（読み取り専用）。
 * fuzzyMatchSkillId / normalizeStatusData の挙動は変えない。
 */
export function buildOcrSkillDiagnostics(
  rawSkills: string[],
  focusNames: string[] = DEFAULT_FOCUS_SKILLS
): OcrSkillDiagnostics {
  const list = Array.isArray(rawSkills) ? rawSkills.map((s) => String(s ?? "")) : [];
  const entries = list.map((s, index) => diagnoseOneSkill(s, index === 0));

  const focus = focusNames.map((name) => {
    const targetNorm = normalizeSkillLabel(name);
    const rawHits = list.filter((s) => normalizeSkillLabel(s) === targetNorm);
    const presentInRaw = rawHits.length > 0;
    // ヒットがあればその行の index で isFirstSkill を合わせる。無ければ先頭以外扱い
    let match: OcrSkillEntryDiag;
    if (presentInRaw) {
      const idx = list.indexOf(rawHits[0]);
      match = diagnoseOneSkill(rawHits[0], idx === 0);
    } else {
      match = diagnoseOneSkill(name, false);
    }
    return { name, presentInRaw, rawHits, match };
  });

  return { rawSkills: list, entries, focus };
}

/** OCR で読めたが一覧に入れなかったスキル名（ユーザー向け通知用） */
export interface UnmatchedOcrSkill {
  /** OCR が返した生のスキル名 */
  input: string;
  /** ファジー最良一致名（無ければ空。対象外は出さない。rating / skillId は出さない） */
  closestName: string;
  /** シミュ非対応（仕様）か、名前照合の失敗か */
  kind: "simExcluded" | "ocrFailed";
}

let cachedMdbCanonicalNames: Set<string> | null = null;

function getMdbCanonicalNames(): Set<string> {
  if (!cachedMdbCanonicalNames) {
    cachedMdbCanonicalNames = new Set(
      Object.keys(skillRarityMap).map((n) => canonicalizeSkillText(n)).filter(Boolean)
    );
  }
  return cachedMdbCanonicalNames;
}

/**
 * 未マッチを仕様（シミュ非対応）と読み取り失敗に分ける。
 * ゲーム辞書にあるが umasim に無い名前、または末尾「ためらい」。
 */
function isSimExcludedUnmatchedName(rawInput: string): boolean {
  const clean = canonicalizeSkillText(rawInput);
  if (!clean) return false;
  const inUmasim = getCanonicalSkillNames().includes(clean);
  if (inUmasim) return false;
  if (getMdbCanonicalNames().has(clean)) return true;
  return /ためらい$/.test(clean);
}

/**
 * 生 OCR のうち fuzzyMatchSkillId が空になったもの（一覧除外と同じ判定）。
 * マッチ成功ロジック・閾値は変更しない。
 */
export function buildUnmatchedOcrSkills(rawSkills: string[]): UnmatchedOcrSkill[] {
  const list = Array.isArray(rawSkills) ? rawSkills.map((s) => String(s ?? "")) : [];
  const result: UnmatchedOcrSkill[] = [];
  for (let i = 0; i < list.length; i++) {
    const input = list[i];
    if (!normalizeSkillLabel(input)) continue;
    if (fuzzyMatchSkillId(input, i === 0)) continue;
    const simExcluded = isSimExcludedUnmatchedName(input);
    const best = simExcluded ? null : findBestSkillMatch(input);
    result.push({
      input,
      closestName: simExcluded ? "" : (best?.target ?? ""),
      kind: simExcluded ? "simExcluded" : "ocrFailed",
    });
  }
  return result;
}

export function partitionUnmatchedOcrSkills(items: UnmatchedOcrSkill[]): {
  simExcluded: UnmatchedOcrSkill[];
  ocrFailed: UnmatchedOcrSkill[];
} {
  const simExcluded: UnmatchedOcrSkill[] = [];
  const ocrFailed: UnmatchedOcrSkill[] = [];
  for (const item of items) {
    if (item.kind === "simExcluded") simExcluded.push(item);
    else ocrFailed.push(item);
  }
  return { simExcluded, ocrFailed };
}

const SIM_EXCLUDED_BODY =
  "画面では読めましたが、このアプリのシミュレーションでは使わないスキルです。読み取りの失敗ではありません。";
const OCR_FAILED_BODY =
  "名前を正式なスキル名に合わせられなかったため、取得スキルに入っていません。";

function formatUnmatchedSection(
  title: string,
  body: string,
  items: UnmatchedOcrSkill[],
  withClosest: boolean
): string {
  const lines: string[] = [];
  lines.push(`${title}（${items.length}件）`);
  lines.push("");
  lines.push(body);
  lines.push("");
  for (const item of items) {
    if (withClosest && item.closestName) {
      lines.push(`・${item.input}（近い候補: ${item.closestName}）`);
    } else {
      lines.push(`・${item.input}`);
    }
  }
  return lines.join("\n");
}

export function formatSimExcludedOcrSkillsText(items: UnmatchedOcrSkill[]): string {
  return formatUnmatchedSection("シミュ対象外", SIM_EXCLUDED_BODY, items, false);
}

export function formatOcrFailedSkillsText(items: UnmatchedOcrSkill[]): string {
  return formatUnmatchedSection("読み取り失敗", OCR_FAILED_BODY, items, true);
}

/** 未マッチ通知のコピー用テキスト（ユーザー向け・診断用語なし） */
export function formatUnmatchedOcrSkillsText(items: UnmatchedOcrSkill[]): string {
  const { simExcluded, ocrFailed } = partitionUnmatchedOcrSkills(items);
  const parts: string[] = [];
  if (simExcluded.length > 0) parts.push(formatSimExcludedOcrSkillsText(simExcluded));
  if (ocrFailed.length > 0) parts.push(formatOcrFailedSkillsText(ocrFailed));
  return parts.join("\n\n");
}

/** クリップボード共有用のプレーンテキスト */
export function formatOcrSkillDiagnosticsText(diag: OcrSkillDiagnostics): string {
  const lines: string[] = [];
  lines.push("=== OCR 診断（切り分け用）===");
  lines.push(`生スキル数: ${diag.rawSkills.length}`);
  lines.push("");
  lines.push("【読み方】");
  lines.push("- 生OCR なし → OCR 欠落（Phase B: プロンプト強化候補）");
  lines.push("- 生OCR あり・マッチ除外 → 誤読マッチ失敗（Phase B: エイリアス等）");
  lines.push("- 生OCR あり・マッチ採用なのに一覧に無い → 表示側バグ（別調査）");
  lines.push("");

  for (const f of diag.focus) {
    const verdict = f.match.accepted ? "採用" : "除外";
    lines.push(`【${f.name}】`);
    lines.push(`  生OCR: ${f.presentInRaw ? "あり" : "なし"}`);
    if (f.rawHits.length > 0) {
      lines.push(`  該当生文字列: ${f.rawHits.join(" / ")}`);
    }
    lines.push(
      `  マッチ: ${verdict} / rating=${f.match.rating.toFixed(3)} / 最良一致=${f.match.bestMatchName || "(なし)"} / skillId=${f.match.skillId || "(なし)"}`
    );
    lines.push("");
  }

  lines.push("【生スキル名一覧】");
  diag.rawSkills.forEach((s, i) => {
    const e = diag.entries[i];
    const verdict = e?.accepted ? "採用" : "除外";
    lines.push(
      `  ${i + 1}. ${s} → ${verdict} rating=${(e?.rating ?? 0).toFixed(3)} best=${e?.bestMatchName || "(なし)"} id=${e?.skillId || "-"}`
    );
  });
  return lines.join("\n");
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
