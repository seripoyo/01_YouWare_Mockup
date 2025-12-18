/**
 * デバッグ分析ユーティリティ
 * 白い余白検出とデバイスの向き判定のための詳細な分析機能
 */

export interface WhiteMarginAnalysis {
  deviceIndex: number;
  hasWhiteMargin: boolean;
  marginLocations: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  requiredBleedPercentage: number;
  detectedWhitePixels: number;
  totalEdgePixels: number;
  whitePixelRatio: number;
  recommendations: string[];
}

export interface DeviceOrientationAnalysis {
  deviceIndex: number;
  deviceType: string;
  // デバイス自体の向き（マスクの形状から判定）
  deviceRotation: number; // 0-360度
  // ノッチの位置から判定した向き
  notchPosition: {
    x: number;
    y: number;
    angle: number; // ノッチが指す方向
  };
  // 推奨される画像の回転角度
  recommendedImageRotation: number;
  // デバイスの長辺の角度
  majorAxisAngle: number;
  // 分析の詳細
  analysisDetails: {
    maskBounds: { width: number; height: number };
    aspectRatio: number;
    isPortrait: boolean;
    isLandscape: boolean;
    isDiagonal: boolean;
  };
}

/**
 * 白い余白を検出する関数
 * 合成後の画像で黒フレームと画像の間に白い隙間がないかチェック
 */
export function detectWhiteMargins(
  canvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  deviceIndex: number,
  deviceType: string
): WhiteMarginAnalysis {
  const ctx = canvas.getContext('2d');
  const maskCtx = maskCanvas.getContext('2d');

  if (!ctx || !maskCtx) {
    throw new Error('Canvas context not available');
  }

  const width = canvas.width;
  const height = canvas.height;

  // キャンバスのデータを取得
  const imageData = ctx.getImageData(0, 0, width, height);
  const maskData = maskCtx.getImageData(0, 0, width, height);

  const data = imageData.data;
  const mask = maskData.data;

  // エッジの白いピクセルを検出
  const edgeDepth = 10; // エッジから10ピクセルの深さをチェック
  let whitePixelCount = 0;
  let totalEdgePixels = 0;

  // 各辺の白いピクセル数をカウント
  const margins = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  };

  // 上端チェック
  for (let y = 0; y < edgeDepth; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const maskLuminance = (mask[idx] + mask[idx + 1] + mask[idx + 2]) / 3;

      // マスクが白い（デバイス画面）領域で
      if (maskLuminance > 200) {
        totalEdgePixels++;
        const luminance = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        // 実際の画像が白い（余白）場合
        if (luminance > 240) {
          whitePixelCount++;
          margins.top++;
        }
      }
    }
  }

  // 下端チェック
  for (let y = height - edgeDepth; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const maskLuminance = (mask[idx] + mask[idx + 1] + mask[idx + 2]) / 3;

      if (maskLuminance > 200) {
        totalEdgePixels++;
        const luminance = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        if (luminance > 240) {
          whitePixelCount++;
          margins.bottom++;
        }
      }
    }
  }

  // 左端チェック
  for (let x = 0; x < edgeDepth; x++) {
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const maskLuminance = (mask[idx] + mask[idx + 1] + mask[idx + 2]) / 3;

      if (maskLuminance > 200) {
        totalEdgePixels++;
        const luminance = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        if (luminance > 240) {
          whitePixelCount++;
          margins.left++;
        }
      }
    }
  }

  // 右端チェック
  for (let x = width - edgeDepth; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const maskLuminance = (mask[idx] + mask[idx + 1] + mask[idx + 2]) / 3;

      if (maskLuminance > 200) {
        totalEdgePixels++;
        const luminance = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        if (luminance > 240) {
          whitePixelCount++;
          margins.right++;
        }
      }
    }
  }

  const whitePixelRatio = totalEdgePixels > 0 ? whitePixelCount / totalEdgePixels : 0;
  const hasWhiteMargin = whitePixelRatio > 0.01; // 1%以上が白い場合は余白ありと判定

  // 必要なブリード率を計算
  let requiredBleedPercentage = 0;
  if (hasWhiteMargin) {
    // 最も白い辺を基準にブリード率を計算
    const maxMargin = Math.max(margins.top, margins.bottom, margins.left, margins.right);
    const edgePixelCount = edgeDepth * (width + height) * 2;
    const marginRatio = maxMargin / edgePixelCount;

    // デバイスタイプに応じた基本ブリード率
    const baseBleed = deviceType === 'laptop' ? 10 : deviceType === 'tablet' ? 7 : 5;

    // 余白の量に応じて追加ブリード
    requiredBleedPercentage = baseBleed + Math.ceil(marginRatio * 100);
  }

  // 推奨事項の生成
  const recommendations: string[] = [];
  if (hasWhiteMargin) {
    recommendations.push(`${requiredBleedPercentage}%のブリードを適用してください`);

    if (margins.left > margins.right * 2 || margins.right > margins.left * 2) {
      recommendations.push('左右の余白が不均等です。画像の中心位置を調整してください');
    }
    if (margins.top > margins.bottom * 2 || margins.bottom > margins.top * 2) {
      recommendations.push('上下の余白が不均等です。画像の中心位置を調整してください');
    }
  }

  return {
    deviceIndex,
    hasWhiteMargin,
    marginLocations: margins,
    requiredBleedPercentage,
    detectedWhitePixels: whitePixelCount,
    totalEdgePixels,
    whitePixelRatio,
    recommendations
  };
}

/**
 * デバイスの向きを詳細に分析する関数
 */
export function analyzeDeviceOrientation(
  maskCanvas: HTMLCanvasElement,
  deviceIndex: number,
  deviceType: string
): DeviceOrientationAnalysis {
  const ctx = maskCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  const width = maskCanvas.width;
  const height = maskCanvas.height;
  const maskData = ctx.getImageData(0, 0, width, height);
  const data = maskData.data;

  // 白いピクセル（デバイス画面）の座標を収集
  const whitePixels: Array<{x: number, y: number}> = [];
  // 黒いピクセル（ノッチ）の座標を収集
  const blackPixels: Array<{x: number, y: number}> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const luminance = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

      if (luminance > 200) {
        whitePixels.push({x, y});
      } else if (luminance < 30) {
        blackPixels.push({x, y});
      }
    }
  }

  // デバイスの重心を計算
  const centerX = whitePixels.reduce((sum, p) => sum + p.x, 0) / whitePixels.length || width / 2;
  const centerY = whitePixels.reduce((sum, p) => sum + p.y, 0) / whitePixels.length || height / 2;

  // PCA（主成分分析）でデバイスの主軸を計算
  let covXX = 0, covXY = 0, covYY = 0;
  for (const pixel of whitePixels) {
    const dx = pixel.x - centerX;
    const dy = pixel.y - centerY;
    covXX += dx * dx;
    covXY += dx * dy;
    covYY += dy * dy;
  }

  const n = whitePixels.length || 1;
  covXX /= n;
  covXY /= n;
  covYY /= n;

  // 主軸の角度を計算
  const theta = Math.atan2(2 * covXY, covXX - covYY) / 2;
  let majorAxisAngle = theta * 180 / Math.PI;

  // 角度を0-360度に正規化
  if (majorAxisAngle < 0) majorAxisAngle += 360;

  // ノッチの位置を計算
  let notchX = 0, notchY = 0, notchAngle = 0;
  if (blackPixels.length > 100) {
    notchX = blackPixels.reduce((sum, p) => sum + p.x, 0) / blackPixels.length;
    notchY = blackPixels.reduce((sum, p) => sum + p.y, 0) / blackPixels.length;

    // ノッチの角度（デバイス中心からの角度）
    const notchDX = notchX - centerX;
    const notchDY = notchY - centerY;
    notchAngle = Math.atan2(notchDY, notchDX) * 180 / Math.PI;
    if (notchAngle < 0) notchAngle += 360;
  }

  // デバイスの向きを判定
  const aspectRatio = width / height;
  const isPortrait = aspectRatio < 0.75;
  const isLandscape = aspectRatio > 1.33;
  const isDiagonal = !isPortrait && !isLandscape;

  // デバイス自体の回転角度を判定
  let deviceRotation = 0;

  if (isPortrait) {
    // 縦向きデバイス
    // majorAxisAngleが0度付近なら正立、180度付近なら逆さ
    if (majorAxisAngle > 315 || majorAxisAngle < 45) {
      deviceRotation = 0;
    } else if (majorAxisAngle > 135 && majorAxisAngle < 225) {
      deviceRotation = 180;
    } else if (majorAxisAngle > 45 && majorAxisAngle < 135) {
      deviceRotation = 90;
    } else {
      deviceRotation = 270;
    }
  } else if (isLandscape) {
    // 横向きデバイス
    if (majorAxisAngle > 45 && majorAxisAngle < 135) {
      deviceRotation = 90;
    } else if (majorAxisAngle > 225 && majorAxisAngle < 315) {
      deviceRotation = 270;
    } else if (majorAxisAngle > 135 && majorAxisAngle < 225) {
      deviceRotation = 180;
    } else {
      deviceRotation = 0;
    }
  } else {
    // 斜めの場合はmajorAxisAngleをそのまま使用
    deviceRotation = Math.round(majorAxisAngle);
  }

  // ノッチ位置を考慮した推奨画像回転角度
  let recommendedImageRotation = 0;

  if (deviceType === 'smartphone' && blackPixels.length > 100) {
    // ノッチの位置に基づいて画像を回転
    // ノッチが上（-90度～90度の範囲）にあるべき
    if (notchAngle > 90 && notchAngle <= 180) {
      // ノッチが左側にある -> 90度右回転
      recommendedImageRotation = 90;
    } else if (notchAngle > 180 && notchAngle <= 270) {
      // ノッチが下側にある -> 180度回転
      recommendedImageRotation = 180;
    } else if (notchAngle > 270 || notchAngle <= 0) {
      // ノッチが右側にある -> 90度左回転（-90度）
      recommendedImageRotation = -90;
    }
    // 0-90度の範囲はノッチが上にあるので回転不要
  } else {
    // ノッチがない場合はデバイスの向きに基づく
    recommendedImageRotation = -deviceRotation;
  }

  return {
    deviceIndex,
    deviceType,
    deviceRotation,
    notchPosition: {
      x: notchX,
      y: notchY,
      angle: notchAngle
    },
    recommendedImageRotation,
    majorAxisAngle,
    analysisDetails: {
      maskBounds: { width, height },
      aspectRatio,
      isPortrait,
      isLandscape,
      isDiagonal
    }
  };
}

// visualizeDebugInfo関数は削除（元のCanvasを破壊するため不要）
// デバッグ情報はコンソール出力とDebugPanelコンポーネントで十分