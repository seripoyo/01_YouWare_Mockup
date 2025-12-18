export function containSize(containerW: number, containerH: number, naturalW: number, naturalH: number) {
  const frameAR = naturalW / naturalH;
  const containerAR = containerW / containerH;
  if (frameAR > containerAR) {
    const w = containerW;
    const h = w / frameAR;
    return { w, h, left: (containerW - w) / 2, top: (containerH - h) / 2 };
  } else {
    const h = containerH;
    const w = h * frameAR;
    return { w, h, left: (containerW - w) / 2, top: (containerH - h) / 2 };
  }
}

export function coverSize(targetW: number, targetH: number, imgW: number, imgH: number) {
  const targetAR = targetW / targetH;
  const imgAR = imgW / imgH;
  if (imgAR > targetAR) {
    // image wider, fit height
    const h = targetH;
    const w = h * imgAR;
    const left = (targetW - w) / 2;
    return { w, h, left, top: 0 };
  } else {
    // image taller, fit width
    const w = targetW;
    const h = w / imgAR;
    const top = (targetH - h) / 2;
    return { w, h, left: 0, top };
  }
}

// 白い余白を完全に除去するための改良版cover関数
// bleedPercent: 画像を何％大きくして余白を覆うか（デフォルト5%）
export function coverSizeWithBleed(
  targetW: number,
  targetH: number,
  imgW: number,
  imgH: number,
  bleedPercent: number = 5
) {
  const targetAR = targetW / targetH;
  const imgAR = imgW / imgH;

  // bleedを考慮したスケール計算
  const bleedFactor = 1 + bleedPercent / 100;

  if (imgAR > targetAR) {
    // image wider, fit height with bleed
    const h = targetH * bleedFactor;
    const w = h * imgAR;
    const left = (targetW - w) / 2;
    const top = -(h - targetH) / 2; // 上下にはみ出す分を中央揃え
    return { w, h, left, top };
  } else {
    // image taller, fit width with bleed
    const w = targetW * bleedFactor;
    const h = w / imgAR;
    const left = -(w - targetW) / 2; // 左右にはみ出す分を中央揃え
    const top = (targetH - h) / 2;
    return { w, h, left, top };
  }
}

// デバイスタイプ別に最適なブリード値を返す
export function getOptimalBleedPercent(deviceType: string): number {
  switch (deviceType) {
    case 'laptop':
    case 'desktop':
      // ラップトップは横長なので、より大きなブリードが必要
      // 右側の余白を完全に消すため、12%に増加
      return 12; // 12%のブリード（増加）
    case 'smartphone':
      // スマートフォンは5%で十分
      return 5;
    case 'tablet':
      // タブレットは中間
      return 8; // 少し増加
    default:
      return 5;
  }
}
