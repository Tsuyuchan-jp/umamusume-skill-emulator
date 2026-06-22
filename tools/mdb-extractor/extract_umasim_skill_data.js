/**
 * umasim の skill_data.txt から desktop-app 用の umasimSkillData.ts を生成する。
 *
 * 使い方:
 *   node tools/mdb-extractor/extract_umasim_skill_data.js
 *   node tools/mdb-extractor/extract_umasim_skill_data.js path/to/skill_data.txt
 *
 * 引数なしの場合は umasim 公式リポジトリから最新データを取得する。
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const DEFAULT_URL =
  'https://raw.githubusercontent.com/mee1080/umasim/refs/heads/main/data/skill_data.txt';

const rootDir = path.join(__dirname, '../..');
const outPath = path.join(rootDir, 'desktop-app/app/lib/umasimSkillData.ts');
const publicSkillDataPath = path.join(rootDir, 'desktop-app/public/skill_data.txt');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchUrl(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} while fetching ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });
}

async function loadSkillData() {
  const localArg = process.argv[2];
  if (localArg) {
    const localPath = path.isAbsolute(localArg)
      ? localArg
      : path.join(process.cwd(), localArg);
    console.log(`Loading local file: ${localPath}`);
    return fs.readFileSync(localPath, 'utf8');
  }

  console.log(`Fetching: ${DEFAULT_URL}`);
  return fetchUrl(DEFAULT_URL);
}

/** extract 後も維持する手書きヘルパー（umasimSkillData.ts 末尾に追記） */
const HELPERS_TAIL = `
type UmasimSkillEntry = (typeof umasimSkillDataList)[number];

/** パレットに表示しないレアリティ（育成外の特殊スキル・マイナス効果スキル） */
export const PALETTE_EXCLUDED_RARITIES = new Set(['special', 'minus']);

/** 同名スキル dedupe 時の ID 解決優先順位（inherit 明示優先） */
const PALETTE_ID_RESOLVE_PRIORITY = ['inherit', 'evo', 'rare', 'normal'] as const;

export function isPaletteVisibleSkill(skill: UmasimSkillEntry, onlyUnique: boolean): boolean {
  if (onlyUnique) return skill.rarity === 'unique';
  if (skill.rarity === 'unique') return false;
  return !PALETTE_EXCLUDED_RARITIES.has(skill.rarity);
}

function resolvePaletteSkillId(candidates: UmasimSkillEntry[]): string {
  for (const rarity of PALETTE_ID_RESOLVE_PRIORITY) {
    const match = candidates.find((s) => s.rarity === rarity);
    if (match) return String(match.id);
  }
  const other = candidates.find(
    (s) => !PALETTE_ID_RESOLVE_PRIORITY.includes(s.rarity as (typeof PALETTE_ID_RESOLVE_PRIORITY)[number])
  );
  if (other) return String(other.id);
  return String(candidates[0].id);
}

export interface PaletteSkillOption {
  value: string;
  label: string;
}

/** パレット用スキル一覧（正本: umasimSkillDataList） */
export function buildPaletteSkillOptions(options: { onlyUnique?: boolean } = {}): PaletteSkillOption[] {
  const { onlyUnique = false } = options;
  const byName = new Map<string, UmasimSkillEntry[]>();

  for (const skill of umasimSkillDataList) {
    if (!isPaletteVisibleSkill(skill, onlyUnique)) continue;
    const list = byName.get(skill.name) ?? [];
    list.push(skill);
    byName.set(skill.name, list);
  }

  const seen = new Set<string>();
  const result: PaletteSkillOption[] = [];

  for (const skill of umasimSkillDataList) {
    if (!isPaletteVisibleSkill(skill, onlyUnique)) continue;
    if (seen.has(skill.name)) continue;
    seen.add(skill.name);
    result.push({
      value: resolvePaletteSkillId(byName.get(skill.name)!),
      label: skill.name,
    });
  }

  return result;
}

export function getSkillById(id: string) {
  return umasimSkillDataList.find(s => String(s.id) === String(id));
}

export function getSkillNameById(id: string): string {
  const skill = getSkillById(id);
  return skill ? skill.name : id;
}

/** 通常固有スキル（先頭スロット専用） */
export function isUniqueSkillId(id: string): boolean {
  return getSkillById(id)?.rarity === 'unique';
}

export type SkillDisplayRarity = 'unique' | 'inherit' | 'evo' | 'rare' | 'white';

export interface SkillRarityDisplayInfo {
  rarity: SkillDisplayRarity;
  icon: string;
  colorClass: string;
}

const WHITE_DISPLAY: SkillRarityDisplayInfo = {
  rarity: 'white',
  icon: '',
  colorClass: 'text-zinc-200',
};

/** スキル ID から UI 色分け情報を取得（名前では判別不可なため ID 必須） */
export function getSkillRarityInfoById(skillId: string): SkillRarityDisplayInfo {
  const skill = getSkillById(skillId);
  if (!skill) return WHITE_DISPLAY;

  switch (skill.rarity) {
    case 'unique':
      return { rarity: 'unique', icon: '◆', colorClass: 'text-blue-400' };
    case 'inherit':
      return { rarity: 'inherit', icon: '❖', colorClass: 'text-emerald-400' };
    case 'evo':
      return { rarity: 'evo', icon: '★', colorClass: 'text-red-400' };
    case 'rare':
      return { rarity: 'rare', icon: '✦', colorClass: 'text-amber-400' };
    default:
      return WHITE_DISPLAY;
  }
}

/** 通常固有は先頭（index 0）のみ配置可能 */
export function canPlaceSkillAtIndex(skillId: string, index: number): boolean {
  if (index === 0) return true;
  return !isUniqueSkillId(skillId);
}

/** 2つ目以降に混入した通常固有を除去 */
export function sanitizeSkillIds(skillIds: string[]): string[] {
  return skillIds.filter((id, index) => index === 0 || !isUniqueSkillId(id));
}
`;

function buildTsContent(list) {
  const body = JSON.stringify(list, null, 2);
  return `// Auto-generated by tools/mdb-extractor/extract_umasim_skill_data.js
// Source: umasim data/skill_data.txt

export const umasimSkillDataList = ${body};
export const umasimSkillNames = umasimSkillDataList.map(s => s.name);
${HELPERS_TAIL}`;
}

async function main() {
  const raw = await loadSkillData();
  const skills = JSON.parse(raw);

  const list = skills.map((skill) => ({
    name: skill.name,
    id: String(skill.id),
    rarity: skill.rarity,
  }));

  fs.writeFileSync(outPath, buildTsContent(list), 'utf8');
  fs.writeFileSync(publicSkillDataPath, raw, 'utf8');
  console.log(`Successfully generated umasimSkillData.ts with ${list.length} skills.`);
  console.log(`Output: ${outPath}`);
  console.log(`Bundled fallback: ${publicSkillDataPath}`);
}

main().catch((err) => {
  console.error('Failed to generate umasimSkillData.ts:', err.message);
  process.exit(1);
});
