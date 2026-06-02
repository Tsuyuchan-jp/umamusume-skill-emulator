const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ウマ娘スキルシミュレーターver.5.0 のコピー.xlsx');

try {
  const workbook = XLSX.readFile(filePath, { cellFormula: true });
  const dbSheet = workbook.Sheets['db'];
  
  const cellRef = 'AI34';
  const cell = dbSheet[cellRef];
  
  if (cell) {
    console.log(`db!AI34: 値="${cell.v}" 数式="${cell.f || '直接入力'}"`);
  } else {
    console.log(`db!AI34 は見つかりませんでした。`);
  }

} catch (error) {
  console.error('エラーが発生しました:', error);
}
