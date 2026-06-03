export async function cropThumbnail(base64Image: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Failed to get 2d context"));
      
      const W = img.width;
      const cropY = W * 0.095;
      const cropHeight = W * 0.28;
      
      // クロップ先キャンバスのサイズ（実サイズと同じ）
      canvas.width = W;
      canvas.height = cropHeight;
      
      // 画像を描画 (sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
      ctx.drawImage(img, 0, cropY, W, cropHeight, 0, 0, W, cropHeight);
      
      // 軽量化のためにJPEGで出力（品質0.8）
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = base64Image;
  });
}
