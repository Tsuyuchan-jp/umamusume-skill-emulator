const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ウマ娘スキルシミュレーターver.5.0 のコピー.xlsx');

try {
  const workbook = XLSX.readFile(filePath, { cellFormula: true });
  
  // 1. db シートの AK9 付近の探索 (AK1〜AN30)
  if (workbook.SheetNames.includes('db')) {
    const dbSheet = workbook.Sheets['db'];
    console.log('--- db シートの AK 付近のセル解析 ---');
    const cols = ['AJ', 'AK', 'AL', 'AM', 'AN'];
    for (let r = 1; r <= 30; r++) {
      let rowOutput = [];
      cols.forEach(col => {
        const cellRef = `${col}${r}`;
        const cell = dbSheet[cellRef];
        if (cell) {
          rowOutput.push(`${col}${r}: Val="${cell.v}", Formula="${cell.f || '直接'}"`);
        }
      });
      if (rowOutput.length > 0) {
        console.log(`行 ${r}:`, rowOutput.join(' | '));
      }
    }
  }

  // 2. main シートの B26 付近の探索 (A20〜E40)
  if (workbook.SheetNames.includes('main')) {
    const mainSheet = workbook.Sheets['main'];
    console.log('\n--- main シートの B26 付近のセル解析 ---');
    const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (let r = 20; r <= 40; r++) {
      let rowOutput = [];
      cols.forEach(col => {
        const cellRef = `${col}${r}`;
        const cell = mainSheet[cellRef];
        if (cell) {
          rowOutput.push(`${col}${r}: "${cell.v}" (${cell.f ? 'f: ' + cell.f : '直'})`);
        }
      });
      if (rowOutput.length > 0) {
        console.log(`行 ${r}:`, rowOutput.join(' | '));
      }
    }
  }

} catch (error) {
  console.error('エラーが発生しました:', error);
}
