const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ウマ娘スキルシミュレーターver.5.0 のコピー.xlsx');

try {
  const workbook = XLSX.readFile(filePath);
  
  if (workbook.SheetNames.includes('db')) {
    const dbSheet = workbook.Sheets['db'];
    const dbData = XLSX.utils.sheet_to_json(dbSheet, { header: 1 });
    console.log('dbシートの総行数:', dbData.length);
    
    // スキル名などが含まれている行を探す
    console.log('\n--- dbシート内のデータパターン探索 ---');
    let count = 0;
    for (let i = 0; i < dbData.length; i++) {
      const row = dbData[i];
      if (!row || row.length === 0) continue;
      
      // "スキル" や "速度" などのキーワードが入っているか
      const rowStr = JSON.stringify(row);
      if (rowStr.includes('スキル') || rowStr.includes('固有') || rowStr.includes('金') || rowStr.includes('回復')) {
        console.log(`行 ${i + 1} (キーワード合致):`, row.slice(0, 10));
        count++;
        if (count > 15) break;
      }
    }
  }

  if (workbook.SheetNames.includes('text')) {
    const textSheet = workbook.Sheets['text'];
    const textData = XLSX.utils.sheet_to_json(textSheet, { header: 1 });
    console.log('\n--- text シート (最初の10行) ---');
    textData.slice(0, 10).forEach((row, i) => {
      console.log(`行 ${i + 1}:`, row.slice(0, 10));
    });
  }

} catch (error) {
  console.error('エラーが発生しました:', error);
}
