/**
 * 透視変換（ホモグラフィ変換）のユーティリティ
 * 4点の対応関係から変換行列を計算し、画像を変形させる
 */

export interface Point {
  x: number;
  y: number;
}

export interface Matrix3x3 {
  a: number; b: number; c: number;
  d: number; e: number; f: number;
  g: number; h: number; i: number;
}

/**
 * 4点から3x3のホモグラフィ変換行列を計算
 * @param src 元画像の4隅 [左上, 右上, 右下, 左下]
 * @param dst 変換先の4隅 [左上, 右上, 右下, 左下]
 */
export function computePerspectiveTransform(
  src: [Point, Point, Point, Point],
  dst: [Point, Point, Point, Point]
): Matrix3x3 | null {
  // 8x8の連立方程式を解く
  // 参考: https://math.stackexchange.com/questions/296794/finding-the-transform-matrix-from-4-projected-points

  const srcX = src.map(p => p.x);
  const srcY = src.map(p => p.y);
  const dstX = dst.map(p => p.x);
  const dstY = dst.map(p => p.y);

  // 行列Aを構築（8x8）
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    A.push([
      srcX[i], srcY[i], 1, 0, 0, 0, -dstX[i] * srcX[i], -dstX[i] * srcY[i]
    ]);
    A.push([
      0, 0, 0, srcX[i], srcY[i], 1, -dstY[i] * srcX[i], -dstY[i] * srcY[i]
    ]);
  }

  // ベクトルbを構築（8x1）
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    b.push(dstX[i]);
    b.push(dstY[i]);
  }

  // ガウスの消去法で解く（簡易実装）
  const solution = solveLinearSystem(A, b);
  if (!solution) return null;

  // 3x3行列を構築
  return {
    a: solution[0], b: solution[1], c: solution[2],
    d: solution[3], e: solution[4], f: solution[5],
    g: solution[6], h: solution[7], i: 1
  };
}

/**
 * 簡易的なガウスの消去法による連立方程式ソルバー
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  // 前進消去
  for (let i = 0; i < n; i++) {
    // ピボット選択
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    // 特異行列チェック
    if (Math.abs(augmented[i][i]) < 1e-10) return null;

    // 消去
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }

  // 後退代入
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    x[i] /= augmented[i][i];
  }

  return x;
}

/**
 * ホモグラフィ変換行列を使って点を変換
 */
export function transformPoint(point: Point, matrix: Matrix3x3): Point {
  const { x, y } = point;
  const { a, b, c, d, e, f, g, h, i } = matrix;

  const w = g * x + h * y + i;
  return {
    x: (a * x + b * y + c) / w,
    y: (d * x + e * y + f) / w
  };
}

/**
 * 逆変換行列を計算
 */
export function invertMatrix3x3(m: Matrix3x3): Matrix3x3 | null {
  const det =
    m.a * (m.e * m.i - m.f * m.h) -
    m.b * (m.d * m.i - m.f * m.g) +
    m.c * (m.d * m.h - m.e * m.g);

  if (Math.abs(det) < 1e-10) return null;

  const invDet = 1 / det;

  return {
    a: (m.e * m.i - m.f * m.h) * invDet,
    b: (m.c * m.h - m.b * m.i) * invDet,
    c: (m.b * m.f - m.c * m.e) * invDet,
    d: (m.f * m.g - m.d * m.i) * invDet,
    e: (m.a * m.i - m.c * m.g) * invDet,
    f: (m.c * m.d - m.a * m.f) * invDet,
    g: (m.d * m.h - m.e * m.g) * invDet,
    h: (m.b * m.g - m.a * m.h) * invDet,
    i: (m.a * m.e - m.b * m.d) * invDet
  };
}

/**
 * ピクセル単位の逆変換による高品質透視変換描画
 *
 * 従来の三角形メッシュ分割法ではCanvas 2Dのclip()によるアンチエイリアシングで
 * グリッドパターン（ドット/ノイズ）が発生していた。
 * この実装では出力画像の各ピクセルに対して逆変換を適用し、
 * ソース画像から直接サンプリングすることでアーティファクトを完全に排除する。
 *
 * @param ctx 描画先のCanvas2Dコンテキスト
 * @param image ソース画像
 * @param srcCorners ソース画像の4隅（通常は画像の矩形）[左上, 右上, 右下, 左下]
 * @param dstCorners 描画先の4隅（変形後の形状）[左上, 右上, 右下, 左下]
 * @param _meshSize 互換性のために残すが使用しない
 */
export function drawPerspectiveImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | HTMLCanvasElement,
  srcCorners: [Point, Point, Point, Point],
  dstCorners: [Point, Point, Point, Point],
  _meshSize: number = 16
): void {
  // 変換行列を計算（dst → src への逆変換）
  const matrix = computePerspectiveTransform(dstCorners, srcCorners);
  if (!matrix) {
    console.error('Failed to compute perspective transform matrix');
    return;
  }

  // ソース画像のピクセルデータを取得
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = image.width;
  srcCanvas.height = image.height;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) return;
  srcCtx.drawImage(image, 0, 0);
  const srcImageData = srcCtx.getImageData(0, 0, image.width, image.height);
  const srcPixels = srcImageData.data;
  const srcW = image.width;
  const srcH = image.height;

  // 出力領域のバウンディングボックスを計算
  const minX = Math.floor(Math.min(dstCorners[0].x, dstCorners[1].x, dstCorners[2].x, dstCorners[3].x));
  const maxX = Math.ceil(Math.max(dstCorners[0].x, dstCorners[1].x, dstCorners[2].x, dstCorners[3].x));
  const minY = Math.floor(Math.min(dstCorners[0].y, dstCorners[1].y, dstCorners[2].y, dstCorners[3].y));
  const maxY = Math.ceil(Math.max(dstCorners[0].y, dstCorners[1].y, dstCorners[2].y, dstCorners[3].y));

  // 出力領域のサイズ
  const outW = maxX - minX;
  const outH = maxY - minY;

  if (outW <= 0 || outH <= 0) return;

  // 一時キャンバスを作成（putImageDataの代わりにdrawImageを使用するため）
  // putImageDataは元のキャンバスを完全に置き換えてしまい、
  // 四角形外のピクセルが透過になる問題がある
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = outW;
  tempCanvas.height = outH;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;

  // 出力用ImageDataを作成
  const outImageData = tempCtx.createImageData(outW, outH);
  const outPixels = outImageData.data;

  // 第1パス: 四角形内部を黒で初期化（境界の白い隙間を防止）
  // isPointInQuadの境界判定が厳密すぎて、第2パスで一部のピクセルが
  // 描画されない可能性があるため、先に黒で塗りつぶしておく
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const dstX = minX + x;
      const dstY = minY + y;

      if (isPointInQuad({ x: dstX, y: dstY }, dstCorners)) {
        const outIdx = (y * outW + x) * 4;
        outPixels[outIdx] = 0;     // R
        outPixels[outIdx + 1] = 0; // G
        outPixels[outIdx + 2] = 0; // B
        outPixels[outIdx + 3] = 255; // A (不透明)
      }
    }
  }

  // 第2パス: ユーザー画像を透視変換で描画（黒の上に上書き）
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const dstX = minX + x;
      const dstY = minY + y;

      // ポイントがdstCorners四角形の内部かチェック
      if (!isPointInQuad({ x: dstX, y: dstY }, dstCorners)) {
        // 四角形外は透過のまま（元のキャンバスの内容が保持される）
        continue;
      }

      // 逆変換でソース座標を取得
      const srcPoint = transformPoint({ x: dstX, y: dstY }, matrix);

      // ソース画像の範囲内かチェック
      if (srcPoint.x < 0 || srcPoint.x >= srcW || srcPoint.y < 0 || srcPoint.y >= srcH) {
        // ソース画像の範囲外は既に黒で初期化済みなのでスキップ
        continue;
      }

      // バイリニア補間でソースピクセルをサンプリング
      const color = bilinearSample(srcPixels, srcW, srcH, srcPoint.x, srcPoint.y);

      // 出力ピクセルに書き込み
      const outIdx = (y * outW + x) * 4;
      outPixels[outIdx] = color.r;
      outPixels[outIdx + 1] = color.g;
      outPixels[outIdx + 2] = color.b;
      outPixels[outIdx + 3] = color.a;
    }
  }

  // 一時キャンバスにImageDataを描画
  tempCtx.putImageData(outImageData, 0, 0);

  // 元のキャンバスに合成（drawImageはαブレンディングを行うため、
  // 透過部分は元のキャンバスの内容が保持される）
  ctx.drawImage(tempCanvas, minX, minY);
}

/**
 * 点が四角形（凸多角形）の内部にあるかチェック
 * クロス積の符号で判定
 */
function isPointInQuad(p: Point, quad: [Point, Point, Point, Point]): boolean {
  // 四角形の頂点を順番に取得 [左上, 右上, 右下, 左下]
  const [p0, p1, p2, p3] = quad;

  // 各辺に対してクロス積を計算
  // すべて同じ符号（または0）であれば内部
  const cross0 = crossProduct(p0, p1, p);
  const cross1 = crossProduct(p1, p2, p);
  const cross2 = crossProduct(p2, p3, p);
  const cross3 = crossProduct(p3, p0, p);

  // すべて非負またはすべて非正
  const allPositive = cross0 >= 0 && cross1 >= 0 && cross2 >= 0 && cross3 >= 0;
  const allNegative = cross0 <= 0 && cross1 <= 0 && cross2 <= 0 && cross3 <= 0;

  return allPositive || allNegative;
}

/**
 * クロス積を計算（2次元）
 * (p1 - p0) × (p - p0) の符号で点pが辺p0→p1のどちら側にあるかを判定
 */
function crossProduct(p0: Point, p1: Point, p: Point): number {
  return (p1.x - p0.x) * (p.y - p0.y) - (p1.y - p0.y) * (p.x - p0.x);
}

/**
 * バイリニア補間によるピクセルサンプリング
 * サブピクセル座標から4近傍ピクセルを補間して色を取得
 */
function bilinearSample(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
): { r: number; g: number; b: number; a: number } {
  // 整数部と小数部を分離
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = x - x0;
  const fy = y - y0;

  // 4近傍ピクセルのインデックス
  const idx00 = (y0 * width + x0) * 4;
  const idx10 = (y0 * width + x1) * 4;
  const idx01 = (y1 * width + x0) * 4;
  const idx11 = (y1 * width + x1) * 4;

  // バイリニア補間
  const r = bilerp(pixels[idx00], pixels[idx10], pixels[idx01], pixels[idx11], fx, fy);
  const g = bilerp(pixels[idx00 + 1], pixels[idx10 + 1], pixels[idx01 + 1], pixels[idx11 + 1], fx, fy);
  const b = bilerp(pixels[idx00 + 2], pixels[idx10 + 2], pixels[idx01 + 2], pixels[idx11 + 2], fx, fy);
  const a = bilerp(pixels[idx00 + 3], pixels[idx10 + 3], pixels[idx01 + 3], pixels[idx11 + 3], fx, fy);

  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b),
    a: Math.round(a)
  };
}

/**
 * 2次元バイリニア補間の計算
 */
function bilerp(v00: number, v10: number, v01: number, v11: number, fx: number, fy: number): number {
  const top = v00 * (1 - fx) + v10 * fx;
  const bottom = v01 * (1 - fx) + v11 * fx;
  return top * (1 - fy) + bottom * fy;
}

