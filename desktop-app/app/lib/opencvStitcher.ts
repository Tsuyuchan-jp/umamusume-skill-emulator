// @ts-nocheck

export async function stitchWithOpenCV(imageUrls: string[]): Promise<{ cleanDataUrl: string }> {
  if (!window.cv) {
    throw new Error("OpenCV.js is not loaded yet.");
  }
  const cv = window.cv;

  // 1. 画像をロードして cv.Mat に変換
  const mats = await Promise.all(imageUrls.map(url => loadMat(url, cv)));
  if (mats.length === 0) throw new Error("No images to stitch.");

  // 2. 最初の画像からウマ娘のUI領域を正確に切り抜く
  const cropRect = findCropBounds(mats[0], cv);
  console.log("Detected UI Bounds:", cropRect);

  if (cropRect.width === 0 || cropRect.height === 0) {
    throw new Error("UI領域を検出できませんでした。");
  }

  // 全ての画像をUIサイズにクロップ
  const croppedMats = mats.map(mat => mat.roi(cropRect));

  // 3. 静的領域（ヘッダー・フッター）とスクロール領域（中間）を定義
  // ウマ娘のUI: 上部16%がタブ等、下部15%が閉じるボタン等
  const headerHeight = Math.floor(cropRect.height * 0.16);
  const footerHeight = Math.floor(cropRect.height * 0.15);
  const scrollHeight = cropRect.height - headerHeight - footerHeight;

  console.log(`Header: ${headerHeight}px, Scroll: ${scrollHeight}px, Footer: ${footerHeight}px`);

  // ヘッダーとフッターを最初のフレームと最後のフレームから確保
  const headerMat = croppedMats[0].roi(new cv.Rect(0, 0, cropRect.width, headerHeight));
  const footerMat = croppedMats[croppedMats.length - 1].roi(new cv.Rect(0, cropRect.height - footerHeight, cropRect.width, footerHeight));

  // 全フレームのスクロール領域（動的要素のみ）を抽出
  const scrollMats = croppedMats.map(mat => mat.roi(new cv.Rect(0, headerHeight, cropRect.width, scrollHeight)));

  // 4. スクロール領域同士でテンプレートマッチングを行い、スクロール量を計算
  const overlaps = [];
  for (let i = 0; i < scrollMats.length - 1; i++) {
    const prev = scrollMats[i];
    const curr = scrollMats[i + 1];

    // スクロールバー（右端）を無視するため、幅を95%に絞る
    const searchWidth = Math.floor(cropRect.width * 0.95);
    
    // prev の下部をテンプレートとする (高さ20%)
    const templateHeight = Math.floor(scrollHeight * 0.2);
    // テンプレートの開始Y位置を下端に設定 (一番下から templateHeight 分上)
    const templateY = scrollHeight - templateHeight; 

    const templateRect = new cv.Rect(0, templateY, searchWidth, templateHeight);
    const template = prev.roi(templateRect);

    // curr の探索領域（スクロールバーを除外した幅）
    const currSearchArea = curr.roi(new cv.Rect(0, 0, searchWidth, scrollHeight));

    const result = new cv.Mat();
    // TM_CCOEFF_NORMED でマッチング（最も精度が高い）
    cv.matchTemplate(currSearchArea, template, result, cv.TM_CCOEFF_NORMED);

    const minMax = cv.minMaxLoc(result);
    const matchedY = minMax.maxLoc.y;
    const maxVal = minMax.maxVal; // 相関スコア (1.0に近いほど完全一致)

    // スクロール量 = 元の位置 - マッチした位置
    const scrollAmount = templateY - matchedY;
    console.log(`Frame ${i} -> ${i+1}: score=${maxVal.toFixed(3)}, scrollAmount=${scrollAmount}`);

    // バウンド判定：スコアが低い「かつ」スクロール量が0以下（後退）の場合のみ本物のバウンドとみなす
    // スコアが低くてもスクロール量が正の場合は、大きなスクロールによるマッチング難易度上昇が原因なので正常とみなす
    if (maxVal < 0.85 && scrollAmount <= 0) {
      console.warn(`スコアが低すぎます(${maxVal.toFixed(3)}) かつ スクロール後退(${scrollAmount})。バウンドと判断し、以降のフレームを破棄します。`);
      // バウンドしたフレーム（i+1）以降を完全に削除し、結合処理を終了する
      scrollMats.splice(i + 1);
      break;
    } else if (scrollAmount <= 0) {
      console.warn(`スクロール量が0以下です: ${scrollAmount}。このフレームはスキップします。`);
      overlaps.push(0);
    } else {
      overlaps.push(scrollAmount);
    }

    result.delete(); template.delete(); currSearchArea.delete();
  }

  // 5. 最終的な結合画像の高さを計算
  let totalScrollHeight = scrollHeight;
  for (const scroll of overlaps) {
    totalScrollHeight += scroll;
  }
  
  const finalHeight = headerHeight + totalScrollHeight + footerHeight;
  const finalMat = new cv.Mat(finalHeight, cropRect.width, cv.CV_8UC4, new cv.Scalar(0,0,0,255));

  // 6. 画像の合成
  let currentY = 0;
  
  // ヘッダーを描画
  const headerRoi = finalMat.roi(new cv.Rect(0, currentY, cropRect.width, headerHeight));
  headerMat.copyTo(headerRoi);
  headerRoi.delete();
  currentY += headerHeight;

  // スクロール領域の最初のフレームを描画
  const firstScrollRoi = finalMat.roi(new cv.Rect(0, currentY, cropRect.width, scrollHeight));
  scrollMats[0].copyTo(firstScrollRoi);
  firstScrollRoi.delete();
  let scrollDrawY = currentY + scrollHeight;

  // 2枚目以降のスクロール領域を描画（スクロールした分だけ下部を追加）
  for (let i = 1; i < scrollMats.length; i++) {
    const scroll = overlaps[i - 1];
    if (scroll > 0) {
      const curr = scrollMats[i];
      // 追加された下部の `scroll` 行分を切り出して貼り付け
      const bottomPart = curr.roi(new cv.Rect(0, scrollHeight - scroll, cropRect.width, scroll));
      const dstRoi = finalMat.roi(new cv.Rect(0, scrollDrawY, cropRect.width, scroll));
      bottomPart.copyTo(dstRoi);
      dstRoi.delete();
      scrollDrawY += scroll;
      bottomPart.delete();
    }
  }

  // --- スクロール領域のスクロールバー除去（ピクセル水平リピート方式） ---
  // Y座標の動的特定（Shift-Overlap方式）
  let trueScrollStartY = headerHeight;
  if (croppedMats.length > 1 && overlaps.length > 0 && overlaps[0] > 0) {
    const scrollAmount = overlaps[0];
    const prev = croppedMats[0];
    const curr = croppedMats[1];
    
    // スクロール量が画像高さを超えていない場合のみ処理
    if (scrollAmount < prev.rows) {
      // 1枚目を上にスクロール量だけずらしたROI
      const shiftedPrev = prev.roi(new cv.Rect(0, scrollAmount, prev.cols, prev.rows - scrollAmount));
      // 2枚目の重なる部分のROI
      const currOverlap = curr.roi(new cv.Rect(0, 0, curr.cols, curr.rows - scrollAmount));
      
      const diff = new cv.Mat();
      cv.absdiff(shiftedPrev, currOverlap, diff);
      cv.cvtColor(diff, diff, cv.COLOR_RGBA2GRAY);
      
      let matchCount = 0;
      // スクロール領域の開始を探す
      for (let y = headerHeight; y < diff.rows; y++) {
        let diffSum = 0;
        const rowPtr = diff.ucharPtr(y);
        // 右端のスクロールバーの影響を避けるため、幅の80%のみをチェック
        const checkWidth = Math.floor(diff.cols * 0.8);
        for (let x = 0; x < checkWidth; x++) {
          diffSum += rowPtr[x];
        }
        
        // 1ピクセルあたりの平均誤差を算出
        const avgDiff = diffSum / checkWidth;
        
        // 誤差が5未満（ノイズ許容）なら一致とみなす
        if (avgDiff < 5) {
          matchCount++;
          // 10行連続でピタリと一致すれば、そこが間違いなくスクロール開始位置
          if (matchCount >= 10) {
            trueScrollStartY = y - 9;
            break;
          }
        } else {
          matchCount = 0;
        }
      }
      
      diff.delete();
      shiftedPrev.delete();
      currOverlap.delete();
    }
  }

  const sbWidth = Math.ceil(cropRect.width * 0.03); // 約3%
  const safeX = finalMat.cols - sbWidth - 1;
  const scrollRegionH = scrollDrawY - trueScrollStartY;
  
  if (sbWidth > 0 && safeX > 0 && scrollRegionH > 0) {
    const srcCol = finalMat.roi(new cv.Rect(safeX, trueScrollStartY, 1, scrollRegionH));
    const dstRegion = finalMat.roi(new cv.Rect(safeX + 1, trueScrollStartY, sbWidth, scrollRegionH));
    cv.repeat(srcCol, 1, sbWidth, dstRegion);
    srcCol.delete();
    dstRegion.delete();
  }
  // -----------------------------------------------------------------

  // フッターを描画
  const footerRoi = finalMat.roi(new cv.Rect(0, scrollDrawY, cropRect.width, footerHeight));
  footerMat.copyTo(footerRoi);
  footerRoi.delete();

  // --- 【追加機能】「継承履歴」以降の自動クロップ（高速化版） ---
  let outputMat = finalMat;
  let historyBarY = -1; // 後続のメモリ解放処理のために変数を維持
  
  // 【超高速化】一番上にある「因子」ヘッダーを無視するため、探索開始位置を下げる
  const searchStartY = Math.floor(headerHeight + cropRect.height * 0.4);
  
  const hsv = new cv.Mat();
  cv.cvtColor(finalMat, hsv, cv.COLOR_RGBA2RGB);
  cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

  const lowGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [35, 100, 100, 0]);
  const highGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [85, 255, 255, 0]);
  
  const mask = new cv.Mat();
  cv.inRange(hsv, lowGreen, highGreen, mask);

  const minGreenPixels = Math.floor(finalMat.cols * 0.8); // 横幅の80%以上が緑
  
  // 上から下へスキャンし、最初に条件を満たす行（＝継承履歴バーの最上部）を見つける
  for (let y = searchStartY; y < finalMat.rows; y++) {
    let greenCount = 0;
    const rowPtr = mask.ucharPtr(y);
    for (let x = 0; x < mask.cols; x++) {
      if (rowPtr[x] > 0) greenCount++;
    }
    
    if (greenCount > minGreenPixels) {
      historyBarY = y;
      break; 
    }
  }

  hsv.delete(); lowGreen.delete(); highGreen.delete(); mask.delete();

  let cropped = false;
  if (historyBarY !== -1) {
    if (historyBarY < headerHeight + cropRect.height * 0.5) {
      console.log("検出された緑ラインは「因子」ヘッダーと判定されたため、クロップをスキップします。Y=", historyBarY);
      historyBarY = -1; // クロップしない
    } else {
      console.log("継承履歴の緑ラインを検出しました。Y=", historyBarY);
      outputMat = finalMat.roi(new cv.Rect(0, 0, finalMat.cols, historyBarY));
      cropped = true;
    }
  }

  // 継承履歴がない場合、スクロール末端の余白（白い背景）を自動クロップする
  if (!cropped) {
    let contentBottomY = scrollDrawY;
    
    // 下から上へ10pxずつスキャンして、因子枠や星などのコンテンツ末端を探す
    for (let y = scrollDrawY - 10; y >= 0; y -= 10) {
      const rowMat = finalMat.roi(new cv.Rect(0, y, finalMat.cols, 10));
      const mean = new cv.Mat();
      const stddev = new cv.Mat();
      cv.meanStdDev(rowMat, mean, stddev);
      const std = (stddev.doubleAt(0, 0) + stddev.doubleAt(1, 0) + stddev.doubleAt(2, 0)) / 3;
      rowMat.delete(); mean.delete(); stddev.delete();
      
      if (std > 20) { // 背景のグラデーションノイズを無視し、因子枠などの明確な輪郭だけを検知する
        contentBottomY = Math.min(y + 20, finalMat.rows); // 見栄え良く20pxの余白を残す
        break;
      }
    }
    
    console.log("余白を自動スキップし、Y=", contentBottomY, "でクロップします（元のY=", scrollDrawY, "）");
    outputMat = finalMat.roi(new cv.Rect(0, 0, finalMat.cols, contentBottomY));
    cropped = true;
  }


  // ------------------------------------------------

  // 7. Canvasに描画して、結合画像（クリーンな画像）を取得する
  const canvas = document.createElement('canvas');
  canvas.width = outputMat.cols;
  canvas.height = outputMat.rows;
  cv.imshow(canvas, outputMat);
  const cleanDataUrl = canvas.toDataURL("image/png");

  // メモリ解放
  if (cropped) {
    outputMat.delete();
  }
  finalMat.delete(); headerMat.delete(); footerMat.delete();
  mats.forEach(m => m.delete());
  croppedMats.forEach(m => m.delete());
  scrollMats.forEach(m => m.delete());

  return { cleanDataUrl };
}


function loadMat(url: string, cv: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const mat = cv.imread(img);
      resolve(mat);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function findCropBounds(mat: any, cv: any): any {


  const hsv = new cv.Mat();
  cv.cvtColor(mat, hsv, cv.COLOR_RGBA2RGB);
  cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

  // 参考サイト準拠の広いHSV閾値（柄の暗い部分も緑として拾い上げる）
  const lowGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [20, 150, 0, 0]);
  const highGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [60, 255, 255, 0]);
  
  const mask = new cv.Mat();
  cv.inRange(hsv, lowGreen, highGreen, mask);

  const searchHeight = Math.floor(mat.rows * 0.3); // 上部30%のみ探索
  let maxDetectedWidth = 0;
  let widestLeftX = -1;
  let widestRightX = -1;

  // 1. まず画面上部で最も横幅の広い緑色の帯（＝ヘッダーの角丸より下の部分）の最大幅を測定する
  for (let y = 0; y < searchHeight; y++) {
    let firstX = -1;
    let lastX = -1;
    const rowPtr = mask.ucharPtr(y);
    for (let x = 0; x < mask.cols; x++) {
      if (rowPtr[x] > 0) {
        if (firstX === -1) firstX = x;
        lastX = x;
      }
    }
    if (firstX !== -1) {
      const currentWidth = lastX - firstX + 1;
      if (currentWidth > maxDetectedWidth) {
        maxDetectedWidth = currentWidth;
        widestLeftX = firstX;
        widestRightX = lastX;
      }
    }
  }

  let headerY = -1;

  // 2. その最大幅とほぼ同じ幅（95%以上）を持つ行の中で、一番上にある行を「ヘッダーの頂点(Y軸)」とする
  for (let y = 0; y < searchHeight; y++) {
    let firstX = -1;
    let lastX = -1;
    const rowPtr = mask.ucharPtr(y);
    for (let x = 0; x < mask.cols; x++) {
      if (rowPtr[x] > 0) {
        if (firstX === -1) firstX = x;
        lastX = x;
      }
    }
    if (firstX !== -1) {
      const currentWidth = lastX - firstX + 1;
      if (currentWidth >= maxDetectedWidth * 0.95) {
        headerY = y;
        break; // 一番上のヘッダー行を見つけたら終了
      }
    }
  }

  hsv.delete(); lowGreen.delete(); highGreen.delete(); mask.delete();

  if (headerY !== -1) {
    const startY = headerY;
    // X軸の決定：一番横幅が広い行の左右端をそのまま真のUI幅とする（角丸の影響を排除）
    const startX = widestLeftX;
    const uiWidth = widestRightX - widestLeftX + 1;

    // 真のUI幅から、アスペクト比(16:9)を使って真のUI高さを算出する
    let uiHeight = Math.floor(uiWidth / 0.5625);

    // キャプチャ画像の下端をはみ出さないように安全対策
    if (startY + uiHeight > mat.rows) {
      uiHeight = mat.rows - startY;
    }

    return new cv.Rect(
      startX, 
      startY, 
      uiWidth, 
      uiHeight
    );
  }

  // 万が一見つからなかった場合のフォールバック（中央を適当にクロップ）
  console.warn("緑のヘッダーが見つかりませんでした。フォールバック処理を行います。");
  const fallbackUiWidth = Math.floor(mat.rows * 0.5625);
  let fallbackX = Math.floor((mat.cols - fallbackUiWidth) / 2);
  if (fallbackX < 0) fallbackX = 0;
  return new cv.Rect(
    fallbackX, 
    0, 
    Math.min(fallbackUiWidth, mat.cols), 
    mat.rows
  );
}


