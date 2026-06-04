const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const mdbPath = path.join(__dirname, '../../master.mdb');
const db = new Database(mdbPath, { readonly: true });

// Load text data (Japanese names)
const textRows = db.prepare('SELECT `index`, text FROM text_data WHERE category=47').all();
const nameMap = {};
for (const row of textRows) {
    nameMap[row.index] = row.text;
}

// Load character data to find holder
// Wait, holder is the character ID. Let's see if card_data has it.
// Actually, unique skills (rarity 5) usually have IDs like 10xxxx where xxxx is the char ID.
// For example, 101181 -> 118 is character 10118 (or 118). 
// Gold ship is 100071 -> 1007. Let's not worry too much about holder ID for now, 
// or we can extract it from the skill ID if rarity=5.

const abilityTypesToUma = {
  1: 'passiveSpeed', 2: 'passiveStamina', 3: 'passivePower', 4: 'passiveGuts', 5: 'passiveWisdom',
  9: 'heal', 21: 'speedWithDecel', 27: 'targetSpeed', 31: 'acceleration'
};

function parseEffects(row, groupIdx = 1) {
    const result = {};
    let type = 'unknown';

    for (let i = 1; i <= 3; i++) {
        const abilityType = row[`ability_type_${groupIdx}_${i}`];
        if (!abilityType || abilityType === 0) continue;
        
        const floatValue = row[`float_ability_value_${groupIdx}_${i}`];
        const val = floatValue / 10000;
        
        const key = abilityTypesToUma[abilityType];
        if (key) {
            result[key] = val;
            if (abilityType >= 1 && abilityType <= 5) type = 'passive';
            else if (abilityType === 9) type = 'heal';
            else if (abilityType === 27 || abilityType === 21) {
                if (type === 'acceleration') type = 'composite';
                else type = 'speed';
            } else if (abilityType === 31) {
                if (type === 'speed') type = 'composite';
                else type = 'acceleration';
            }
        }
    }
    return { result, type };
}

function parseCondition(conditionStr) {
  if (!conditionStr) return { conditions: {}, tooltip: '' };
  const firstOr = conditionStr.split('@')[0];
  const parts = firstOr.split('&');
  const conditions = {};
  const tooltips = [];

  const positionalKeys = [
    'order', 'order_rate', 'bashin_diff_infront', 'bashin_diff_behind',
    'is_overtake', 'blocked_side_continuetime', 'blocked_front',
    'change_order_onetime', 'change_order_up_end_after', 'near_count',
    'temptation_count', 'is_behind_in', 'order_rate_in20_continue',
    'overtake_target_time', 'is_behind_out', 'behind_near_lane_time_set1',
    'bashin_diff_behind_all', 'bashin_diff_infront_all'
  ];

  for (const p of parts) {
    const match = p.match(/^([a-zA-Z0-9_]+)(>=|<=|==|!=|>|<)([-0-9.]+)$/);
    if (!match) {
        tooltips.push(p);
        continue;
    }
    const key = match[1], op = match[2], val = parseFloat(match[3]);

    if (positionalKeys.includes(key)) {
      tooltips.push(p);
      continue;
    }

    if (key === 'distance_rate' || key === 'remain_distance' || key === 'phase') {
      if (!conditions[key]) conditions[key] = [];
      conditions[key].push(op + val);
    } else if (op === '==') {
      conditions[key] = val;
    } else if (op === '!=') {
      if (key === 'corner' && val === 0) conditions.corner = 0;
    }
  }

  for (const key of ['distance_rate', 'remain_distance', 'phase']) {
      if (conditions[key] && conditions[key].length === 1) conditions[key] = conditions[key][0];
  }
  
  return { conditions, tooltip: tooltips.join(', ') };
}

function getUmaRarity(rarity, id) {
   if (rarity === 6) return 'evo';
   if (rarity === 5) return 'unique';
   if (rarity === 4 || rarity === 3) {
      if (rarity === 4 || id > 100000) return 'rare';
      return 'normal';
   }
   if (rarity === 2 || rarity === 1) {
      if (rarity === 2) return 'rare';
      if (id % 10 === 1) return 'double';
      return 'normal';
   }
   return 'normal';
}

const skillRows = db.prepare('SELECT * FROM skill_data').all();

const normalSkillGroupsMap = {};
const uniqueSkillData = [];

for (const row of skillRows) {
    const id = row.id;
    const name = nameMap[id] || '';
    if (!name) continue; // Skip dummy/unnamed skills

    const eff = parseEffects(row, 1);
    const cond = parseCondition(row.condition_1);
    const duration = row.float_ability_time_1 ? row.float_ability_time_1 / 10000 : 0;
    const rarity = getUmaRarity(row.rarity, id);

    let holder = undefined;
    if (rarity === 'unique') {
        // e.g. 101181 -> 1011801
        // Usually char IDs are 10xxxx (e.g. 100071 -> char 100701).
        // It's 10 + charBase (3 digits) + 01.
        let idStr = String(id);
        if (idStr.length === 6 && idStr.startsWith('10')) {
            let charBase = idStr.substring(2, 5); // 007
            holder = parseInt(`10${charBase}01`);
        } else {
            holder = null;
        }

        uniqueSkillData.push({
            id: id,
            holder: holder,
            name: name,
            name_en: '',
            name_zh: '',
            ...eff.result,
            duration: duration,
            tooltip: cond.tooltip,
            conditions: cond.conditions,
            type: 'unique'
        });
    } else {
        // Normal skills group by group_id
        const groupId = row.group_id;
        if (!normalSkillGroupsMap[groupId]) {
            normalSkillGroupsMap[groupId] = {
                type: eff.type,
                variants: [],
                conditions: cond.conditions,
                tooltip: cond.tooltip
            };
        }
        
        normalSkillGroupsMap[groupId].variants.push({
            rarity: rarity,
            id: id,
            name: name,
            name_en: '',
            name_zh: '',
            ...eff.result,
            duration: duration,
            tooltip: cond.tooltip,
            holder: rarity === 'evo' ? holder : undefined
        });
    }
}

const skillGroups = Object.values(normalSkillGroupsMap);

// Output to SkillDataGen.ts
const outPath = path.join(__dirname, '../../webapp/src/engine/data/SkillDataGen.ts');
let genContent = `// AUTO-GENERATED BY tools/mdb-extractor/extract_master.js\n\n`;
genContent += `export const normalSkillData = ${JSON.stringify(skillGroups, null, 2)};\n\n`;
genContent += `export const uniqueSkillData = ${JSON.stringify(uniqueSkillData, null, 2)};\n`;

fs.writeFileSync(outPath, genContent, 'utf8');
console.log('Skill generation complete. Wrote to: ' + outPath);
