/**
 * デバイス検出のデバッグユーティリティ
 * デバイスインデックス管理とデバイスタイプ判定の問題を詳細に分析
 */

export interface DeviceDebugInfo {
  // インデックス関連
  arrayIndex: number;           // 配列内の位置（0, 1, 2）
  deviceIndex: number;          // region.deviceIndex（0, 1, 2）
  displayNumber: number;        // ユーザー表示用番号（1, 2, 3）

  // デバイス検出情報
  deviceType: string;
  detectionMethod: string;
  confidence: number;

  // 視覚的特徴
  hasKeyboard: boolean;
  hasNotch: boolean;
  hasMetalSide: boolean;

  // 形状情報
  aspectRatio: number;
  width: number;
  height: number;
  isElongated: boolean;        // 細長いかどうか（スマートフォン判定用）
  elongationRatio: number;      // 縦横比の極端さ

  // 検出時のコンテキスト
  maskDataInfo?: {
    hasData: boolean;
    analyzedArea: string;       // 'screen-only' | 'extended-area'
    expandedHeight?: number;
  };

  // 問題フラグ
  issues: string[];
  warnings: string[];

  // タイムスタンプ
  timestamp: string;
}

/**
 * デバッグ情報を収集する
 */
export function collectDebugInfo(
  arrayIndex: number,
  deviceIndex: number,
  region: any,
  deviceType: string,
  detectionResult: any
): DeviceDebugInfo {
  const width = region.rect?.wPct || 0;
  const height = region.rect?.hPct || 0;
  const aspectRatio = width > 0 ? width / height : 0;

  // 細長さの判定（スマートフォンの重要な特徴）
  const isElongated = aspectRatio < 0.6 || aspectRatio > 1.7;
  const elongationRatio = aspectRatio < 1 ? 1 / aspectRatio : aspectRatio;

  const issues: string[] = [];
  const warnings: string[] = [];

  // 問題の検出
  if (arrayIndex !== deviceIndex) {
    issues.push(`Index mismatch: arrayIndex(${arrayIndex}) != deviceIndex(${deviceIndex})`);
  }

  if (deviceType === 'smartphone' && !isElongated) {
    issues.push(`Non-elongated device classified as smartphone (ratio: ${aspectRatio.toFixed(2)})`);
  }

  if (deviceType === 'laptop' && !detectionResult?.hasKeyboard) {
    warnings.push('Laptop detected without keyboard detection');
  }

  if (deviceType === 'smartphone' && detectionResult?.hasKeyboard) {
    issues.push('Smartphone detected WITH keyboard (should not happen)');
  }

  return {
    arrayIndex,
    deviceIndex,
    displayNumber: deviceIndex + 1,

    deviceType,
    detectionMethod: detectionResult?.method || 'unknown',
    confidence: detectionResult?.confidence || 0,

    hasKeyboard: detectionResult?.hasKeyboard || false,
    hasNotch: detectionResult?.hasNotch || false,
    hasMetalSide: detectionResult?.hasMetalSide || false,

    aspectRatio,
    width,
    height,
    isElongated,
    elongationRatio,

    maskDataInfo: {
      hasData: !!detectionResult?.maskData,
      analyzedArea: detectionResult?.analyzedArea || 'unknown',
      expandedHeight: detectionResult?.expandedHeight
    },

    issues,
    warnings,

    timestamp: new Date().toISOString()
  };
}

/**
 * デバッグ情報を見やすくフォーマット
 */
export function formatDebugInfo(info: DeviceDebugInfo): string {
  const lines: string[] = [];

  lines.push('╔════════════════════════════════════════╗');
  lines.push(`║  Device Debug Info - ${info.timestamp.split('T')[1].split('.')[0]}  ║`);
  lines.push('╠════════════════════════════════════════╣');

  // インデックス情報
  lines.push('║ 📍 INDEX INFORMATION                   ║');
  lines.push(`║   Array Index:    ${info.arrayIndex} (position in array)    ║`);
  lines.push(`║   Device Index:   ${info.deviceIndex} (region.deviceIndex)  ║`);
  lines.push(`║   Display Number: Device ${info.displayNumber}              ║`);

  // 問題の強調表示
  if (info.arrayIndex !== info.deviceIndex) {
    lines.push('║   ⚠️  INDEX MISMATCH DETECTED!          ║');
  }

  lines.push('╠════════════════════════════════════════╣');

  // デバイスタイプ情報
  lines.push('║ 🔍 DEVICE TYPE DETECTION               ║');
  lines.push(`║   Type: ${info.deviceType.toUpperCase().padEnd(31)}║`);
  lines.push(`║   Confidence: ${info.confidence.toFixed(1)}%                     ║`);
  lines.push(`║   Method: ${info.detectionMethod.padEnd(29)}║`);

  lines.push('╠════════════════════════════════════════╣');

  // 形状分析
  lines.push('║ 📐 SHAPE ANALYSIS                      ║');
  lines.push(`║   Aspect Ratio: ${info.aspectRatio.toFixed(2)}                   ║`);
  lines.push(`║   Dimensions: ${(info.width * 100).toFixed(1)}% x ${(info.height * 100).toFixed(1)}%       ║`);
  lines.push(`║   Is Elongated: ${info.isElongated ? '✓ YES' : '✗ NO'}                  ║`);
  lines.push(`║   Elongation Ratio: ${info.elongationRatio.toFixed(2)}              ║`);

  // スマートフォン判定の詳細
  if (info.deviceType === 'smartphone') {
    lines.push('║                                        ║');
    lines.push('║   📱 SMARTPHONE VALIDATION:            ║');
    if (!info.isElongated) {
      lines.push('║   ❌ NOT ELONGATED (Should not be smartphone)║');
    } else {
      lines.push('║   ✅ Correctly elongated device       ║');
    }
  }

  lines.push('╠════════════════════════════════════════╣');

  // 視覚的特徴
  lines.push('║ 👁️  VISUAL FEATURES                     ║');
  lines.push(`║   Keyboard:  ${info.hasKeyboard ? '✓' : '✗'}                         ║`);
  lines.push(`║   Notch:     ${info.hasNotch ? '✓' : '✗'}                         ║`);
  lines.push(`║   Metal Side: ${info.hasMetalSide ? '✓' : '✗'}                        ║`);

  // 問題と警告
  if (info.issues.length > 0 || info.warnings.length > 0) {
    lines.push('╠════════════════════════════════════════╣');
    lines.push('║ ⚠️  ISSUES & WARNINGS                   ║');

    info.issues.forEach(issue => {
      const wrapped = wrapText(issue, 38);
      wrapped.forEach(line => {
        lines.push(`║ ❌ ${line.padEnd(36)}║`);
      });
    });

    info.warnings.forEach(warning => {
      const wrapped = wrapText(warning, 38);
      wrapped.forEach(line => {
        lines.push(`║ ⚠️  ${line.padEnd(36)}║`);
      });
    });
  }

  lines.push('╚════════════════════════════════════════╝');

  return lines.join('\n');
}

/**
 * テキストを指定幅で折り返す
 */
function wrapText(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > width) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        lines.push(word.substring(0, width));
        currentLine = word.substring(width);
      }
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * スマートフォン判定の詳細分析
 */
export function analyzeSmartphoneDetection(
  aspectRatio: number,
  hasKeyboard: boolean,
  hasNotch: boolean,
  width: number,
  height: number
): {
  isValidSmartphone: boolean;
  reasons: string[];
  confidence: number;
} {
  const reasons: string[] = [];
  let confidence = 50; // 基本信頼度

  // アスペクト比チェック（最重要）
  const isPortraitElongated = aspectRatio < 0.6;  // 縦長
  const isLandscapeElongated = aspectRatio > 1.7; // 横長
  const isElongated = isPortraitElongated || isLandscapeElongated;

  if (!isElongated) {
    reasons.push(`Not elongated (ratio: ${aspectRatio.toFixed(2)})`);
    confidence -= 40;
  } else {
    reasons.push(`Elongated device (ratio: ${aspectRatio.toFixed(2)})`);
    confidence += 30;
  }

  // キーボードチェック（スマートフォンにはキーボードがない）
  if (hasKeyboard) {
    reasons.push('Has keyboard (not smartphone feature)');
    confidence -= 50;
  } else {
    confidence += 10;
  }

  // ノッチチェック（スマートフォンの特徴）
  if (hasNotch) {
    reasons.push('Has notch (smartphone feature)');
    confidence += 20;
  }

  // サイズチェック
  const area = width * height;
  if (area < 0.05) {  // 画面全体の5%未満
    reasons.push('Too small for typical smartphone');
    confidence -= 20;
  }

  const isValidSmartphone = isElongated && !hasKeyboard && confidence > 40;

  return {
    isValidSmartphone,
    reasons,
    confidence: Math.max(0, Math.min(100, confidence))
  };
}

/**
 * デバッグ情報をコンソールに出力
 */
export function logDebugInfo(info: DeviceDebugInfo): void {
  const formatted = formatDebugInfo(info);

  // 問題がある場合は赤色で強調
  if (info.issues.length > 0) {
    console.error(formatted);
  } else if (info.warnings.length > 0) {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }

  // 追加の詳細情報をグループで出力
  console.group(`📊 Device ${info.displayNumber} - Detailed Analysis`);
  console.table({
    'Array Index': info.arrayIndex,
    'Device Index': info.deviceIndex,
    'Display Number': info.displayNumber,
    'Device Type': info.deviceType,
    'Aspect Ratio': info.aspectRatio.toFixed(2),
    'Is Elongated': info.isElongated,
    'Has Keyboard': info.hasKeyboard,
    'Has Notch': info.hasNotch
  });

  if (info.deviceType === 'smartphone') {
    const analysis = analyzeSmartphoneDetection(
      info.aspectRatio,
      info.hasKeyboard,
      info.hasNotch,
      info.width,
      info.height
    );
    console.log('Smartphone Validation:', analysis);
  }

  console.groupEnd();
}