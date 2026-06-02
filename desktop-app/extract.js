const fs = require('fs');

function extractStrings() {
    try {
        const buffer = fs.readFileSync('src-tauri/target/release/version/UmaReceiptCapture_v1.01.exe');
        
        const target3 = 'ウマレシートキャプチャ';
        let pos3 = buffer.indexOf(Buffer.from(target3, 'utf-8'));
        if (pos3 !== -1) {
            console.log(`Found Japanese text at ${pos3}`);
            const start = Math.max(0, pos3 - 3000);
            const end = Math.min(buffer.length, pos3 + 3000);
            const chunk = buffer.subarray(start, end);
            
            // Extract all strings that look like HTML or JS code (ascii >= 32 and <= 126, plus quotes)
            let currentString = "";
            let strings = [];
            for (let i = 0; i < chunk.length; i++) {
                const b = chunk[i];
                if ((b >= 32 && b <= 126) || b === 10 || b === 13) {
                    currentString += String.fromCharCode(b);
                } else {
                    if (currentString.length > 10) {
                        strings.push(currentString);
                    }
                    currentString = "";
                }
            }
            if (currentString.length > 10) {
                strings.push(currentString);
            }
            
            // Filter to strings containing className or < or {
            for (const s of strings) {
                if (s.includes('className') || s.includes('div') || s.includes('flex') || s.includes('text')) {
                    console.log("--- MATCH ---");
                    console.log(s);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

extractStrings();
