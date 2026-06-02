const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ウマ娘スキルシミュレーターver.5.0 のコピー.xlsx');

try {
  const workbook = XLSX.readFile(filePath);
  const simSheet = workbook.Sheets['sim1'];
  const simData = XLSX.utils.sheet_to_json(simSheet, { header: 1 });
  
  console.log('--- sim1 シート (最初の30行) ---');
  simData.slice(0, 30).forEach((row, i) => {
    if (row && row.length > 0) {
      // 空でない値をインデックス付きで表示
      const filteredRow = row.map((val, idx) => ({ idx, val })).filter(item => item.val !== null && item.val !== undefined && item.val !== '');
      console.log(`行 ${i + 1}:`, filteredRow.slice(0, 15)); // 最初の15列のみ
    } else {
      console.log(`行 ${i + 1}: (空)`);
    }
  });

} catch (error) {
  console.error('エラーが発生しました:', error);
}
