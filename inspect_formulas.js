const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ウマ娘スキルシミュレーターver.5.0 のコピー.xlsx');

try {
  console.log('セル数式を含めてファイルを読み込んでいます...');
  const workbook = XLSX.readFile(filePath, { cellFormula: true, cellNF: true, cellStyles: true });
  
  if (workbook.SheetNames.includes('sim1')) {
    const simSheet = workbook.Sheets['sim1'];
    
    // シートの範囲を取得
    const range = XLSX.utils.decode_range(simSheet['!ref']);
    console.log(`sim1 シートの範囲: ${simSheet['!ref']}`);
    
    // 18行目（ヘッダー）と19行目（データ開始行）、20行目の数式をダンプ
    // 0-indexed で 17, 18, 19 行目
    console.log('\n--- sim1 シートの主要な列と数式の解析 ---');
    const cols = range.e.c; // 最大列数
    
    for (let c = 0; c <= cols; c++) {
      const colLetter = XLSX.utils.encode_col(c);
      
      const headerCellRef = `${colLetter}18`;
      const dataCellRef1 = `${colLetter}19`;
      const dataCellRef2 = `${colLetter}20`;
      
      const headerCell = simSheet[headerCellRef];
      const dataCell1 = simSheet[dataCellRef1];
      const dataCell2 = simSheet[dataCellRef2];
      
      if (headerCell || dataCell1) {
        console.log(`列 ${colLetter} (${headerCell ? headerCell.v : '無名'}):`);
        if (dataCell1) {
          console.log(`  Row 19: 値 = ${dataCell1.v}, 数式 = ${dataCell1.f || '直接入力'}`);
        }
        if (dataCell2) {
          console.log(`  Row 20: 値 = ${dataCell2.v}, 数式 = ${dataCell2.f || '直接入力'}`);
        }
      }
    }
  }

} catch (error) {
  console.error('エラーが発生しました:', error);
}
