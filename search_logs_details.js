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

  console.log('過去ログの書き込みファイルを走査中...');
  const writtenFiles = new Set();
  const fileCreations = [];
  
  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    try {
      const step = JSON.parse(line);
      if (step.tool_calls) {
        step.tool_calls.forEach(call => {
          if (call.name === 'write_to_file' || call.name === 'replace_file_content') {
            const file = call.arguments.TargetFile;
            if (file) {
              writtenFiles.add(file);
              // OCRやGeminiに関連しそうなコードを検知
              const fileLower = file.toLowerCase();
              if (fileLower.includes('ocr') || fileLower.includes('gemini') || fileLower.includes('capture') || fileLower.includes('src') || fileLower.includes('lib') || fileLower.includes('main')) {
                fileCreations.push({
                  line: lineNumber,
                  tool: call.name,
                  file: file,
                  summary: call.arguments.Description || ''
                });
              }
            }
          }
        });
      }
    } catch (e) {
      // Ignore
    }
  }

  console.log('\n--- 過去の会話で作成/編集された主要なファイル ---');
  writtenFiles.forEach(f => console.log('  -', f));

  console.log('\n--- OCR / Gemini / キャプチャ関連の編集履歴 ---');
  fileCreations.forEach(entry => {
    console.log(`行 ${entry.line} [${entry.tool}]: ${entry.file}\n  詳細: ${entry.summary}`);
  });
}

search();
