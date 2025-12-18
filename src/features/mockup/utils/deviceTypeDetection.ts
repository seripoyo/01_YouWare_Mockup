/**
 * デバイス種類検出ユーティリティ
 * サンプル画像から学習した特徴を基に、より正確なデバイス判定を行う
 *
 * ⚠️ 重要: デバイス識別処理を修正する際は、必ず以下の仕様書を参照してください
 * @see DEVICE_DETECTION_SPEC.md - デバイス識別の完全な仕様書
 *
 * 仕様書の主要ポイント:
 * 1. 視覚的特徴を最優先: キーボード → ノッチ → アスペクト比の順
 * 2. デバイス番号 ≠ デバイスタイプ: 面積順の番号と視覚特徴による判定は別
 * 3. キーボード検出閾値: 40%以上（水平縞パターンも考慮）
 * 4. ノッチ検出閾値: 3%以上
 * 5. 信頼度ブースト: 視覚的特徴検出時は+30%
 */

import { ScreenRectPct } from '../types/frame';

export type DeviceType = 'laptop' | 'smartphone' | 'tablet' | 'unknown';

/**
 * デバイス種類の定義と特徴
 */
export const DeviceCharacteristics = {
  laptop: {
    // ラップトップ: 横長で、一般的に16:9または16:10のアスペクト比
    aspectRatioRange: { min: 1.3, max: 2.0 },
    typicalAspectRatios: [16/9, 16/10, 3/2],
    hasNotch: false,
    hasDynamicIsland: false,
    description: 'ノートPC - 横長のディスプレイ',
    orientation: 'landscape' as const,
  },
  smartphone: {
    // スマートフォン: 縦長で、ノッチやダイナミックアイランドを持つ可能性
    aspectRatioRange: { min: 0.4, max: 0.7 },
    typicalAspectRatios: [9/16, 9/19.5, 9/20, 10/16],
    hasNotch: true,
    hasDynamicIsland: true,
    description: 'スマートフォン - 縦長のディスプレイ、ノッチ/ダイナミックアイランド付き',
    orientation: 'portrait' as const,
  },
  tablet: {
    // タブレット: より正方形に近いアスペクト比
    aspectRatioRange: { min: 0.7, max: 1.3 },
    typicalAspectRatios: [3/4, 4/5, 1, 5/4, 4/3],
    hasNotch: false,
    hasDynamicIsland: false,
    description: 'タブレット - 正方形に近いディスプレイ',
    orientation: 'variable' as const, // 縦横どちらでも使用可能
  },
};

/**
 * 視覚的特徴からデバイス種類を判定
 * アスペクト比は使用せず、キーボード・ノッチの有無のみで判定
 * @param width 幅
 * @param height 高さ
 * @param hasBlackCutout ノッチ/ダイナミックアイランドの有無
 * @param hasKeyboard キーボードの有無
 * @param hasMetalSide 金属側面の有無（タブレット判定用）
 */
export function detectDeviceType(
  width: number,
  height: number,
  hasBlackCutout: boolean = false,
  hasKeyboard: boolean = false,
  hasMetalSide: boolean = false
): DeviceType {
  const aspectRatio = width / height;

  console.log('🔍 Device type detection starting:', {
    aspectRatio: aspectRatio.toFixed(2),
    hasBlackCutout,
    hasKeyboard,
    hasMetalSide,
    width,
    height
  });

  // 視覚的特徴による判定のみを使用
  // アスペクト比は一切使用しない

  // 【第1優先】キーボードがある → ラップトップ（確定）
  if (hasKeyboard) {
    console.log('✅ Laptop detected: keyboard/horizontal plate found');
    return 'laptop';
  }

  // 【第2優先】ノッチがある＆極端に細長い → スマートフォン（確定）
  // スマートフォンは必ず極端に細長い（アスペクト比 < 0.56 または > 1.78）
  if (hasBlackCutout) {
    // iPhone/Androidのような極端な細長さ（9:16 = 0.56, 16:9 = 1.78）
    const isExtremelyElongated = aspectRatio < 0.56 || aspectRatio > 1.78;
    if (isExtremelyElongated) {
      console.log('✅ Smartphone detected: notch found in extremely elongated device');
      return 'smartphone';
    }
    // ノッチがあるが極端に細長くない → ラップトップ（MacBookなど）
    console.log('✅ Laptop detected: notch found but not extremely elongated');
    return 'laptop';
  }

  // 【第3優先】キーボードもノッチもない
  // この時点で確実にタブレット
  // （アスペクト比に関わらず、視覚的特徴がなければタブレット）

  console.log('✅ Tablet detected: no keyboard, no notch - defaulting to tablet');
  return 'tablet';
}

/**
 * 画面領域情報からデバイス種類を検出（マスクデータ分析付き）
 */
import type {
  DeviceDetectionMetrics,
  KeyboardMetrics,
  FrameKeyboardMetrics,
  NotchMetrics,
  MetalSideMetrics,
  DeviceAreaMetrics
} from '../../types/debug';


export function detectDeviceTypeFromRegion(
  rect: ScreenRectPct,
  containerSize: { w: number; h: number },
  maskData?: ImageData,
  frameImageData?: ImageData
): {
  type: DeviceType;
  confidence: number;
  hasNotch: boolean;
  hasKeyboard: boolean;
  hasMetalSide: boolean;
  keyboardMetrics?: KeyboardMetrics;
  frameKeyboardMetrics?: FrameKeyboardMetrics;
  notchMetrics?: NotchMetrics;
  metalSideMetrics?: MetalSideMetrics;
  deviceAreaMetrics?: DeviceAreaMetrics;
} {
  // 実際のピクセルサイズを計算
  const actualWidth = rect.wPct * containerSize.w;
  const actualHeight = rect.hPct * containerSize.h;

  // マスクデータから視覚的特徴を検出
  let hasNotch = false;
  let hasKeyboard = false;
  let hasMetalSide = false;

  let notchMetrics: NotchMetrics | undefined;
  let metalSideMetrics: MetalSideMetrics | undefined;
  if (maskData) {
    const notchResult = detectBlackCutout(maskData);
    hasNotch = notchResult.detected;
    notchMetrics = notchResult.metrics;

    const metalResult = detectMetalSide(maskData);
    hasMetalSide = metalResult.detected;
    metalSideMetrics = metalResult.metrics;
  }

  // キーボードはフレーム全体から検出（画面の外側にあるため）
  let frameKeyboardMetrics: FrameKeyboardMetrics | undefined;
  let maskKeyboardMetrics: KeyboardMetrics | undefined;

  if (frameImageData) {
    const keyboardResult = detectKeyboardFromFrame(frameImageData, rect);
    hasKeyboard = keyboardResult.detected;
    frameKeyboardMetrics = keyboardResult.metrics;
  }

  if (maskData && (!hasKeyboard || !frameKeyboardMetrics)) {
    const keyboardResult = detectKeyboard(maskData);
    if (keyboardResult.detected && keyboardResult.metrics.detected) {
      hasKeyboard = true;
    }
    maskKeyboardMetrics = keyboardResult.metrics;
  }

  const type = detectDeviceType(actualWidth, actualHeight, hasNotch, hasKeyboard, hasMetalSide);

  // 信頼度を計算（0-100%）
  let confidence = 50; // 基本信頼度

  const aspectRatio = actualWidth / actualHeight;
  const chars = DeviceCharacteristics[type as keyof typeof DeviceCharacteristics];

  if (chars && type !== 'unknown') {
    // アスペクト比が範囲の中央に近いほど高信頼度
    const range = chars.aspectRatioRange;
    const center = (range.min + range.max) / 2;
    const deviation = Math.abs(aspectRatio - center) / (range.max - range.min);
    confidence += (1 - deviation) * 30;

    // 視覚的特徴による信頼度ブースト
    if (type === 'laptop' && hasKeyboard) {
      confidence += 30; // ラップトップでキーボード検出 = 高信頼度
    }
    if (type === 'smartphone' && hasNotch) {
      confidence += 30; // スマホでノッチ検出 = 高信頼度
    }
    if (type === 'tablet' && hasMetalSide && !hasKeyboard && !hasNotch) {
      confidence += 25; // タブレットで金属側面検出 = 高信頼度
    }

    confidence = Math.min(100, Math.max(0, confidence));
  }

  console.log('🎯 Device type detection result:', {
    type,
    confidence: `${confidence.toFixed(1)}%`,
    hasNotch,
    hasKeyboard,
    hasMetalSide,
    aspectRatio: aspectRatio.toFixed(2)
  });

  return {
    type,
    confidence,
    hasNotch,
    hasKeyboard,
    hasMetalSide,
    keyboardMetrics: maskKeyboardMetrics,
    frameKeyboardMetrics,
    notchMetrics,
    metalSideMetrics,
    deviceAreaMetrics: maskData
      ? {
          width: maskData.width,
          height: maskData.height,
        }
      : undefined,
  };
}

/**
 * フレーム全体の画像から画面領域外のキーボードを検出
 * @param frameImageData フレーム全体のImageData
 * @param screenRect 画面領域の矩形（0-1の相対座標）
 */
export function detectKeyboardFromFrame(
  frameImageData: ImageData,
  screenRect: ScreenRectPct
): { detected: boolean; metrics: FrameKeyboardMetrics } {
  const { data, width, height } = frameImageData;

  // 画面領域の実際の座標を計算
  const screenX = Math.floor(screenRect.xPct * width);
  const screenY = Math.floor(screenRect.yPct * height);
  const screenW = Math.floor(screenRect.wPct * width);
  const screenH = Math.floor(screenRect.hPct * height);
  const screenBottomY = screenY + screenH;

  // 画面の下部から画像の下端までをチェック（キーボードが存在する領域）
  // 最小3ピクセル（小さいデバイスでも検出可能に）、最大で画面高さの50%まで
  const rawKeyboardAreaHeight = height - screenBottomY;
  const keyboardAreaHeight = Math.min(
    Math.max(3, rawKeyboardAreaHeight),
    Math.floor(screenH * 0.5)
  );

  // 画面下に領域がない場合のみスキップ（より緩い閾値）
  if (rawKeyboardAreaHeight < 1) {
    console.log('⚠️ No space below screen for keyboard check', {
      screenBottomY,
      imageHeight: height,
      remainingSpace: rawKeyboardAreaHeight
    });
    return {
      detected: false,
      metrics: {
        detected: false,
        keyboardAreaHeight: 0,
        expandedHeight: 0,
      }
    };
  }

  // キーボード検出領域：画面の下部から
  const checkStartY = screenBottomY;
  const checkEndY = Math.min(screenBottomY + keyboardAreaHeight, height);

  console.log('🔎 Checking for keyboard in frame area:', {
    screenRect: { x: screenX, y: screenY, w: screenW, h: screenH },
    screenBottomY,
    keyboardAreaHeight,
    checkRegion: `Y: ${checkStartY}-${checkEndY}`
  });

  // 中央80%の幅をチェック（DEVICE_DETECTION_SPEC.mdに準拠）
  const checkStartX = screenX + Math.floor(screenW * 0.10);
  const checkEndX = screenX + Math.floor(screenW * 0.90);

  let blackPixelCount = 0;
  let midTonePixelCount = 0;
  let whitePixelCount = 0;
  let totalPixelCount = 0;
  let hasHorizontalPattern = false;

  // ピクセル分析
  for (let y = checkStartY; y < checkEndY; y++) {
    let rowBlackCount = 0;
    let rowMidToneCount = 0;
    let rowWhiteCount = 0;

    for (let x = checkStartX; x < checkEndX; x++) {
      const idx = (y * width + x) * 4;
      const luminance = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      totalPixelCount++;

      if (luminance < 50) {
        blackPixelCount++;
        rowBlackCount++;
      } else if (luminance >= 50 && luminance <= 200) {
        midTonePixelCount++;
        rowMidToneCount++;
      } else {
        whitePixelCount++;
        rowWhiteCount++;
      }
    }

    const rowWidth = checkEndX - checkStartX;
    const blackDominant = rowBlackCount > rowWidth * 0.3;
    const midToneDominant = rowMidToneCount > rowWidth * 0.3;
    const whiteDominant = rowWhiteCount > rowWidth * 0.3;

    if (blackDominant || midToneDominant || whiteDominant) {
      hasHorizontalPattern = true;
    }
  }

  // 判定基準
  const blackRatio = totalPixelCount > 0 ? blackPixelCount / totalPixelCount : 0;
  const midToneRatio = totalPixelCount > 0 ? midTonePixelCount / totalPixelCount : 0;
  const whiteRatio = totalPixelCount > 0 ? whitePixelCount / totalPixelCount : 0;

  // しきい値をさらに下げて、小さいデバイスでも検出可能にする
  // 画面外領域なので、何らかの色パターンがあればキーボードと判定
  // 小さいサイズ向けに閾値を調整：領域が小さい場合は閾値を緩める
  const isSmallArea = totalPixelCount < 500;
  const blackThreshold = isSmallArea ? 0.10 : 0.15;
  const midToneThreshold = isSmallArea ? 0.10 : 0.15;
  const whiteThreshold = isSmallArea ? 0.08 : 0.12;
  const totalThreshold = isSmallArea ? 0.15 : 0.25;
  
  const hasBlackKeyboard = blackRatio >= blackThreshold;
  const hasLightKeyboard = midToneRatio >= midToneThreshold || whiteRatio >= whiteThreshold;
  const hasSomePattern = (blackRatio + midToneRatio + whiteRatio) >= totalThreshold;
  const hasKeyboard = hasBlackKeyboard || hasLightKeyboard || hasHorizontalPattern || hasSomePattern;

  if (hasKeyboard) {
    const detectedColor =
      hasBlackKeyboard ? '黒' :
      hasLightKeyboard ? (midToneRatio > whiteRatio ? 'グレー' : '白/シルバー') :
      'パターン検出';

    console.log('⌨️ Keyboard detected from frame (below screen):', {
      color: detectedColor,
      blackRatio: blackRatio.toFixed(3),
      midToneRatio: midToneRatio.toFixed(3),
      whiteRatio: whiteRatio.toFixed(3),
      hasHorizontalPattern,
      checkedArea: `Y: ${checkStartY}-${checkEndY}, X: ${checkStartX}-${checkEndX}`,
      screenBottom: screenBottomY,
      keyboardAreaHeight
    });
  } else {
    console.log('❌ No keyboard detected in frame area:', {
      blackRatio: blackRatio.toFixed(3),
      midToneRatio: midToneRatio.toFixed(3),
      whiteRatio: whiteRatio.toFixed(3),
      totalRatio: (blackRatio + midToneRatio + whiteRatio).toFixed(3),
      hasHorizontalPattern,
      isSmallArea,
      thresholds: {
        blackNeeded: blackThreshold,
        midToneNeeded: midToneThreshold,
        whiteNeeded: whiteThreshold,
        totalNeeded: totalThreshold
      },
      checkedArea: `Y: ${checkStartY}-${checkEndY}, X: ${checkStartX}-${checkEndX}`,
      pixelsCounted: totalPixelCount
    });
  }

  return {
    detected: hasKeyboard,
    metrics: {
      detected: hasKeyboard,
      blackRatio,
      midToneRatio,
      whiteRatio,
      keyboardAreaHeight,
      expandedHeight: keyboardAreaHeight,
      method: hasBlackKeyboard ? 'black' : hasLightKeyboard ? 'midTone' : hasHorizontalPattern ? 'pattern' : 'frame-extension',
    }
  };
}

/**
 * マスク画像からキーボードの存在を検出（ラップトップ判定用）
 * ラップトップの場合、画面の下部に帯状の領域（キーボード/水平な板）が存在する
 * DEVICE_DETECTION_SPEC.md: キーボード側面は黒、白、シルバー、グレーなど多様
 */
export function detectKeyboard(maskData: ImageData): { detected: boolean; metrics: KeyboardMetrics } {
  const { data, width, height } = maskData;
  const aspectRatio = width / height; // デバッグログ用

  // キーボード検出領域を複数試行
  // 1. 標準領域：下部20%（DEVICE_DETECTION_SPEC.mdに準拠）
  // 2. 拡張領域：下部30%（斜めビュー対応）
  // 3. 広域領域：下部40%（床置きビュー対応）

  const regions = [
    { name: '標準(下部20%)', startRatio: 0.80, endRatio: 1.00 },
    { name: '拡張(下部30%)', startRatio: 0.70, endRatio: 1.00 },
    { name: '広域(下部40%)', startRatio: 0.60, endRatio: 1.00 }
  ];

  // デバッグ情報を収集
  const debugInfo: any = {
    aspectRatio: aspectRatio.toFixed(2),
    width,
    height,
    regions: []
  };

  for (const region of regions) {
    const checkStartY = Math.floor(height * region.startRatio);
    const checkEndY = Math.floor(height * region.endRatio);

    let blackPixelCount = 0;
    let midTonePixelCount = 0;
    let whitePixelCount = 0;
    let totalPixelCount = 0;

    // 中央80%の幅をチェック（DEVICE_DETECTION_SPEC.mdに準拠）
    const checkStartX = Math.floor(width * 0.10);
    const checkEndX = Math.floor(width * 0.90);

    // 水平エッジの検出（色によらないパターン検出）
    let horizontalEdgeCount = 0;
    let hasHorizontalPattern = false;

    // 各行のピクセル分析
    for (let y = checkStartY; y < checkEndY; y++) {
      let rowBlackCount = 0;
      let rowMidToneCount = 0;
      let rowWhiteCount = 0;
      let prevLuminance = -1;
      let edgesInRow = 0;

      for (let x = checkStartX; x < checkEndX; x++) {
        const idx = (y * width + x) * 4;
        const luminance = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

        totalPixelCount++;

        // 色の分類（DEVICE_DETECTION_SPEC.mdの色バリエーション対応）
        if (luminance < 50) {
          // 黒（DEVICE_DETECTION_SPEC.md: 輝度 < 50）
          blackPixelCount++;
          rowBlackCount++;
        } else if (luminance >= 50 && luminance <= 200) {
          // 中間色（グレー、シルバー）
          midTonePixelCount++;
          rowMidToneCount++;
        } else {
          // 白、明るいシルバー
          whitePixelCount++;
          rowWhiteCount++;
        }

        // 水平エッジ検出（輝度の急激な変化）
        if (prevLuminance >= 0) {
          const luminanceChange = Math.abs(luminance - prevLuminance);
          if (luminanceChange > 30) {
            edgesInRow++;
          }
        }
        prevLuminance = luminance;
      }

      // 水平縞パターンの検出（キーの境界線）
      const rowWidth = checkEndX - checkStartX;
      if (edgesInRow > rowWidth * 0.05) {
        horizontalEdgeCount++;
      }

      // この行の40%以上が同一色系統の場合、帯状領域と判定
      const blackDominant = rowBlackCount > rowWidth * 0.4;
      const midToneDominant = rowMidToneCount > rowWidth * 0.4;
      const whiteDominant = rowWhiteCount > rowWidth * 0.4;

      if (blackDominant || midToneDominant || whiteDominant) {
        hasHorizontalPattern = true;
      }
    }

    // 判定基準（DEVICE_DETECTION_SPEC.mdの3つの検出方法）
    const blackRatio = totalPixelCount > 0 ? blackPixelCount / totalPixelCount : 0;
    const midToneRatio = totalPixelCount > 0 ? midTonePixelCount / totalPixelCount : 0;
    const whiteRatio = totalPixelCount > 0 ? whitePixelCount / totalPixelCount : 0;

    // 方法1: 黒いキーボードの検出（DEVICE_DETECTION_SPEC.md: 40%閾値）
    const hasBlackKeyboard = blackRatio >= 0.40;

    // 方法2: 白/シルバー/グレーキーボードの検出（DEVICE_DETECTION_SPEC.md: 40%閾値）
    const hasLightKeyboard = midToneRatio >= 0.40;

    // 方法3: 水平縞パターン検出（色によらない）
    const hasEdgePattern = horizontalEdgeCount > 3;

    // いずれかの方法で検出されればキーボードあり
    const hasKeyboard = hasBlackKeyboard || hasLightKeyboard || hasHorizontalPattern || hasEdgePattern;

    // デバッグ情報を記録
    debugInfo.regions.push({
      name: region.name,
      blackRatio: blackRatio.toFixed(3),
      midToneRatio: midToneRatio.toFixed(3),
      whiteRatio: whiteRatio.toFixed(3),
      hasBlackKeyboard,
      hasLightKeyboard,
      hasHorizontalPattern,
      hasEdgePattern,
      detected: hasKeyboard
    });

    if (hasKeyboard) {
      const detectedColor =
        hasBlackKeyboard ? '黒' :
        hasLightKeyboard ? (midToneRatio > whiteRatio ? 'グレー' : '白/シルバー') :
        hasEdgePattern ? 'パターン検出' : '不明';

      console.log('⌨️ Keyboard/horizontal plate detected (laptop feature):', {
        region: region.name,
        color: detectedColor,
        blackRatio: blackRatio.toFixed(3),
        midToneRatio: midToneRatio.toFixed(3),
        whiteRatio: whiteRatio.toFixed(3),
        hasHorizontalPattern,
        hasEdgePattern,
        aspectRatio: aspectRatio.toFixed(2)
      });

      // キーボードが検出されたら早期リターン
      return {
        detected: true,
        metrics: {
          detected: true,
          blackRatio,
          midToneRatio,
          whiteRatio,
          method: hasBlackKeyboard ? 'black' : hasLightKeyboard ? 'midTone' : hasEdgePattern ? 'pattern' : undefined,
          region: region.name,
        }
      };
    }
  }

  // すべての領域でキーボードが検出されなかった場合のデバッグ出力
  console.log('❌ No keyboard detected in any region:', debugInfo);

  return {
    detected: false,
    metrics: {
      detected: false,
    }
  };
}

/**
 * マスクデータから金属側面を検出（タブレット判定用）
 * DEVICE_DETECTION_SPEC.md: タブレットの斜め/床置きビューで金属側面（2-5%厚）が見える
 */
export function detectMetalSide(maskData: ImageData): { detected: boolean; metrics: MetalSideMetrics } {
  const { data, width, height } = maskData;

  // 周辺5%の領域をスキャン
  const edgeThickness = Math.floor(Math.min(width, height) * 0.05);
  let metalPixelCount = 0;
  let totalPixelCount = 0;

  // 上下左右の端をチェック
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 端の領域のみチェック
      const isEdge =
        x < edgeThickness || x >= width - edgeThickness ||
        y < edgeThickness || y >= height - edgeThickness;

      if (!isEdge) continue;

      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

      // 彩度を計算（グレースケール判定）
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max > 0 ? (max - min) / max : 0;

      totalPixelCount++;

      // 金属色の検出: 輝度0.4〜0.7（白より暗く、黒より明るい）
      // かつ彩度が低い（グレースケール）
      if (luminance >= 102 && luminance <= 178 && saturation < 0.2) {
        metalPixelCount++;
      }
    }
  }

  // 端領域の10%以上が金属色の場合、金属側面ありと判定
  const metalRatio = totalPixelCount > 0 ? metalPixelCount / totalPixelCount : 0;
  const hasMetalSide = metalRatio > 0.1;

  if (hasMetalSide) {
    console.log('🔩 Metal side detected (tablet feature):', {
      metalRatio: metalRatio.toFixed(3),
      metalPixels: metalPixelCount,
      totalPixels: totalPixelCount
    });
  }

  return {
    detected: hasMetalSide,
    metrics: {
      detected: hasMetalSide,
      metalRatio,
    }
  };
}

/**
 * マスクデータから黒い切り抜き（ノッチ/ダイナミックアイランド）を検出
 */
export function detectBlackCutout(maskData: ImageData): { detected: boolean; metrics: NotchMetrics } {
  const { data, width, height } = maskData;

  // アスペクト比を確認
  const aspectRatio = width / height;

  // スマートフォン以外（アスペクト比が極端でない）はノッチなしと判定
  // スマートフォンは必ず極端に細長い（0.56以下または1.78以上）
  const isSmartphoneShape = aspectRatio < 0.56 || aspectRatio > 1.78;
  if (!isSmartphoneShape) {
    console.log('⚠️ Not smartphone shape, skipping notch detection (aspect ratio:', aspectRatio.toFixed(2), ')');
    return {
      detected: false,
      metrics: {
        detected: false,
        scanArea: 'N/A'
      }
    };
  }

  // 上部15%の領域をチェック（ノッチは通常上部の狭い領域にある）
  const checkHeight = Math.floor(height * 0.15);
  let blackPixelCount = 0;
  let totalPixelCount = 0;

  // 中央30%の幅のみをチェック（DEVICE_DETECTION_SPEC.md: より狭い範囲）
  const checkStartX = Math.floor(width * 0.35);
  const checkEndX = Math.floor(width * 0.65);

  // ノッチの連続性をチェックするための変数
  let consecutiveBlackRows = 0;
  let maxConsecutiveBlack = 0;

  for (let y = 0; y < checkHeight; y++) {
    let rowBlackCount = 0;
    let rowTotalCount = 0;

    for (let x = checkStartX; x < checkEndX; x++) {
      const idx = (y * width + x) * 4;
      const luminance = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      totalPixelCount++;
      rowTotalCount++;

      // 黒いピクセル（輝度30未満）
      if (luminance < 30) {
        blackPixelCount++;
        rowBlackCount++;
      }
    }

    // この行が黒い切り抜きの一部かチェック
    const rowBlackRatio = rowTotalCount > 0 ? rowBlackCount / rowTotalCount : 0;
    if (rowBlackRatio > 0.2) {
      consecutiveBlackRows++;
      maxConsecutiveBlack = Math.max(maxConsecutiveBlack, consecutiveBlackRows);
    } else {
      consecutiveBlackRows = 0;
    }
  }

  const blackRatio = totalPixelCount > 0 ? blackPixelCount / totalPixelCount : 0;
  const hasNotch = blackRatio > 0.03 && maxConsecutiveBlack >= 3;

  if (hasNotch) {
    console.log('📱 Notch detected (smartphone feature):', {
      blackRatio: blackRatio.toFixed(3),
      aspectRatio: aspectRatio.toFixed(2),
      blackPixels: blackPixelCount,
      totalPixels: totalPixelCount,
      consecutiveRows: maxConsecutiveBlack,
      scanArea: `中央${((checkEndX - checkStartX) / width * 100).toFixed(0)}%`
    });
  } else if (blackRatio > 0.01) {
    console.log('⚠️ Black pixels found but not enough for notch:', {
      blackRatio: blackRatio.toFixed(3),
      aspectRatio: aspectRatio.toFixed(2),
      consecutiveRows: maxConsecutiveBlack,
      reason: maxConsecutiveBlack < 3 ? '連続性なし' : '黒ピクセル不足'
    });
  }

  return {
    detected: hasNotch,
    metrics: {
      detected: hasNotch,
      blackRatio,
      consecutiveRows: maxConsecutiveBlack,
      scanArea: `中央${((checkEndX - checkStartX) / width * 100).toFixed(0)}%`,
    }
  };
}

/**
 * ノッチの位置を検出（スマートフォンの向き判定用）
 * @returns ノッチの相対位置（0-1の範囲）またはnull
 */
function detectNotchPosition(maskData: ImageData): { x: number; y: number } | null {
  const { data, width, height } = maskData;

  // 全画面の中心領域50%を放射状スキャン（DEVICE_DETECTION_SPEC.md）
  const scanStartX = Math.floor(width * 0.25);
  const scanEndX = Math.floor(width * 0.75);
  const scanStartY = Math.floor(height * 0.25);
  const scanEndY = Math.floor(height * 0.75);

  let notchCenterX = 0;
  let notchCenterY = 0;
  let blackPixelCount = 0;

  for (let y = scanStartY; y < scanEndY; y++) {
    for (let x = scanStartX; x < scanEndX; x++) {
      const idx = (y * width + x) * 4;
      const luminance = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      // 黒いピクセル（ノッチ）
      if (luminance < 30) {
        notchCenterX += x;
        notchCenterY += y;
        blackPixelCount++;
      }
    }
  }

  if (blackPixelCount === 0) return null;

  // ノッチの重心を計算
  return {
    x: (notchCenterX / blackPixelCount) / width,
    y: (notchCenterY / blackPixelCount) / height
  };
}

/**
 * デバイスの縦方向（矢印方向）を検出
 * DEVICE_DETECTION_SPEC.mdの仕様に基づく判定
 * @param deviceType デバイス種類
 * @param deviceAspectRatio デバイス領域のアスペクト比
 * @param maskData マスクデータ（ノッチ位置検出用）
 * @returns 矢印の方向（'up', 'right', 'diagonal-up', 'diagonal-right'）
 */
export function detectDeviceVerticalDirection(
  deviceType: DeviceType,
  deviceAspectRatio: number,
  maskData?: ImageData
): 'up' | 'right' | 'diagonal-up' | 'diagonal-right' {
  console.log('🧭 Detecting device vertical direction:', {
    deviceType,
    deviceAspectRatio: deviceAspectRatio.toFixed(2)
  });

  switch (deviceType) {
    case 'laptop':
      // DEVICE_DETECTION_SPEC.md: ラップトップは常に上向き（↑）
      return 'up';

    case 'smartphone':
      // DEVICE_DETECTION_SPEC.md: ノッチ位置基準の判定
      if (maskData) {
        const notchPosition = detectNotchPosition(maskData);
        if (notchPosition) {
          // ノッチの位置で向きを判定
          if (notchPosition.y < 0.2) {
            // ノッチが上部 → 縦向き（↑）
            return 'up';
          } else if (notchPosition.x < 0.2) {
            // ノッチが左端 → 横向き（→）
            return 'right';
          } else if (notchPosition.x > 0.8) {
            // ノッチが右端 → 横向き（→）
            return 'right';
          } else {
            // 斜め向き
            const angle = Math.atan2(0.5 - notchPosition.y, notchPosition.x - 0.5) * 180 / Math.PI;
            if (angle >= -22.5 && angle < 22.5) {
              return 'up';
            } else if (angle >= 22.5 && angle < 67.5) {
              return 'diagonal-up';
            } else if (angle >= 67.5 && angle < 112.5) {
              return 'right';
            } else {
              return 'diagonal-right';
            }
          }
        }
      }

      // ノッチが検出できない場合はアスペクト比で判定
      if (deviceAspectRatio < 1.0) {
        // 縦向きの場合：矢印は上向き（↑）
        return 'up';
      } else {
        // 横向きの場合：矢印は横向き（→）
        return 'right';
      }

    case 'tablet':
      // DEVICE_DETECTION_SPEC.md: タブレットは常に上向き（↑）
      // 明確な上下の区別がないため、すべて上向きと定義
      return 'up';

    default:
      return 'up';
  }
}

/**
 * デバイスの向きを決定（改良版）
 * デバイスの縦方向に合わせて画像を適切に配置
 * @param deviceType デバイス種類
 * @param maskData マスクデータ（ノッチ位置検出用）
 * @param rect デバイス領域
 * @param imageNatural ユーザーがアップロードした画像のサイズ
 * @returns 推奨される画像の回転角度
 */
export function determineDeviceOrientation(
  deviceType: DeviceType,
  maskData?: ImageData,
  rect?: ScreenRectPct,
  imageNatural?: { w: number; h: number }
): number {
  // デバイス領域のアスペクト比を計算
  let deviceAspectRatio = 1;
  if (rect) {
    deviceAspectRatio = rect.wPct / rect.hPct;
  }

  // アップロード画像のアスペクト比を計算
  let imageAspectRatio = 1;
  if (imageNatural) {
    imageAspectRatio = imageNatural.w / imageNatural.h;
  }

  // デバイスの縦方向を検出（マスクデータを渡す）
  const verticalDirection = detectDeviceVerticalDirection(deviceType, deviceAspectRatio, maskData);

  console.log('🔄 Orientation detection:', {
    deviceType,
    deviceAspectRatio: deviceAspectRatio.toFixed(2),
    imageAspectRatio: imageNatural ? imageAspectRatio.toFixed(2) : 'N/A',
    verticalDirection
  });

  // 縦方向に基づいて画像の回転を決定
  switch (verticalDirection) {
    case 'up':
      // 矢印が上向き：デバイスは縦向き
      if (deviceAspectRatio < 1.0) {
        // デバイスが縦長
        if (imageNatural && imageAspectRatio > 1.2) {
          // 画像が横長 → 90度回転して縦にする
          console.log('🔄 Rotating landscape image 90° to match vertical device');
          return 90;
        }
      } else {
        // デバイスが横長（ラップトップ等）
        if (imageNatural && imageAspectRatio < 0.8) {
          // 画像が縦長 → 90度回転して横にする
          console.log('🔄 Rotating portrait image 90° to match horizontal device');
          return 90;
        }
      }
      return 0;

    case 'right':
      // 矢印が横向き：デバイスは横向き（横向きスマホ）
      if (imageNatural && imageAspectRatio < 0.8) {
        // 画像が縦長 → 90度回転して横にする
        console.log('🔄 Rotating portrait image 90° to match horizontal smartphone');
        return 90;
      }
      return 0;

    case 'diagonal-up':
    case 'diagonal-right':
      // 矢印が斜め：デバイスは斜め向き
      if (imageNatural && imageAspectRatio < 0.9) {
        // 画像が縦長 → 45度回転
        console.log('🔄 Rotating portrait image for diagonal device');
        return 45;
      }
      return 0;

    default:
      return 0;
  }
}

/**
 * デバイス種類の表示名を取得
 */
export function getDeviceDisplayName(deviceType: DeviceType): string {
  const names: Record<DeviceType, string> = {
    laptop: 'ノートPC',
    smartphone: 'スマートフォン',
    tablet: 'タブレット',
    unknown: '不明なデバイス',
  };
  return names[deviceType] || '不明';
}

/**
 * デバイス種類に基づいた最適なブリード値を取得（改良版）
 */
export function getOptimalBleedForDevice(deviceType: DeviceType): number {
  const bleedValues: Record<DeviceType, number> = {
    laptop: 12,     // ラップトップは大きめのブリード
    smartphone: 5,  // スマホは小さめ
    tablet: 8,      // タブレットは中間
    unknown: 5,     // デフォルトは控えめ
  };
  return bleedValues[deviceType];
}