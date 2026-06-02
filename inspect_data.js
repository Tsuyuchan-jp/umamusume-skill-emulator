const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ウマ娘スキルシミュレーターver.5.0 のコピー.xlsx');

try {
  console.log('ファイルを読み込んでいます...');
  const workbook = XLSX.readFile(filePath);
  
  // dbシートの確認
  if (workbook.SheetNames.includes('db')) {
    const dbSheet = workbook.Sheets['db'];
    const dbData = XLSX.utils.sheet_to_json(dbSheet, { header: 1 });
    console.log('\n--- db シート (最初の5行) ---');
    dbData.slice(0, 5).forEach((row, i) => {
      console.log(`行 ${i + 1}:`, row.slice(0, 15)); // 最初の15列のみ
    });
  }

  // レース場db5.0シートの確認
  if (workbook.SheetNames.includes('レース場db5.0')) {
    const raceSheet = workbook.Sheets['レース場db5.0'];
    const raceData = XLSX.utils.sheet_to_json(raceSheet, { header: 1 });
    console.log('\n--- レース場db5.0 シート (最初の5行) ---');
    raceData.slice(0, 5).forEach((row, i) => {
      console.log(`行 ${i + 1}:`, row.slice(0, 10)); // 最初の10列のみ
    });
  }

  // mainシートの確認
  if (workbook.SheetNames.includes('main')) {
    const mainSheet = workbook.Sheets['main'];
    const mainData = XLSX.utils.sheet_to_json(mainSheet, { header: 1 });
    console.log('\n--- main シート (最初の5行) ---');
    mainData.slice(0, 5).forEach((row, i) => {
      console.log(`行 ${i + 1}:`, row.slice(0, 10));
    });
  }

} catch (error) {
  console.error('エラーが発生しました:', error);
}
