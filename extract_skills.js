const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ウマ娘スキルシミュレーターver.5.0 のコピー.xlsx');

try {
  const workbook = XLSX.readFile(filePath);
  
  if (workbook.SheetNames.includes('db')) {
    const dbSheet = workbook.Sheets['db'];
    const dbData = XLSX.utils.sheet_to_json(dbSheet, { header: 1 });
    
    const skills = [];
    
    // 130行目（インデックス129）から末尾までスキャン
    for (let i = 129; i < dbData.length; i++) {
      const row = dbData[i];
      if (!row) continue;
      
      const skillName = row[3]; // D列 (index 3)
      const effectVal = row[4]; // E列 (index 4)
      const condition = row[7]; // H列 (index 7)
      
      // スキル名があり、"（指定なし）" などを除外
      if (skillName && typeof skillName === 'string' && skillName !== '名前' && skillName !== '（指定なし）' && skillName.trim() !== '') {
        skills.push({
          row: i + 1,
          name: skillName,
          effect: effectVal,
          condition: condition || ''
        });
      }
    }
    
    console.log(`抽出されたスキル数: ${skills.length}`);
    console.log('\n--- 最初の15個のスキル ---');
    skills.slice(0, 15).forEach(s => {
      console.log(`行 ${s.row}: [${s.name}] 効果値: ${s.effect}, 条件: ${s.condition}`);
    });
    
    console.log('\n--- 最後の15個のスキル ---');
    skills.slice(-15).forEach(s => {
      console.log(`行 ${s.row}: [${s.name}] 効果値: ${s.effect}, 条件: ${s.condition}`);
    });
  }

} catch (error) {
  console.error('エラーが発生しました:', error);
}
