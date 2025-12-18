/**
 * デバイスの向き判定と変換に関するユーティリティ
 */

import type { ScreenRectPct } from '../types/frame';

export type Orientation = 'portrait' | 'landscape' | 'square';

/**
 * アスペクト比から向きを判定
 */
export function getOrientation(width: number, height: number): Orientation {
  const aspectRatio = width / height;

  // 閾値を少し緩めに設定（0.95-1.05をsquareとする）
  if (aspectRatio >= 0.95 && aspectRatio <= 1.05) {
    return 'square';
  } else if (aspectRatio < 0.95) {
    return 'portrait';
  } else {
    return 'landscape';
  }
}

/**
 * デバイス領域の向きを角度で表現
 * 上を0度として、時計回りに0-360度で表現
 * 縦向き（portrait）: 0度または180度
 * 横向き（landscape）: 90度または270度
 */
export function getDeviceAngle(rect: ScreenRectPct): number {
  const orientation = getOrientation(rect.wPct, rect.hPct);

  switch (orientation) {
    case 'portrait':
      return 0; // 縦向きは0度
    case 'landscape':
      return 90; // 横向きは90度
    case 'square':
      return 0; // 正方形は縦向き扱い
  }
}

/**
 * 画像とデバイス領域の向きが一致しているか判定
 */
export function isOrientationMatched(
  imageWidth: number,
  imageHeight: number,
  regionWidth: number,
  regionHeight: number
): boolean {
  const imageOrientation = getOrientation(imageWidth, imageHeight);
  const regionOrientation = getOrientation(regionWidth, regionHeight);

  // 正方形の場合は常に一致とする
  if (imageOrientation === 'square' || regionOrientation === 'square') {
    return true;
  }

  return imageOrientation === regionOrientation;
}

/**
 * デバイス領域の角丸半径を計算
 * デバイスのカテゴリーに基づいて適切な角丸を返す
 */
export function getCornerRadius(
  width: number,
  height: number,
  deviceCategory?: string
): number {
  const minDimension = Math.min(width, height);

  // カテゴリーに基づく角丸の割合（より滑らかに調整）
  if (deviceCategory === 'smartphone' || deviceCategory?.includes('phone')) {
    // スマートフォンはより丸みを帯びた角（10-12%）
    return minDimension * 0.11;
  } else if (deviceCategory === 'tablet') {
    // タブレットは中程度の角丸（6-8%）
    return minDimension * 0.07;
  } else if (deviceCategory === 'laptop' || deviceCategory === 'desktop') {
    // PCは控えめな角丸（3-4%）
    return minDimension * 0.035;
  }

  // デフォルトは5%
  return minDimension * 0.05;
}

/**
 * デバッグ用の詳細情報を生成
 */
export interface DeviceDebugInfo {
  frameName: string;
  deviceIndex: number;
  deviceAngle: number;
  regionSize: { width: number; height: number };
  regionOrientation: Orientation;
  cornerRadius: number;
  imageOrientation?: Orientation;
  imageSize?: { width: number; height: number };
  isOrientationMatched?: boolean;
  isFittingCorrectly?: boolean;
  fitMode?: 'contain' | 'cover';
}

export function generateDeviceDebugInfo(
  frameName: string,
  deviceIndex: number,
  rect: ScreenRectPct,
  containerSize: { w: number; h: number },
  imageNatural?: { w: number; h: number } | null,
  deviceCategory?: string,
  fitMode?: 'contain' | 'cover'
): DeviceDebugInfo {
  const regionWidth = rect.wPct * containerSize.w;
  const regionHeight = rect.hPct * containerSize.h;
  const regionOrientation = getOrientation(regionWidth, regionHeight);
  const deviceAngle = getDeviceAngle(rect);
  const cornerRadius = getCornerRadius(regionWidth, regionHeight, deviceCategory);

  const info: DeviceDebugInfo = {
    frameName,
    deviceIndex,
    deviceAngle,
    regionSize: {
      width: Math.round(regionWidth),
      height: Math.round(regionHeight),
    },
    regionOrientation,
    cornerRadius: Math.round(cornerRadius),
  };

  if (imageNatural) {
    const imageOrientation = getOrientation(imageNatural.w, imageNatural.h);
    const isMatched = isOrientationMatched(
      imageNatural.w,
      imageNatural.h,
      regionWidth,
      regionHeight
    );

    info.imageOrientation = imageOrientation;
    info.imageSize = {
      width: imageNatural.w,
      height: imageNatural.h,
    };
    info.isOrientationMatched = isMatched;
    info.isFittingCorrectly = true; // これは実際の描画後に更新する
    info.fitMode = fitMode;
  }

  return info;
}

/**
 * ノッチ/ダイナミックアイランドの位置を検出して、デバイスの向きを判定
 * 改良版：デバイスの実際の回転角度も考慮
 * @param maskData マスクのImageData
 * @param canvasWidth キャンバスの幅
 * @param canvasHeight キャンバスの高さ
 * @returns 検出された向き（0: 上, 90: 右, 180: 下, 270: 左, -90: 左）
 */
export function detectNotchOrientation(
  maskData: ImageData,
  canvasWidth: number,
  canvasHeight: number
): number {
  const data = maskData.data;

  // ノッチ（黒い部分）の重心を計算
  let blackPixelXSum = 0;
  let blackPixelYSum = 0;
  let blackPixelCount = 0;

  // 全体をスキャンして黒いピクセルの位置を収集
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      const idx = (y * canvasWidth + x) * 4;
      const luminance = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      if (luminance < 30) {  // 黒いピクセル
        blackPixelXSum += x;
        blackPixelYSum += y;
        blackPixelCount++;
      }
    }
  }

  // ノッチが検出されない場合はデフォルト
  if (blackPixelCount < 100) {
    return 0;
  }

  // ノッチの重心を計算
  const notchCenterX = blackPixelXSum / blackPixelCount;
  const notchCenterY = blackPixelYSum / blackPixelCount;

  // キャンバスの中心
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // ノッチの相対位置（中心からの位置）
  const relX = notchCenterX - centerX;
  const relY = notchCenterY - centerY;

  // 各辺からの距離を計算
  const distFromTop = notchCenterY;
  const distFromBottom = canvasHeight - notchCenterY;
  const distFromLeft = notchCenterX;
  const distFromRight = canvasWidth - notchCenterX;

  // 最も近い辺を見つける
  const minDist = Math.min(distFromTop, distFromBottom, distFromLeft, distFromRight);

  // ノッチの位置に基づいて、画像を回転させる角度を計算
  // ノッチがある位置を「上」とみなすために、画像を回転させる

  if (minDist === distFromTop) {
    // ノッチが上部に最も近い → 画像は回転不要
    return 0;

  } else if (minDist === distFromBottom) {
    // ノッチが下部に最も近い → 180度回転して上に持ってくる
    return 180;

  } else if (minDist === distFromLeft) {
    // ノッチが左側に最も近い → 90度右回転して上に持ってくる
    return 90;

  } else if (minDist === distFromRight) {
    // ノッチが右側に最も近い → 90度左回転（-90度）して上に持ってくる
    return -90;
  }

  // デフォルトは正常な向き
  return 0;
}

/**
 * マスクの白い領域の主軸角度を計算（PCA: Principal Component Analysis）
 * デバイスの実際の傾きを検出するため
 */
export function calculateDeviceTiltAngle(
  maskData: ImageData,
  canvasWidth: number,
  canvasHeight: number
): number {
  const data = maskData.data;

  // 白いピクセル（デバイス本体）の座標を収集
  const whitePixels: Array<{x: number, y: number}> = [];

  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      const idx = (y * canvasWidth + x) * 4;
      const luminance = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      if (luminance > 200) {  // 白いピクセル
        whitePixels.push({x, y});
      }
    }
  }

  if (whitePixels.length === 0) return 0;

  // 重心を計算
  const centerX = whitePixels.reduce((sum, p) => sum + p.x, 0) / whitePixels.length;
  const centerY = whitePixels.reduce((sum, p) => sum + p.y, 0) / whitePixels.length;

  // 共分散行列の要素を計算
  let covXX = 0, covXY = 0, covYY = 0;

  for (const pixel of whitePixels) {
    const dx = pixel.x - centerX;
    const dy = pixel.y - centerY;
    covXX += dx * dx;
    covXY += dx * dy;
    covYY += dy * dy;
  }

  covXX /= whitePixels.length;
  covXY /= whitePixels.length;
  covYY /= whitePixels.length;

  // 主軸の角度を計算（固有ベクトルから）
  const angle = Math.atan2(2 * covXY, covXX - covYY) / 2;

  // ラジアンから度に変換
  return angle * 180 / Math.PI;
}