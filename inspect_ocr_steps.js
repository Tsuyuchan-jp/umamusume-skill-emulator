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

  console.log('行 6180 〜 6210 のログをダンプします:');
  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    if (lineNumber >= 6180 && lineNumber <= 6210) {
      const step = JSON.parse(line);
      console.log(`\n--- 行 ${lineNumber} | タイプ: ${step.type} | ソース: ${step.source} ---`);
      if (step.thinking) {
        console.log(`[Thinking]:\n${step.thinking.slice(0, 500)}...\n`);
      }
      if (step.content) {
        console.log(`[Content]:\n${step.content.slice(0, 1500)}`);
      }
    }
  }
}

inspect();
