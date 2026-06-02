const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ウマ娘スキルシミュレーターver.5.0 のコピー.xlsx');

try {
  console.log('ファイルを読み込んでいます...');
  const workbook = XLSX.readFile(filePath, { cellFormula: true });
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    let foundCount = 0;
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellRef];
        if (cell && cell.v !== null && cell.v !== undefined) {
          const valStr = String(cell.v);
          if (valStr.includes('バ身')) {
            console.log(`[${sheetName}] ${cellRef}: 値="${cell.v}" 数式="${cell.f || '直接入力'}"`);
            foundCount++;
          }
        }
      }
    }
  });

} catch (error) {
  console.error('エラーが発生しました:', error);
}
