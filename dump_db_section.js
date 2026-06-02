const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ウマ娘スキルシミュレーターver.5.0 のコピー.xlsx');

try {
  const workbook = XLSX.readFile(filePath);
  
  if (workbook.SheetNames.includes('db')) {
    const dbSheet = workbook.Sheets['db'];
    const dbData = XLSX.utils.sheet_to_json(dbSheet, { header: 1 });
    
    console.log('--- db シートの 120行目〜160行目のダンプ ---');
    for (let i = 119; i < 160 && i < dbData.length; i++) {
      const row = dbData[i];
      if (row && row.length > 0) {
        // 中身がある要素だけを表示（インデックス付き）
        const filteredRow = row.map((val, idx) => ({ idx, val })).filter(item => item.val !== null && item.val !== undefined && item.val !== '');
        console.log(`行 ${i + 1}:`, filteredRow);
      } else {
        console.log(`行 ${i + 1}: (空)`);
      }
    }
  }

} catch (error) {
  console.error('エラーが発生しました:', error);
}
