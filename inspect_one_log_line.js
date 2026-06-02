const fs = require('fs');
const readline = require('readline');

const logFilePath = 'C:\\Users\\PC1\\.gemini\\antigravity\\brain\\da3df21d-8907-43b0-97af-8b6b9c4cd531\\.system_generated\\logs\\transcript.jsonl';

async function inspect() {
  if (!fs.existsSync(logFilePath)) {
    console.error('ログファイルが存在しません:', logFilePath);
    return;
  }

  const fileStream = fs.createReadStream(logFilePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log('先頭10行を表示します:');
  let count = 0;
  for await (const line of rl) {
    count++;
    console.log(`--- 行 ${count} ---`);
    console.log(line.slice(0, 1000)); // 1000文字まで
    if (count >= 10) break;
  }
}

inspect();
