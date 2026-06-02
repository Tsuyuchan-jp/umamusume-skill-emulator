const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'ウマ娘スキルシミュレーターver.5.0 のコピー.xlsx');

try {
  console.log('ファイルを読み込んでいます...');
  const workbook = XLSX.readFile(filePath);
  console.log('読み込みが完了しました。');
  console.log('シート数:', workbook.SheetNames.length);
  console.log('シート一覧:');
  workbook.SheetNames.forEach((name, index) => {
    console.log(`${index + 1}: ${name}`);
  });
} catch (error) {
  console.error('エラーが発生しました:', error);
}
