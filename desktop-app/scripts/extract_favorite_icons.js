const Jimp = require("jimp");
const fs = require("fs");
const path = require("path");

async function extract() {
  const img1Path = path.join(__dirname, "../image_1.png");
  const img2Path = path.join(__dirname, "../image_2.png");
  
  console.log("Loading images...");
  const img1 = await Jimp.read(img1Path);
  const img2 = await Jimp.read(img2Path);
  
  const outDir = path.join(__dirname, "../public/icons/favorites");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 画像中心への座標微調整
  const startX = 6;
  const startY = 8;
  const gapX = 104;
  const gapY = 98;
  
  const sizeX = 60;
  const sizeY = 60;
  
  // 前回はカメラを右下に動かしすぎて被写体が左上にはみ出たため、オフセットを大幅に減らしてカメラを左上に戻す
  const offsetX = 9; 
  const offsetY = 7; 
  
  let id = 0;
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === 6 && c >= 3) break; // 32個 (0~31) + 1個
      if (id > 32) break;

      const x = Math.round(startX + c * gapX + offsetX);
      const y = Math.round(startY + r * gapY + offsetY);
      
      // IDベースのハードコードによる画像切り替え (緑枠回避)
      let sourceImg = img1;
      if (id === 0) {
        // 大根 (設定なし): image_1は緑枠があるので image_2 を使う
        sourceImg = img2;
      } else if (id === 32) {
        // 番号12: image_2は緑枠があるので image_1 を使う
        sourceImg = img1;
      }
      
      const safeWidth = Math.min(sizeX, sourceImg.bitmap.width - x);
      const safeHeight = Math.min(sizeY, sourceImg.bitmap.height - y);
      
      let crop = sourceImg.clone().crop(x, y, safeWidth, safeHeight);
      
      await crop.writeAsync(path.join(outDir, `${id}.png`));
      id++;
    }
  }
  console.log(`Extraction complete. Saved ${id} inner-cropped icons.`);
}

extract().catch(console.error);
