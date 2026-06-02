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

  console.log('詳細スキャン中...');
  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    try {
      const step = JSON.parse(line);
      const content = step.content || '';
      const contentLower = content.toLowerCase();
      
      // OCR or Gemini or Tesseract or gemini-api or apiキー
      if (contentLower.includes('ocr') || contentLower.includes('gemini') || contentLower.includes('tesseract')) {
        // Created file やコードブロックがあるか
        if (content.includes('```') && (contentLower.includes('const') || contentLower.includes('import') || contentLower.includes('fn ') || contentLower.includes('struct'))) {
          console.log(`\n=== 行 ${lineNumber} | タイプ: ${step.type} | 作成日: ${step.created_at} ===`);
          // コードブロックを抽出
          const codeBlocks = content.match(/```[\s\S]*?```/g);
          if (codeBlocks) {
            codeBlocks.forEach((block, bidx) => {
              if (block.toLowerCase().includes('ocr') || block.toLowerCase().includes('gemini') || block.toLowerCase().includes('api')) {
                console.log(`  [コードブロック ${bidx + 1}]:\n${block.slice(0, 800)}...\n`);
              }
            });
          } else {
            console.log(`  テキスト抜粋:\n${content.slice(0, 300)}...\n`);
          }
        }
      }
    } catch (e) {
      // Ignore
    }
  }
}

search();
