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
  minAreaRatio: 0.005,
  minRectangularity: 0.35,  // 0.65→0.35: 傾いたデバイスや角丸画面に対応（sp_1x1_023_pink等）
  minBezelScore: 0.20,      // 0.4→0.20: 画像端のデバイスや傾いたベゼルに対応
  bezelWidth: 15,
  darkThreshold: 0.25,
  minBezelEdges: 1,         // 3→1: 片側のみベゼルが見えるケースに対応
};

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
 * デバイス画面領域を検出（メイン関数）
 */
export function detectDeviceScreens(
  imageData: ImageData,
  options: DetectionOptions = {}
): ScreenRegion[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height } = imageData;
  const totalPixels = width * height;

  // ステップ1: 白ピクセルマスクを作成
  const mask = createWhitePixelMask(imageData, opts.luminanceThreshold);

  // ステップ2: BFS連結成分抽出
  const rawRegions = extractConnectedRegions(mask, width, height);

  // ステップ3: フィルタリングとスコアリング
  const screenRegions: DetectedRegion[] = [];

  for (const region of rawRegions) {
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

    if (bezelScore < opts.minBezelScore) continue;

    // 4辺のうち指定数以上がベゼルを持つかチェック（閾値を0.3→0.15に緩和）
    const edgesWithBezel = [bezelEdges.top, bezelEdges.bottom, bezelEdges.left, bezelEdges.right]
      .filter(score => score > 0.15).length;

    if (edgesWithBezel < opts.minBezelEdges) continue;

    // マスク作成
    const regionMask = createRegionMask(pixels, regionBounds, width);

    // 総合スコア計算
    const overallScore = bezelScore * areaRatio * rectangularity * 1000;

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
 */
export function detectDeviceScreensWithLog(
  imageData: ImageData,
  options: DetectionOptions = {}
): { regions: ScreenRegion[]; log: DetectionLog } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height } = imageData;
  const totalPixels = width * height;

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

  // ステップ1: 白ピクセルマスクを作成
  const mask = createWhitePixelMask(imageData, opts.luminanceThreshold);
  
  // 白ピクセル数をカウント
  let whitePixelCount = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 1) whitePixelCount++;
  }
  log.stages.whitePixelCount = whitePixelCount;
  log.stages.whitePixelRatio = whitePixelCount / totalPixels;

  // ステップ2: BFS連結成分抽出
  const rawRegions = extractConnectedRegions(mask, width, height);
  log.stages.rawRegionsCount = rawRegions.length;
  
  // 生の領域情報を記録
  rawRegions.forEach((region, index) => {
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

  // ステップ3: フィルタリングとスコアリング
  const screenRegions: DetectedRegion[] = [];
  let afterAreaFilter = 0;
  let afterRectangularityFilter = 0;
  let afterBezelScoreFilter = 0;
  let afterBezelEdgesFilter = 0;

  for (let regionIdx = 0; regionIdx < rawRegions.length; regionIdx++) {
    const region = rawRegions[regionIdx];
    const { bounds, pixels } = region;
    const { minX, minY, maxX, maxY } = bounds;

    const boundWidth = maxX - minX + 1;
    const boundHeight = maxY - minY + 1;
    const regionBounds = { x: minX, y: minY, width: boundWidth, height: boundHeight };

    // 面積フィルタ
    const areaRatio = pixels.length / totalPixels;
    if (areaRatio < opts.minAreaRatio) {
      log.filteredOutReasons.push({
        regionIndex: regionIdx,
        bounds: regionBounds,
        reason: 'AREA_TOO_SMALL',
        details: { areaRatio },
      });
      continue;
    }
    afterAreaFilter++;

    // 矩形度フィルタ
    const rectangularity = calculateRectangularity(pixels.length, bounds);
    if (rectangularity < opts.minRectangularity) {
      log.filteredOutReasons.push({
        regionIndex: regionIdx,
        bounds: regionBounds,
        reason: 'LOW_RECTANGULARITY',
        details: { areaRatio, rectangularity },
      });
      continue;
    }
    afterRectangularityFilter++;

    // ベゼルスコア計算
    const bezelEdges = checkBezelEdges(imageData, regionBounds, opts.bezelWidth, opts.darkThreshold);
    const bezelScore = calculateBezelScore(bezelEdges);

    if (bezelScore < opts.minBezelScore) {
      log.filteredOutReasons.push({
        regionIndex: regionIdx,
        bounds: regionBounds,
        reason: 'LOW_BEZEL_SCORE',
        details: { areaRatio, rectangularity, bezelScore, bezelEdges },
      });
      continue;
    }
    afterBezelScoreFilter++;

    // 4辺のうち指定数以上がベゼルを持つかチェック（閾値0.15: detectDeviceScreensと同一）
    const edgesWithBezel = [bezelEdges.top, bezelEdges.bottom, bezelEdges.left, bezelEdges.right]
      .filter(score => score > 0.15).length;

    if (edgesWithBezel < opts.minBezelEdges) {
      log.filteredOutReasons.push({
        regionIndex: regionIdx,
        bounds: regionBounds,
        reason: 'INSUFFICIENT_BEZEL_EDGES',
        details: { areaRatio, rectangularity, bezelScore, bezelEdges, edgesWithBezel },
      });
      continue;
    }
    afterBezelEdgesFilter++;

    // マスク作成
    const regionMask = createRegionMask(pixels, regionBounds, width);

    // 総合スコア計算
    const overallScore = bezelScore * areaRatio * rectangularity * 1000;

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

  log.stages.afterAreaFilter = afterAreaFilter;
  log.stages.afterRectangularityFilter = afterRectangularityFilter;
  log.stages.afterBezelScoreFilter = afterBezelScoreFilter;
  log.stages.afterBezelEdgesFilter = afterBezelEdgesFilter;

  // スコア順にソートして上位3つを選択
  const sorted = [...screenRegions].sort((a, b) => b.overallScore - a.overallScore);
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
      ? `白エリアが検出されませんでした。白ピクセル比率: ${(log.stages.whitePixelRatio * 100).toFixed(2)}%, 候補領域数: ${rawRegions.length}, フィルタ後: 0`
      : `${finalRegions.length}個のデバイス画面を検出しました`,
  };

  return { regions: finalRegions, log };
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
