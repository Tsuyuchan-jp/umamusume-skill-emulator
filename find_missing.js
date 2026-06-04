const fs = require('fs');
const t1 = fs.readFileSync('desktop-app/app/lib/umasimSkillData.ts', 'utf-8');
const t2 = fs.readFileSync('desktop-app/app/lib/skillRarityData.ts', 'utf-8');

const s1 = [];
const regex1 = /"([^"]+)"/g;
let m;
while ((m = regex1.exec(t1)) !== null) {
  s1.push(m[1]);
}

const s2 = [];
const regex2 = /"([^"]+)":/g;
while ((m = regex2.exec(t2)) !== null) {
  s2.push(m[1]);
}

const missing = s1.filter(s => !s2.includes(s));
console.log(missing.length, 'missing skills');
console.log(missing.slice(0, 20));
