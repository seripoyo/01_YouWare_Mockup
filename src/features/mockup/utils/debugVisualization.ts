/**
 * デバッグ用の視覚化ユーティリティ
 * 座標変換とスケールの問題を可視化
 */

export interface DebugVisualizationData {
  // フレーム画像の情報
  frameNatural: { w: number; h: number };
  frameDisplay: { w: number; h: number };

  // コンテナの情報
  containerSize: { w: number; h: number };

  // 検出領域の情報（パーセンテージ）
  regionPct: {
    xPct: number;
    yPct: number;
    wPct: number;
    hPct: number;
  };

  // 実際の描画座標
  actualDrawCoords: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // マスク生成座標
  maskCoords: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // スケール情報
  scale: {
    frameToContainer: number;
    displayScale: number;
  };
}

/**
 * デバッグオーバーレイをCanvasに描画
 */
export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  data: DebugVisualizationData,
  deviceIndex: number
): void {
  const { actualDrawCoords, maskCoords } = data;

  // 実際の描画領域を緑で表示
  ctx.strokeStyle = '#00FF00';
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(
    actualDrawCoords.x,
    actualDrawCoords.y,
    actualDrawCoords.width,
    actualDrawCoords.height
  );

  // マスク領域を赤で表示
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);
  ctx.strokeRect(
    maskCoords.x,
    maskCoords.y,
    maskCoords.width,
    maskCoords.height
  );

  // ラベル表示
  ctx.fillStyle = '#000000';
  ctx.fillRect(actualDrawCoords.x, actualDrawCoords.y - 25, 200, 20);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px monospace';
  ctx.fillText(
    `Device ${deviceIndex}: Actual (Green)`,
    actualDrawCoords.x + 5,
    actualDrawCoords.y - 10
  );

  ctx.fillStyle = '#000000';
  ctx.fillRect(maskCoords.x, maskCoords.y + maskCoords.height + 5, 200, 20);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(
    `Device ${deviceIndex}: Mask (Red)`,
    maskCoords.x + 5,
    maskCoords.y + maskCoords.height + 20
  );

  ctx.setLineDash([]);
}

/**
 * 座標変換の詳細をログ出力
 */
export function logCoordinateTransform(
  deviceIndex: number,
  frameNatural: { w: number; h: number },
  containerSize: { w: number; h: number },
  regionPct: { xPct: number; yPct: number; wPct: number; hPct: number },
  actualPixelCoords: { x: number; y: number; width: number; height: number }
): void {
  console.group(`🔍 Device ${deviceIndex} Coordinate Transform Analysis`);

  console.log('📐 Frame Natural Size:', frameNatural);
  console.log('📦 Container Size:', containerSize);
  console.log('📍 Region (%):', regionPct);

  // 理論上の正しい座標計算
  const scale = Math.min(
    containerSize.w / frameNatural.w,
    containerSize.h / frameNatural.h
  );
  const displayWidth = frameNatural.w * scale;
  const displayHeight = frameNatural.h * scale;
  const offsetX = (containerSize.w - displayWidth) / 2;
  const offsetY = (containerSize.h - displayHeight) / 2;

  const expectedCoords = {
    x: offsetX + regionPct.xPct * displayWidth,
    y: offsetY + regionPct.yPct * displayHeight,
    width: regionPct.wPct * displayWidth,
    height: regionPct.hPct * displayHeight
  };

  console.log('✅ Expected Coords:', expectedCoords);
  console.log('❌ Actual Coords:', actualPixelCoords);

  const diff = {
    x: actualPixelCoords.x - expectedCoords.x,
    y: actualPixelCoords.y - expectedCoords.y,
    width: actualPixelCoords.width - expectedCoords.width,
    height: actualPixelCoords.height - expectedCoords.height
  };

  console.log('⚠️ Difference:', diff);

  // 大きな差がある場合は警告
  const threshold = 5;
  if (
    Math.abs(diff.x) > threshold ||
    Math.abs(diff.y) > threshold ||
    Math.abs(diff.width) > threshold ||
    Math.abs(diff.height) > threshold
  ) {
    console.error('🚨 COORDINATE MISMATCH DETECTED!');
    console.error('The actual drawing coordinates do not match the expected coordinates.');
    console.error('This will cause the image to be positioned incorrectly.');
  }

  console.groupEnd();
}

/**
 * マスクとコンテンツの整合性チェック
 */
export function checkMaskContentAlignment(
  maskCanvas: HTMLCanvasElement,
  contentCanvas: HTMLCanvasElement,
  deviceIndex: number
): { aligned: boolean; details: string } {
  console.group(`🔍 Device ${deviceIndex} Mask-Content Alignment Check`);

  const maskSize = {
    width: maskCanvas.width,
    height: maskCanvas.height
  };

  const contentSize = {
    width: contentCanvas.width,
    height: contentCanvas.height
  };

  console.log('Mask Size:', maskSize);
  console.log('Content Size:', contentSize);

  const aligned =
    maskSize.width === contentSize.width &&
    maskSize.height === contentSize.height;

  if (!aligned) {
    console.error('🚨 MASK-CONTENT SIZE MISMATCH!');
    console.error(`Mask: ${maskSize.width}x${maskSize.height}`);
    console.error(`Content: ${contentSize.width}x${contentSize.height}`);
  } else {
    console.log('✅ Mask and content sizes match');
  }

  console.groupEnd();

  return {
    aligned,
    details: aligned
      ? 'Mask and content are aligned'
      : `Size mismatch - Mask: ${maskSize.width}x${maskSize.height}, Content: ${contentSize.width}x${contentSize.height}`
  };
}

/**
 * 完全なデバッグレポートを生成
 */
export function generateDebugReport(
  deviceIndex: number,
  data: {
    frameInfo: { natural: { w: number; h: number }; display: { w: number; h: number } };
    containerSize: { w: number; h: number };
    regionPct: { xPct: number; yPct: number; wPct: number; hPct: number };
    maskInfo: { x: number; y: number; width: number; height: number };
    compositeInfo: { x: number; y: number; width: number; height: number };
    imageInfo: { width: number; height: number; orientation: string };
  }
): string {
  const report = `
=== Device ${deviceIndex} Debug Report ===

1. FRAME INFORMATION
   Natural Size: ${data.frameInfo.natural.w}x${data.frameInfo.natural.h}
   Display Size: ${data.frameInfo.display.w}x${data.frameInfo.display.h}
   Scale Factor: ${(data.frameInfo.display.w / data.frameInfo.natural.w).toFixed(3)}

2. CONTAINER
   Size: ${data.containerSize.w}x${data.containerSize.h}

3. REGION (Percentage)
   Position: (${(data.regionPct.xPct * 100).toFixed(1)}%, ${(data.regionPct.yPct * 100).toFixed(1)}%)
   Size: ${(data.regionPct.wPct * 100).toFixed(1)}% x ${(data.regionPct.hPct * 100).toFixed(1)}%

4. MASK GENERATION
   Position: (${data.maskInfo.x}, ${data.maskInfo.y})
   Size: ${data.maskInfo.width}x${data.maskInfo.height}

5. COMPOSITE RENDERING
   Position: (${data.compositeInfo.x}, ${data.compositeInfo.y})
   Size: ${data.compositeInfo.width}x${data.compositeInfo.height}

6. IMAGE
   Original Size: ${data.imageInfo.width}x${data.imageInfo.height}
   Orientation: ${data.imageInfo.orientation}

7. ALIGNMENT CHECK
   Mask vs Composite Position: ${
     data.maskInfo.x === data.compositeInfo.x &&
     data.maskInfo.y === data.compositeInfo.y ? '✅ Aligned' : '❌ Misaligned'
   }
   Mask vs Composite Size: ${
     data.maskInfo.width === data.compositeInfo.width &&
     data.maskInfo.height === data.compositeInfo.height ? '✅ Matched' : '❌ Mismatched'
   }

8. POTENTIAL ISSUES
   ${data.maskInfo.x !== data.compositeInfo.x ? '- X position mismatch' : ''}
   ${data.maskInfo.y !== data.compositeInfo.y ? '- Y position mismatch' : ''}
   ${data.maskInfo.width !== data.compositeInfo.width ? '- Width mismatch' : ''}
   ${data.maskInfo.height !== data.compositeInfo.height ? '- Height mismatch' : ''}

========================================
  `.trim();

  return report;
}