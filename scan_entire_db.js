const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ウマ娘スキルシミュレーターver.5.0 のコピー.xlsx');

try {
  const workbook = XLSX.readFile(filePath);
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`シート名: ${sheetName}, 行数: ${data.length}`);
    
    // 各シートでよく見かけるスキル名が含まれているかスキャン
    // 例: "マエストロ", "一陣の風", "コーナー", "直線", "末脚", "弧線"
    const keywords = ['マエストロ', '一陣の風', 'コーナー回復', '直線回復', '末脚', '弧線のプロフェッサー', 'キラーチューン', '脱出術', 'スリップストリーム'];
    
    let found = false;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      for (let j = 0; j < row.length; j++) {
        const val = row[j];
        if (val && typeof val === 'string') {
          for (const kw of keywords) {
            if (val.includes(kw)) {
              console.log(`  -> 発見 [${sheetName}] 行 ${i + 1}, 列 ${j + 1} (${XLSX.utils.encode_col(j)}): "${val}"`);
              found = true;
            }
          }
        }
      }
    }
  });

} catch (error) {
  console.error('エラーが発生しました:', error);
}
