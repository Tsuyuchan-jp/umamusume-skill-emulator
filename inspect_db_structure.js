const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ウマ娘スキルシミュレーターver.5.0 のコピー.xlsx');

try {
  const workbook = XLSX.readFile(filePath);
  const dbSheet = workbook.Sheets['db'];
  const dbData = XLSX.utils.sheet_to_json(dbSheet, { header: 1 });
  
  // 文字列セルの頻度集計
  const stringFrequency = {};
  
  dbData.forEach((row, i) => {
    if (!row) return;
    row.forEach((val, j) => {
      if (val !== null && val !== undefined && val !== '') {
        const valStr = String(val).trim();
        if (isNaN(valStr) && valStr.length > 1) { // 数値ではなく、2文字以上の文字列
          stringFrequency[valStr] = (stringFrequency[valStr] || 0) + 1;
        }
      }
    });
  });
  
  // 頻度順にソートして上位100件を表示
  const sortedStrings = Object.entries(stringFrequency)
    .sort((a, b) => b[1] - a[1]);
    
  console.log('--- db シート内の文字列出現頻度上位 100件 ---');
  sortedStrings.slice(0, 100).forEach(([str, count], index) => {
    console.log(`${index + 1}: "${str}" (出現回数: ${count})`);
  });

} catch (error) {
  console.error('エラーが発生しました:', error);
}
