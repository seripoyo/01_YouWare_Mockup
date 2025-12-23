/**
 * 白エリア抽出ユーティリティ
 * マークダウン仕様に基づき、デバイス画面の白エリアを精密に検出
 * 黒ベゼルを考慮し、デバイスごとに異なる色で塗りつぶす
 */

import { DEVICE_FILL_COLORS, DEVICE_COLOR_ORDER, type DeviceIndex } from '../constants/deviceColors';

export interface Point {
  x: number;
  y: number;
}

export interface DetectedRegion {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pixels: number[]; // Array of pixel indices in the region
  mask: Uint8Array; // Binary mask for the region
  area: number;
  rectangularity: number;
  bezelScore: number;
  overallScore: number;
  bezelEdges: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export interface ScreenRegion extends DetectedRegion {
  deviceIndex: DeviceIndex;
  fillColor: string;
  corners: [Point, Point, Point, Point];
  centroid: Point;
}

export interface DetectionOptions {
  luminanceThreshold?: number;   // 白判定閾値 (0.0〜1.0)
  minAreaRatio?: number;         // 最小面積比
  minRectangularity?: number;    // 最小矩形度
  minBezelScore?: number;        // 最小ベゼルスコア
  bezelWidth?: number;           // ベゼルチェック幅（px）
  darkThreshold?: number;        // 暗いピクセルの閾値
  minBezelEdges?: number;        // 必要なベゼル辺の数
}

const DEFAULT_OPTIONS: Required<DetectionOptions> = {
  luminanceThreshold: 0.90,
  minAreaRatio: 0.003,      // 0.005→0.003: 小さな画面領域も検出可能に
  minRectangularity: 0.25,  // 0.35→0.25: 平置き斜めデバイスの透視変形に対応
  minBezelScore: 0.10,      // 0.12→0.10: 平置きデバイスで一部ベゼルが見えないケースに対応
  bezelWidth: 20,           // 15→20: より広い範囲でベゼルを検出
  darkThreshold: 0.55,      // 0.50→0.55: より明るいグレーベゼルも検出可能に
  minBezelEdges: 1,         // 片側のみベゼルが見えるケースに対応
};

// ============================================
// Phase 1: 検出精度向上のための新機能
// ============================================

/**
 * デバイス画面らしいアスペクト比かどうかをスコア化
 * スマートフォン: 約1.8〜2.2 (9:16〜9:20相当)
 * タブレット: 約1.3〜1.5
 * ラップトップ: 約0.56〜0.67 (16:9〜3:2相当)
 */
function calculateAspectRatioScore(bounds: { width: number; height: number }): number {
  // 縦横どちらが長いかに応じてアスペクト比を計算
  const aspectRatio = Math.max(bounds.width, bounds.height) / Math.min(bounds.width, bounds.height);

  // スマートフォン画面のアスペクト比: 約1.8〜2.2
  const smartphoneScore = 1 - Math.min(1, Math.abs(aspectRatio - 2.0) / 0.5);

  // タブレット: 約1.3〜1.5
  const tabletScore = 1 - Math.min(1, Math.abs(aspectRatio - 1.4) / 0.3);

  // ラップトップ: 約1.5〜1.8 (16:9〜16:10相当)
  const laptopScore = 1 - Math.min(1, Math.abs(aspectRatio - 1.65) / 0.3);

  // 正方形に近い場合（1:1）も許容
  const squareScore = 1 - Math.min(1, Math.abs(aspectRatio - 1.0) / 0.2);

  // 最も高いスコアを採用（いずれかのデバイスタイプに近ければOK）
  return Math.max(smartphoneScore, tabletScore, laptopScore, squareScore);
}

/**
 * ベゼルの連続性をチェック
 * 各辺を複数セグメントに分割し、連続して暗いピクセルが存在するかを評価
 */
function checkBezelContinuity(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number },
  bezelWidth: number,
  darkThreshold: number
): number {
  const { width: imgW, height: imgH, data } = imageData;
  const segments = 5; // 各辺を5分割

  const checkEdgeSegments = (
    isHorizontal: boolean,
    start: number,
    end: number,
    fixedCoord: number,
    direction: 'before' | 'after'
  ): number => {
    const length = end - start;
    if (length <= 0) return 0;

    const segmentSize = Math.floor(length / segments);
    if (segmentSize <= 0) return 0;

    let continuousCount = 0;

    for (let i = 0; i < segments; i++) {
      const segStart = start + i * segmentSize;
      const segEnd = Math.min(segStart + segmentSize, end);

      let darkCount = 0;
      let totalCount = 0;

      for (let pos = segStart; pos < segEnd; pos++) {
        for (let offset = 1; offset <= bezelWidth; offset++) {
          const x = isHorizontal ? pos : (direction === 'before' ? fixedCoord - offset : fixedCoord + offset);
          const y = isHorizontal ? (direction === 'before' ? fixedCoord - offset : fixedCoord + offset) : pos;

          if (x >= 0 && x < imgW && y >= 0 && y < imgH) {
            const idx = (y * imgW + x) * 4;
            const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
            if (lum < darkThreshold) darkCount++;
            totalCount++;
          }
        }
      }

      if (totalCount > 0 && darkCount / totalCount > 0.3) {
        continuousCount++;
      }
    }

    return continuousCount / segments;
  };

  const { x, y, width: w, height: h } = bounds;

  const topContinuity = checkEdgeSegments(true, x, x + w, y, 'before');
  const bottomContinuity = checkEdgeSegments(true, x, x + w, y + h, 'after');
  const leftContinuity = checkEdgeSegments(false, y, y + h, x, 'before');
  const rightContinuity = checkEdgeSegments(false, y, y + h, x + w, 'after');

  // 連続性スコア（全辺の平均）
  return (topContinuity + bottomContinuity + leftContinuity + rightContinuity) / 4;
}

/**
 * RGBから輝度を計算（ITU-R BT.601標準）
 * @param r Red値（0〜255）
 * @param g Green値（0〜255）
 * @param b Blue値（0〜255）
 * @returns 輝度（0.0〜1.0）
 */
function getLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * 全ピクセルの白判定マスクを作成
 */
function createWhitePixelMask(
  imageData: ImageData,
  threshold: number
): Uint8Array {
  const { width, height, data } = imageData;
  const totalPixels = width * height;
  const mask = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    // 透明ピクセルは除外
    if (a < 200) {
      mask[i] = 0;
      continue;
    }

    const luminance = getLuminance(r, g, b);
    mask[i] = luminance >= threshold ? 1 : 0;
  }

  return mask;
}

/**
 * BFSで連結成分を抽出
 */
function extractConnectedRegions(
  mask: Uint8Array,
  width: number,
  height: number
): { pixels: number[]; bounds: { minX: number; minY: number; maxX: number; maxY: number } }[] {
  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const regions: { pixels: number[]; bounds: { minX: number; minY: number; maxX: number; maxY: number } }[] = [];

  // 4方向の移動
  const directions = [
    [-1, 0],  // 左
    [1, 0],   // 右
    [0, -1],  // 上
    [0, 1],   // 下
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      if (mask[idx] === 1 && visited[idx] === 0) {
        const pixels: number[] = [];
        const bounds = {
          minX: x,
          minY: y,
          maxX: x,
          maxY: y,
        };

        const queue: [number, number][] = [[x, y]];
        visited[idx] = 1;

        while (queue.length > 0) {
          const [cx, cy] = queue.shift()!;
          const cIdx = cy * width + cx;

          pixels.push(cIdx);

          bounds.minX = Math.min(bounds.minX, cx);
          bounds.minY = Math.min(bounds.minY, cy);
          bounds.maxX = Math.max(bounds.maxX, cx);
          bounds.maxY = Math.max(bounds.maxY, cy);

          for (const [dx, dy] of directions) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;

              if (mask[nIdx] === 1 && visited[nIdx] === 0) {
                visited[nIdx] = 1;
                queue.push([nx, ny]);
              }
            }
          }
        }

        regions.push({ pixels, bounds });
      }
    }
  }

  return regions;
}

/**
 * 近接した領域をマージする
 * ノッチやカメラなどで分断された画面領域を1つに統合する
 *
 * マージ条件（すべて満たす必要がある）：
 * 1. 2つの領域が近接している（バウンディングボックス間のギャップが小さい）
 * 2. 2つの領域のサイズが類似している（面積比が0.2〜5.0倍）
 * 3. 2つの領域のY座標が大きく重なっている（ノッチ分断の場合）
 * 4. マージ後のアスペクト比がデバイス画面として妥当（0.4〜2.5）
 *
 * @param regions 連結成分抽出で得られた領域のリスト
 * @param imageWidth 画像の幅
 * @param imageHeight 画像の高さ
 * @param maxGapRatio マージする最大ギャップ比率（領域サイズに対する割合）
 */
function mergeNearbyRegions(
  regions: { pixels: number[]; bounds: { minX: number; minY: number; maxX: number; maxY: number } }[],
  imageWidth: number,
  imageHeight: number,
  maxGapRatio: number = 0.05 // 領域の高さ/幅の5%以内のギャップはマージ（厳格化: 10%→5%）
): { pixels: number[]; bounds: { minX: number; minY: number; maxX: number; maxY: number } }[] {
  if (regions.length <= 1) return regions;

  // 領域を面積の大きい順にソート
  const sortedRegions = [...regions].sort((a, b) => b.pixels.length - a.pixels.length);
  const merged: boolean[] = new Array(sortedRegions.length).fill(false);
  const result: { pixels: number[]; bounds: { minX: number; minY: number; maxX: number; maxY: number } }[] = [];

  for (let i = 0; i < sortedRegions.length; i++) {
    if (merged[i]) continue;

    let currentRegion = sortedRegions[i];
    let currentBounds = { ...currentRegion.bounds };
    let currentPixels = [...currentRegion.pixels];
    merged[i] = true;

    // 他の領域とマージできるかチェック
    let foundMerge = true;
    while (foundMerge) {
      foundMerge = false;

      for (let j = 0; j < sortedRegions.length; j++) {
        if (merged[j]) continue;

        const otherRegion = sortedRegions[j];
        const otherBounds = otherRegion.bounds;

        // 2つの領域のバウンディングボックス間の距離を計算
        const currentWidth = currentBounds.maxX - currentBounds.minX;
        const currentHeight = currentBounds.maxY - currentBounds.minY;
        const otherWidth = otherBounds.maxX - otherBounds.minX;
        const otherHeight = otherBounds.maxY - otherBounds.minY;

        // ========== マージ条件1: サイズ類似性（厳格化） ==========
        // 面積比が2.0倍以内のみマージ（別デバイスは通常2倍以上のサイズ差がある）
        // 5.0→2.0に厳格化: タブレットとスマートフォンの誤マージを防止
        const currentArea = currentPixels.length;
        const otherArea = otherRegion.pixels.length;
        const areaRatio = currentArea > otherArea ? currentArea / otherArea : otherArea / currentArea;
        if (areaRatio > 2.0) continue;

        // ========== マージ条件2: Y座標の重なり（厳格化） ==========
        // ノッチで分断された領域は非常に高いY座標重なり率を持つはず
        // Y座標の重なり率を計算（重なり部分 / 小さい方の高さ）
        const yOverlapStart = Math.max(currentBounds.minY, otherBounds.minY);
        const yOverlapEnd = Math.min(currentBounds.maxY, otherBounds.maxY);
        const yOverlap = Math.max(0, yOverlapEnd - yOverlapStart);
        const minHeight = Math.min(currentHeight, otherHeight);
        const yOverlapRatio = minHeight > 0 ? yOverlap / minHeight : 0;

        // Y座標の重なりが80%未満の場合はマージしない（50%→80%に厳格化）
        // ノッチ分断は通常90%以上の重なりがある
        if (yOverlapRatio < 0.8) continue;

        // ========== マージ条件2.5: X座標の重なり（新規追加） ==========
        // 横に並んだ別デバイス（タブレット+スマートフォン）をマージしないために
        // X座標の重なりも高い必要がある（ノッチ分断は垂直分断なのでX重なりが高い）
        const xOverlapStart = Math.max(currentBounds.minX, otherBounds.minX);
        const xOverlapEnd = Math.min(currentBounds.maxX, otherBounds.maxX);
        const xOverlap = Math.max(0, xOverlapEnd - xOverlapStart);
        const minWidth = Math.min(currentWidth, otherWidth);
        const xOverlapRatio = minWidth > 0 ? xOverlap / minWidth : 0;

        // X座標の重なりが50%未満の場合はマージしない
        // ノッチ分断は垂直分断なので、X座標は高い重なりを持つはず
        if (xOverlapRatio < 0.5) continue;

        // ========== マージ条件3: 近接性 ==========
        const avgWidth = (currentWidth + otherWidth) / 2;
        const avgHeight = (currentHeight + otherHeight) / 2;
        const maxHorizontalGap = avgWidth * maxGapRatio;
        const maxVerticalGap = avgHeight * maxGapRatio;

        // 水平方向の重なりまたは近接チェック
        const horizontalOverlap =
          currentBounds.maxX >= otherBounds.minX - maxHorizontalGap &&
          currentBounds.minX <= otherBounds.maxX + maxHorizontalGap;

        // 垂直方向の重なりまたは近接チェック
        const verticalOverlap =
          currentBounds.maxY >= otherBounds.minY - maxVerticalGap &&
          currentBounds.minY <= otherBounds.maxY + maxVerticalGap;

        if (!horizontalOverlap || !verticalOverlap) continue;

        // ========== マージ条件4: マージ後のアスペクト比 ==========
        // マージ後のバウンディングボックスを計算
        const mergedMinX = Math.min(currentBounds.minX, otherBounds.minX);
        const mergedMinY = Math.min(currentBounds.minY, otherBounds.minY);
        const mergedMaxX = Math.max(currentBounds.maxX, otherBounds.maxX);
        const mergedMaxY = Math.max(currentBounds.maxY, otherBounds.maxY);
        const mergedWidth = mergedMaxX - mergedMinX;
        const mergedHeight = mergedMaxY - mergedMinY;
        const mergedAspectRatio = Math.max(mergedWidth, mergedHeight) / Math.min(mergedWidth, mergedHeight);

        // アスペクト比が0.4〜2.5の範囲外ならマージしない（デバイス画面として不自然）
        if (mergedAspectRatio > 2.5) continue;

        // すべての条件を満たした場合のみマージ
        currentBounds = {
          minX: mergedMinX,
          minY: mergedMinY,
          maxX: mergedMaxX,
          maxY: mergedMaxY,
        };
        currentPixels = [...currentPixels, ...otherRegion.pixels];
        merged[j] = true;
        foundMerge = true;
      }
    }

    result.push({
      pixels: currentPixels,
      bounds: currentBounds,
    });
  }

  return result;
}

/**
 * 4辺それぞれのベゼル存在をチェック
 */
function checkBezelEdges(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number },
  bezelWidth: number,
  darkThreshold: number
): { top: number; bottom: number; left: number; right: number } {
  const { width: imgW, height: imgH, data } = imageData;
  const { x, y, width: w, height: h } = bounds;

  const checkEdge = (
    startX: number,
    endX: number,
    startY: number,
    endY: number
  ): number => {
    let darkCount = 0;
    let totalCount = 0;

    for (let py = Math.max(0, startY); py < Math.min(imgH, endY); py++) {
      for (let px = Math.max(0, startX); px < Math.min(imgW, endX); px++) {
        const idx = (py * imgW + px) * 4;
        const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);

        if (lum < darkThreshold) darkCount++;
        totalCount++;
      }
    }

    return totalCount > 0 ? darkCount / totalCount : 0;
  };

  return {
    top: checkEdge(x, x + w, y - bezelWidth, y),
    bottom: checkEdge(x, x + w, y + h, y + h + bezelWidth),
    left: checkEdge(x - bezelWidth, x, y, y + h),
    right: checkEdge(x + w, x + w + bezelWidth, y, y + h),
  };
}

/**
 * 総合ベゼルスコアを計算
 */
function calculateBezelScore(edges: { top: number; bottom: number; left: number; right: number }): number {
  const total = edges.top + edges.bottom + edges.left + edges.right;
  return total / 4;
}

/**
 * 矩形度を計算
 */
function calculateRectangularity(
  pixelCount: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): number {
  const boundWidth = bounds.maxX - bounds.minX + 1;
  const boundHeight = bounds.maxY - bounds.minY + 1;
  const boundArea = boundWidth * boundHeight;
  return pixelCount / boundArea;
}

/**
 * 領域用のマスクを作成
 */
function createRegionMask(
  pixels: number[],
  bounds: { x: number; y: number; width: number; height: number },
  imageWidth: number
): Uint8Array {
  const { x, y, width, height } = bounds;
  const mask = new Uint8Array(width * height);
  
  for (const pixelIdx of pixels) {
    const py = Math.floor(pixelIdx / imageWidth);
    const px = pixelIdx % imageWidth;
    const localX = px - x;
    const localY = py - y;
    
    if (localX >= 0 && localX < width && localY >= 0 && localY < height) {
      mask[localY * width + localX] = 1;
    }
  }
  
  return mask;
}

/**
 * 内部検出処理（指定された輝度閾値で検出を実行）
 * @param isPureWhiteMode trueの場合、純白（#FFF）のみを検出するモードで、
 *                        デバイスらしいアスペクト比の領域はベゼル要件を緩和する
 */
function detectDeviceScreensInternal(
  imageData: ImageData,
  opts: Required<DetectionOptions>,
  isPureWhiteMode: boolean = false
): DetectedRegion[] {
  const { width, height } = imageData;
  const totalPixels = width * height;

  // ステップ1: 白ピクセルマスクを作成
  const mask = createWhitePixelMask(imageData, opts.luminanceThreshold);

  // ステップ2: BFS連結成分抽出
  const rawRegions = extractConnectedRegions(mask, width, height);

  // ステップ2.5: 近接領域のマージ
  // ノッチやカメラで分断された画面領域を1つに統合する
  // maxGapRatioを0.15に設定（領域サイズの15%以内のギャップをマージ）
  const mergedRegions = mergeNearbyRegions(rawRegions, width, height, 0.05);

  // ステップ3: フィルタリングとスコアリング
  const screenRegions: DetectedRegion[] = [];

  for (const region of mergedRegions) {
    const { bounds, pixels } = region;
    const { minX, minY, maxX, maxY } = bounds;

    // 面積フィルタ
    const areaRatio = pixels.length / totalPixels;
    if (areaRatio < opts.minAreaRatio) continue;

    // 矩形度フィルタ
    const boundWidth = maxX - minX + 1;
    const boundHeight = maxY - minY + 1;
    const rectangularity = calculateRectangularity(pixels.length, bounds);

    if (rectangularity < opts.minRectangularity) continue;

    // ベゼルスコア計算
    const regionBounds = {
      x: minX,
      y: minY,
      width: boundWidth,
      height: boundHeight,
    };

    const bezelEdges = checkBezelEdges(imageData, regionBounds, opts.bezelWidth, opts.darkThreshold);
    const bezelScore = calculateBezelScore(bezelEdges);

    // Phase 1改良: アスペクト比スコアを先に計算
    const aspectScore = calculateAspectRatioScore(regionBounds);

    // 純白モードかつデバイスらしいアスペクト比の場合、ベゼル要件を大幅に緩和
    // 理由: 画面の白が#FFFのみで、アスペクト比がデバイスらしい場合、
    //       ベゼルが薄い/見えにくいデバイスでも検出可能にする
    const relaxedBezelThreshold = isPureWhiteMode && aspectScore > 0.5
      ? opts.minBezelScore * 0.5  // 閾値を半分に（0.10 → 0.05）
      : opts.minBezelScore;

    if (bezelScore < relaxedBezelThreshold) continue;

    // 4辺のうちベゼルを持つ辺の数をカウント（閾値0.10、純白モードでは0.05）
    const edgeThreshold = isPureWhiteMode && aspectScore > 0.5 ? 0.05 : 0.10;
    const edgesWithBezel = [bezelEdges.top, bezelEdges.bottom, bezelEdges.left, bezelEdges.right]
      .filter(score => score > edgeThreshold).length;

    if (edgesWithBezel < opts.minBezelEdges) continue;

    // Phase 1: ベゼル連続性スコアを計算
    const continuityScore = checkBezelContinuity(imageData, regionBounds, opts.bezelWidth, opts.darkThreshold);

    // マスク作成
    const regionMask = createRegionMask(pixels, regionBounds, width);

    // Phase 1改良: ベゼル辺数ボーナス
    // 4辺すべてにベゼルがある領域を強く優先（白デスク/白背景との区別）
    // edgesWithBezel: 1=1.0, 2=1.5, 3=2.0, 4=3.0
    const bezelEdgeBonus = edgesWithBezel === 4 ? 3.0 :
                           edgesWithBezel === 3 ? 2.0 :
                           edgesWithBezel === 2 ? 1.5 : 1.0;

    // 総合スコア計算（Phase 1改良: ベゼル辺数ボーナスを追加）
    // - bezelScore: ベゼルの暗さ（0〜1）
    // - areaRatio: 面積比（小さい値）
    // - rectangularity: 矩形度（0〜1）
    // - aspectScore: デバイスらしいアスペクト比（0〜1）
    // - continuityScore: ベゼルの連続性（0〜1）
    // - bezelEdgeBonus: ベゼル辺数ボーナス（1.0〜3.0）
    const overallScore = bezelScore * areaRatio * rectangularity * (0.5 + aspectScore * 0.5) * (0.7 + continuityScore * 0.3) * bezelEdgeBonus * 1000;

    screenRegions.push({
      bounds: regionBounds,
      pixels,
      mask: regionMask,
      area: pixels.length,
      rectangularity,
      bezelScore,
      overallScore,
      bezelEdges,
    });
  }

  return screenRegions;
}

/**
 * デバイス画面領域を検出（メイン関数）
 * Phase 1: 輝度閾値の段階的適用を実装
 */
export function detectDeviceScreens(
  imageData: ImageData,
  options: DetectionOptions = {}
): ScreenRegion[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width } = imageData;

  // Phase 1 Step 1.2: 輝度閾値の段階的適用（改良版）
  // 画面の白は必ず#FFF（純粋な白）なので、高い閾値から検出を試みる
  // 0.99: 純粋な白(#FFF)のみ → 白デスク/白背景との分離に最適
  // 0.97: ほぼ純粋な白
  // 0.95: 少しグレーがかった白も含む
  // 0.90: 従来の閾値（フォールバック）
  const thresholds = [0.99, 0.97, 0.95, 0.90];
  let screenRegions: DetectedRegion[] = [];
  let bestRegions: DetectedRegion[] = [];
  let bestScore = 0;

  for (const threshold of thresholds) {
    const currentOpts = { ...opts, luminanceThreshold: threshold };
    // 純白モード: 閾値0.97以上は純白検出モード（ベゼル要件を緩和）
    const isPureWhiteMode = threshold >= 0.97;
    const regions = detectDeviceScreensInternal(imageData, currentOpts, isPureWhiteMode);

    if (regions.length > 0) {
      // 最も高いoverallScoreを持つ結果を採用
      const maxScore = Math.max(...regions.map(r => r.overallScore));

      // 最初に見つかった結果、または明らかに良いスコアの場合は更新
      if (bestRegions.length === 0 || maxScore > bestScore * 1.2) {
        bestRegions = regions;
        bestScore = maxScore;
      }

      // 高い閾値（0.97以上）で良い結果が見つかった場合は早期終了
      // これにより白デスク/白背景との融合を防ぐ
      if (threshold >= 0.97 && regions.length > 0) {
        break;
      }
    }
  }

  screenRegions = bestRegions;

  // スコア順にソートして上位3つを選択
  const sorted = [...screenRegions].sort((a, b) => b.overallScore - a.overallScore);
  const top3 = sorted.slice(0, 3);

  // デバイス番号と色を割り当て
  return top3.map((region, index): ScreenRegion => {
    const { bounds } = region;
    const { x, y, width: w, height: h } = bounds;

    // 4隅の座標（時計回り: 左上、右上、右下、左下）
    const corners: [Point, Point, Point, Point] = [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];

    // 重心計算
    const centroid: Point = {
      x: x + w / 2,
      y: y + h / 2,
    };

    return {
      ...region,
      corners,
      centroid,
      deviceIndex: index as DeviceIndex,
      fillColor: DEVICE_COLOR_ORDER[index],
    };
  });
}

/**
 * 検出された白エリアを指定色で塗りつぶしたキャンバスを生成
 */
export function fillWhiteAreasWithColors(
  originalImageData: ImageData,
  regions: ScreenRegion[]
): ImageData {
  const { width, height, data } = originalImageData;
  
  // 元のイメージデータをコピー
  const resultData = new Uint8ClampedArray(data);

  for (const region of regions) {
    const { bounds, mask, fillColor } = region;
    
    // 色をRGBに変換
    const rgb = hexToRgb(fillColor);
    if (!rgb) continue;

    // マスク領域を塗りつぶし
    for (let j = 0; j < bounds.height; j++) {
      for (let i = 0; i < bounds.width; i++) {
        if (mask[j * bounds.width + i] === 1) {
          const px = bounds.x + i;
          const py = bounds.y + j;
          
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = (py * width + px) * 4;
            resultData[idx] = rgb.r;
            resultData[idx + 1] = rgb.g;
            resultData[idx + 2] = rgb.b;
            resultData[idx + 3] = 255;
          }
        }
      }
    }
  }

  return new ImageData(resultData, width, height);
}

/**
 * HEXカラーをRGBに変換
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * 画像から白エリアを検出し、色付きで塗りつぶした結果をCanvasに描画
 */
export function processImageWithColorFill(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  options?: DetectionOptions
): ScreenRegion[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2Dコンテキストの取得に失敗しました');
  }

  // キャンバスサイズを画像に合わせる
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  // 画像を描画
  ctx.drawImage(image, 0, 0);

  // ImageDataを取得
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // 白エリアを検出
  const regions = detectDeviceScreens(imageData, options);

  // 色で塗りつぶし
  const filledData = fillWhiteAreasWithColors(imageData, regions);

  // 結果をキャンバスに描画
  ctx.putImageData(filledData, 0, 0);

  return regions;
}

/**
 * デバッグ用: 中間結果を可視化
 */
export function visualizeDetection(
  imageData: ImageData,
  options?: DetectionOptions
): {
  whiteMask: Uint8Array;
  regions: ScreenRegion[];
  filledImageData: ImageData;
} {
  const { width, height } = imageData;
  
  // 白マスクを作成
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const whiteMask = createWhitePixelMask(imageData, opts.luminanceThreshold);

  // 領域を検出
  const regions = detectDeviceScreens(imageData, options);

  // 色で塗りつぶし
  const filledImageData = fillWhiteAreasWithColors(imageData, regions);

  return {
    whiteMask,
    regions,
    filledImageData,
  };
}

// Re-export colors for convenience
export { DEVICE_FILL_COLORS, DEVICE_COLOR_ORDER };

// ============================================
// 検出ログ機能
// ============================================

/**
 * 検出ログのインターフェース
 */
export interface DetectionLog {
  timestamp: string;
  imageDimensions: { width: number; height: number };
  options: Required<DetectionOptions>;
  stages: {
    whitePixelCount: number;
    whitePixelRatio: number;
    rawRegionsCount: number;
    rawRegions: {
      index: number;
      bounds: { x: number; y: number; width: number; height: number };
      pixelCount: number;
      areaRatio: number;
    }[];
    afterAreaFilter: number;
    afterRectangularityFilter: number;
    afterBezelScoreFilter: number;
    afterBezelEdgesFilter: number;
  };
  filteredOutReasons: {
    regionIndex: number;
    bounds: { x: number; y: number; width: number; height: number };
    reason: string;
    details: {
      areaRatio?: number;
      rectangularity?: number;
      bezelScore?: number;
      bezelEdges?: { top: number; bottom: number; left: number; right: number };
      edgesWithBezel?: number;
    };
  }[];
  finalRegions: {
    deviceIndex: number;
    bounds: { x: number; y: number; width: number; height: number };
    area: number;
    rectangularity: number;
    bezelScore: number;
    overallScore: number;
    bezelEdges: { top: number; bottom: number; left: number; right: number };
    fillColor: string;
  }[];
  summary: {
    success: boolean;
    detectedCount: number;
    message: string;
  };
}

/**
 * 詳細な検出ログを生成しながらデバイス画面領域を検出
 * detectDeviceScreensと同じ段階的輝度閾値ロジックを使用
 */
export function detectDeviceScreensWithLog(
  imageData: ImageData,
  options: DetectionOptions = {}
): { regions: ScreenRegion[]; log: DetectionLog } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height } = imageData;

  // ログ初期化
  const log: DetectionLog = {
    timestamp: new Date().toISOString(),
    imageDimensions: { width, height },
    options: opts,
    stages: {
      whitePixelCount: 0,
      whitePixelRatio: 0,
      rawRegionsCount: 0,
      rawRegions: [],
      afterAreaFilter: 0,
      afterRectangularityFilter: 0,
      afterBezelScoreFilter: 0,
      afterBezelEdgesFilter: 0,
    },
    filteredOutReasons: [],
    finalRegions: [],
    summary: {
      success: false,
      detectedCount: 0,
      message: '',
    },
  };

  // Phase 1: 段階的輝度閾値（detectDeviceScreensと同一ロジック）
  // 画面の白は必ず#FFF（純粋な白）なので、高い閾値から検出を試みる
  const thresholds = [0.99, 0.97, 0.95, 0.90];
  let bestRegions: DetectedRegion[] = [];
  let bestScore = 0;
  let bestThreshold = 0.99;

  for (const threshold of thresholds) {
    const currentOpts = { ...opts, luminanceThreshold: threshold };
    const isPureWhiteMode = threshold >= 0.97;
    const regions = detectDeviceScreensInternalWithLog(imageData, currentOpts, isPureWhiteMode, log, threshold === thresholds[0]);

    if (regions.length > 0) {
      const maxScore = Math.max(...regions.map(r => r.overallScore));

      if (bestRegions.length === 0 || maxScore > bestScore * 1.2) {
        bestRegions = regions;
        bestScore = maxScore;
        bestThreshold = threshold;
      }

      // 高い閾値（0.97以上）で良い結果が見つかった場合は早期終了
      if (threshold >= 0.97 && regions.length > 0) {
        break;
      }
    }
  }

  // ログに使用した閾値を記録
  log.options.luminanceThreshold = bestThreshold;

  // 0.99での白ピクセル数を記録（初回の記録を使用）
  // 既にlog.stagesに記録済み

  // スコア順にソートして上位3つを選択
  const sorted = [...bestRegions].sort((a, b) => b.overallScore - a.overallScore);
  const top3 = sorted.slice(0, 3);

  // デバイス番号と色を割り当て
  const finalRegions = top3.map((region, index): ScreenRegion => {
    const { bounds } = region;
    const { x, y, width: w, height: h } = bounds;

    const corners: [Point, Point, Point, Point] = [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];

    const centroid: Point = {
      x: x + w / 2,
      y: y + h / 2,
    };

    // ログに最終領域情報を追加
    log.finalRegions.push({
      deviceIndex: index,
      bounds,
      area: region.area,
      rectangularity: region.rectangularity,
      bezelScore: region.bezelScore,
      overallScore: region.overallScore,
      bezelEdges: region.bezelEdges,
      fillColor: DEVICE_COLOR_ORDER[index],
    });

    return {
      ...region,
      corners,
      centroid,
      deviceIndex: index as DeviceIndex,
      fillColor: DEVICE_COLOR_ORDER[index],
    };
  });

  // サマリー作成
  log.summary = {
    success: finalRegions.length > 0,
    detectedCount: finalRegions.length,
    message: finalRegions.length === 0
      ? `白エリアが検出されませんでした。白ピクセル比率: ${(log.stages.whitePixelRatio * 100).toFixed(2)}%, 候補領域数: ${log.stages.rawRegionsCount}, フィルタ後: 0`
      : `${finalRegions.length}個のデバイス画面を検出しました（閾値: ${bestThreshold}）`,
  };

  return { regions: finalRegions, log };
}

/**
 * ログ付き内部検出処理（段階的閾値で呼び出される）
 */
function detectDeviceScreensInternalWithLog(
  imageData: ImageData,
  opts: Required<DetectionOptions>,
  isPureWhiteMode: boolean,
  log: DetectionLog,
  isFirstThreshold: boolean
): DetectedRegion[] {
  const { width, height } = imageData;
  const totalPixels = width * height;

  // ステップ1: 白ピクセルマスクを作成
  const mask = createWhitePixelMask(imageData, opts.luminanceThreshold);

  // 最初の閾値でのみログに白ピクセル情報を記録
  if (isFirstThreshold) {
    let whitePixelCount = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) whitePixelCount++;
    }
    log.stages.whitePixelCount = whitePixelCount;
    log.stages.whitePixelRatio = whitePixelCount / totalPixels;
  }

  // ステップ2: BFS連結成分抽出
  const rawRegions = extractConnectedRegions(mask, width, height);

  // ステップ2.5: 近接領域のマージ
  // ノッチやカメラで分断された画面領域を1つに統合する
  const mergedRegions = mergeNearbyRegions(rawRegions, width, height, 0.05);

  // 最初の閾値でのみログに領域情報を記録（マージ後の領域を記録）
  if (isFirstThreshold) {
    log.stages.rawRegionsCount = mergedRegions.length;
    mergedRegions.forEach((region, index) => {
      const { bounds, pixels } = region;
      log.stages.rawRegions.push({
        index,
        bounds: {
          x: bounds.minX,
          y: bounds.minY,
          width: bounds.maxX - bounds.minX + 1,
          height: bounds.maxY - bounds.minY + 1,
        },
        pixelCount: pixels.length,
        areaRatio: pixels.length / totalPixels,
      });
    });
  }

  // ステップ3: フィルタリングとスコアリング
  const screenRegions: DetectedRegion[] = [];
  let afterAreaFilter = 0;
  let afterRectangularityFilter = 0;
  let afterBezelScoreFilter = 0;
  let afterBezelEdgesFilter = 0;

  for (let regionIdx = 0; regionIdx < mergedRegions.length; regionIdx++) {
    const region = mergedRegions[regionIdx];
    const { bounds, pixels } = region;
    const { minX, minY, maxX, maxY } = bounds;

    const boundWidth = maxX - minX + 1;
    const boundHeight = maxY - minY + 1;
    const regionBounds = { x: minX, y: minY, width: boundWidth, height: boundHeight };

    // 面積フィルタ
    const areaRatio = pixels.length / totalPixels;
    if (areaRatio < opts.minAreaRatio) {
      if (isFirstThreshold) {
        log.filteredOutReasons.push({
          regionIndex: regionIdx,
          bounds: regionBounds,
          reason: 'AREA_TOO_SMALL',
          details: { areaRatio },
        });
      }
      continue;
    }
    afterAreaFilter++;

    // 矩形度フィルタ
    const rectangularity = calculateRectangularity(pixels.length, bounds);
    if (rectangularity < opts.minRectangularity) {
      if (isFirstThreshold) {
        log.filteredOutReasons.push({
          regionIndex: regionIdx,
          bounds: regionBounds,
          reason: 'LOW_RECTANGULARITY',
          details: { areaRatio, rectangularity },
        });
      }
      continue;
    }
    afterRectangularityFilter++;

    // ベゼルスコア計算
    const bezelEdges = checkBezelEdges(imageData, regionBounds, opts.bezelWidth, opts.darkThreshold);
    const bezelScore = calculateBezelScore(bezelEdges);

    // Phase 1改良: アスペクト比スコアを先に計算
    const aspectScore = calculateAspectRatioScore(regionBounds);

    // 純白モードかつデバイスらしいアスペクト比の場合、ベゼル要件を緩和
    const relaxedBezelThreshold = isPureWhiteMode && aspectScore > 0.5
      ? opts.minBezelScore * 0.5
      : opts.minBezelScore;

    if (bezelScore < relaxedBezelThreshold) {
      if (isFirstThreshold) {
        log.filteredOutReasons.push({
          regionIndex: regionIdx,
          bounds: regionBounds,
          reason: 'LOW_BEZEL_SCORE',
          details: { areaRatio, rectangularity, bezelScore, bezelEdges },
        });
      }
      continue;
    }
    afterBezelScoreFilter++;

    // 4辺のうちベゼルを持つ辺の数をカウント（純白モードでは閾値を緩和）
    const edgeThreshold = isPureWhiteMode && aspectScore > 0.5 ? 0.05 : 0.10;
    const edgesWithBezel = [bezelEdges.top, bezelEdges.bottom, bezelEdges.left, bezelEdges.right]
      .filter(score => score > edgeThreshold).length;

    if (edgesWithBezel < opts.minBezelEdges) {
      if (isFirstThreshold) {
        log.filteredOutReasons.push({
          regionIndex: regionIdx,
          bounds: regionBounds,
          reason: 'INSUFFICIENT_BEZEL_EDGES',
          details: { areaRatio, rectangularity, bezelScore, bezelEdges, edgesWithBezel },
        });
      }
      continue;
    }
    afterBezelEdgesFilter++;

    // Phase 1: ベゼル連続性スコアを計算
    const continuityScore = checkBezelContinuity(imageData, regionBounds, opts.bezelWidth, opts.darkThreshold);

    // マスク作成
    const regionMask = createRegionMask(pixels, regionBounds, width);

    // Phase 1改良: ベゼル辺数ボーナス
    const bezelEdgeBonus = edgesWithBezel === 4 ? 3.0 :
                           edgesWithBezel === 3 ? 2.0 :
                           edgesWithBezel === 2 ? 1.5 : 1.0;

    // 総合スコア計算
    const overallScore = bezelScore * areaRatio * rectangularity * (0.5 + aspectScore * 0.5) * (0.7 + continuityScore * 0.3) * bezelEdgeBonus * 1000;

    screenRegions.push({
      bounds: regionBounds,
      pixels,
      mask: regionMask,
      area: pixels.length,
      rectangularity,
      bezelScore,
      overallScore,
      bezelEdges,
    });
  }

  // 最初の閾値でのみフィルタ後の数を記録
  if (isFirstThreshold) {
    log.stages.afterAreaFilter = afterAreaFilter;
    log.stages.afterRectangularityFilter = afterRectangularityFilter;
    log.stages.afterBezelScoreFilter = afterBezelScoreFilter;
    log.stages.afterBezelEdgesFilter = afterBezelEdgesFilter;
  }

  return screenRegions;
}

/**
 * 検出ログをコピー可能なテキストに変換
 */
export function formatDetectionLogForCopy(log: DetectionLog): string {
  const lines: string[] = [];
  
  lines.push('=== 白エリア検出ログ ===');
  lines.push(`タイムスタンプ: ${log.timestamp}`);
  lines.push(`画像サイズ: ${log.imageDimensions.width}x${log.imageDimensions.height}`);
  lines.push('');
  
  lines.push('--- 検出パラメータ ---');
  lines.push(`輝度閾値: ${log.options.luminanceThreshold}`);
  lines.push(`最小面積比: ${log.options.minAreaRatio}`);
  lines.push(`最小矩形度: ${log.options.minRectangularity}`);
  lines.push(`最小ベゼルスコア: ${log.options.minBezelScore}`);
  lines.push(`ベゼル幅: ${log.options.bezelWidth}px`);
  lines.push(`暗い閾値: ${log.options.darkThreshold}`);
  lines.push(`最小ベゼル辺数: ${log.options.minBezelEdges}`);
  lines.push('');
  
  lines.push('--- 検出ステージ ---');
  lines.push(`白ピクセル数: ${log.stages.whitePixelCount} (${(log.stages.whitePixelRatio * 100).toFixed(2)}%)`);
  lines.push(`候補領域数: ${log.stages.rawRegionsCount}`);
  lines.push(`面積フィルタ後: ${log.stages.afterAreaFilter}`);
  lines.push(`矩形度フィルタ後: ${log.stages.afterRectangularityFilter}`);
  lines.push(`ベゼルスコアフィルタ後: ${log.stages.afterBezelScoreFilter}`);
  lines.push(`ベゼル辺数フィルタ後: ${log.stages.afterBezelEdgesFilter}`);
  lines.push('');
  
  if (log.stages.rawRegions.length > 0) {
    lines.push('--- 候補領域一覧 ---');
    log.stages.rawRegions.slice(0, 10).forEach(r => {
      lines.push(`  [${r.index}] ${r.bounds.width}x${r.bounds.height} at (${r.bounds.x},${r.bounds.y}) - ${r.pixelCount}px (${(r.areaRatio * 100).toFixed(3)}%)`);
    });
    if (log.stages.rawRegions.length > 10) {
      lines.push(`  ... 他 ${log.stages.rawRegions.length - 10} 件`);
    }
    lines.push('');
  }
  
  if (log.filteredOutReasons.length > 0) {
    lines.push('--- フィルタ除外理由 ---');
    log.filteredOutReasons.slice(0, 10).forEach(r => {
      let detailStr = '';
      if (r.details.areaRatio !== undefined) detailStr += `面積比:${(r.details.areaRatio * 100).toFixed(3)}% `;
      if (r.details.rectangularity !== undefined) detailStr += `矩形度:${r.details.rectangularity.toFixed(3)} `;
      if (r.details.bezelScore !== undefined) detailStr += `ベゼル:${r.details.bezelScore.toFixed(3)} `;
      if (r.details.edgesWithBezel !== undefined) detailStr += `辺数:${r.details.edgesWithBezel} `;
      lines.push(`  [${r.regionIndex}] ${r.reason} - ${detailStr}`);
    });
    if (log.filteredOutReasons.length > 10) {
      lines.push(`  ... 他 ${log.filteredOutReasons.length - 10} 件`);
    }
    lines.push('');
  }
  
  lines.push('--- 検出結果 ---');
  if (log.finalRegions.length === 0) {
    lines.push('検出された領域はありません');
  } else {
    log.finalRegions.forEach(r => {
      lines.push(`  デバイス${r.deviceIndex + 1}: ${r.bounds.width}x${r.bounds.height} at (${r.bounds.x},${r.bounds.y})`);
      lines.push(`    面積: ${r.area}px, 矩形度: ${r.rectangularity.toFixed(3)}`);
      lines.push(`    ベゼルスコア: ${r.bezelScore.toFixed(3)} (上:${r.bezelEdges.top.toFixed(2)} 下:${r.bezelEdges.bottom.toFixed(2)} 左:${r.bezelEdges.left.toFixed(2)} 右:${r.bezelEdges.right.toFixed(2)})`);
      lines.push(`    総合スコア: ${r.overallScore.toFixed(4)}`);
      lines.push(`    色: ${r.fillColor}`);
    });
  }
  lines.push('');
  
  lines.push('--- サマリー ---');
  lines.push(`結果: ${log.summary.success ? '成功' : '失敗'}`);
  lines.push(`検出数: ${log.summary.detectedCount}`);
  lines.push(`メッセージ: ${log.summary.message}`);
  
  return lines.join('\n');
}
