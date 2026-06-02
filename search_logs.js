const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logFilePath = 'C:\\Users\\PC1\\.gemini\\antigravity\\brain\\da3df21d-8907-43b0-97af-8b6b9c4cd531\\.system_generated\\logs\\transcript.jsonl';

async function search() {
  if (!fs.existsSync(logFilePath)) {
    console.error('ログファイルが存在しません:', logFilePath);
    return;
  }

  const fileStream = fs.createReadStream(logFilePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log('ログファイルをスキャン中...');
  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    try {
      const step = JSON.parse(line);
      const stepStr = JSON.stringify(step).toLowerCase();
      
      if (stepStr.includes('ocr') || stepStr.includes('gemini') || stepStr.includes('tesseract')) {
        console.log(`\n=== 行 ${lineNumber} | タイプ: ${step.type} | ステータス: ${step.status} ===`);
        
        if (step.tool_calls) {
          step.tool_calls.forEach((call, cidx) => {
            console.log(`  ツール [${cidx}]: ${call.name}`);
            if (call.arguments) {
              const argsStr = JSON.stringify(call.arguments);
              if (call.arguments.TargetFile) {
                console.log(`    TargetFile: ${call.arguments.TargetFile}`);
              }
              if (call.arguments.CodeContent) {
                console.log(`    CodeContent抜粋:\n${call.arguments.CodeContent.slice(0, 400)}...\n`);
              }
              if (call.arguments.CommandLine) {
                console.log(`    CommandLine: ${call.arguments.CommandLine}`);
              }
            }
          });
        }
        
        if (step.content && typeof step.content === 'string') {
          console.log(`  テキスト抜粋: ${step.content.slice(0, 200)}...`);
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
}

search();
