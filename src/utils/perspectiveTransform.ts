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
 * 微小三角形分割法による透視変換描画
 * @param ctx 描画先のCanvas2Dコンテキスト
 * @param image ソース画像
 * @param srcCorners ソース画像の4隅（通常は画像の矩形）
 * @param dstCorners 描画先の4隅（変形後の形状）
 * @param meshSize メッシュの分割数（大きいほど精密だが重い）
 */
export function drawPerspectiveImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | HTMLCanvasElement,
  srcCorners: [Point, Point, Point, Point],
  dstCorners: [Point, Point, Point, Point],
  meshSize: number = 16
): void {
  // 変換行列を計算（dst → src への逆変換）
  const matrix = computePerspectiveTransform(dstCorners, srcCorners);
  if (!matrix) {
    console.error('Failed to compute perspective transform matrix');
    return;
  }

  // メッシュを作成して三角形ごとに描画
  const segments = meshSize;

  // テキスト明瞭性を保つための設定
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  for (let row = 0; row < segments; row++) {
    for (let col = 0; col < segments; col++) {
      // グリッドの4頂点を計算（変換先座標系）
      const u0 = col / segments;
      const v0 = row / segments;
      const u1 = (col + 1) / segments;
      const v1 = (row + 1) / segments;

      // 双線形補間で変換先の4点を計算
      const dstQuad = [
        bilinearInterpolate(dstCorners, u0, v0), // 左上
        bilinearInterpolate(dstCorners, u1, v0), // 右上
        bilinearInterpolate(dstCorners, u1, v1), // 右下
        bilinearInterpolate(dstCorners, u0, v1), // 左下
      ];

      // 変換元の4点を計算
      const srcQuad = dstQuad.map(p => transformPoint(p, matrix));

      // 2つの三角形に分割して描画
      drawTriangle(
        ctx, image,
        [srcQuad[0], srcQuad[1], srcQuad[2]], // ソース三角形
        [dstQuad[0], dstQuad[1], dstQuad[2]]  // 描画先三角形
      );

      drawTriangle(
        ctx, image,
        [srcQuad[0], srcQuad[2], srcQuad[3]], // ソース三角形
        [dstQuad[0], dstQuad[2], dstQuad[3]]  // 描画先三角形
      );
    }
  }
}

/**
 * 4点での双線形補間
 */
function bilinearInterpolate(
  corners: [Point, Point, Point, Point],
  u: number,
  v: number
): Point {
  const [tl, tr, br, bl] = corners;

  // 上辺と下辺で線形補間
  const top = {
    x: tl.x * (1 - u) + tr.x * u,
    y: tl.y * (1 - u) + tr.y * u
  };
  const bottom = {
    x: bl.x * (1 - u) + br.x * u,
    y: bl.y * (1 - u) + br.y * u
  };

  // 垂直方向で線形補間
  return {
    x: top.x * (1 - v) + bottom.x * v,
    y: top.y * (1 - v) + bottom.y * v
  };
}

/**
 * アフィン変換による三角形描画
 */
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | HTMLCanvasElement,
  src: [Point, Point, Point],
  dst: [Point, Point, Point]
): void {
  // クリッピング領域を設定
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dst[0].x, dst[0].y);
  ctx.lineTo(dst[1].x, dst[1].y);
  ctx.lineTo(dst[2].x, dst[2].y);
  ctx.closePath();
  ctx.clip();

  // アフィン変換行列を計算
  const matrix = computeAffineTransform(src, dst);
  if (matrix) {
    ctx.transform(
      matrix.a, matrix.d,
      matrix.b, matrix.e,
      matrix.c, matrix.f
    );
    ctx.drawImage(image, 0, 0);
  }

  ctx.restore();
}

/**
 * 3点からアフィン変換行列を計算
 */
function computeAffineTransform(
  src: [Point, Point, Point],
  dst: [Point, Point, Point]
): { a: number; b: number; c: number; d: number; e: number; f: number } | null {
  const [s0, s1, s2] = src;
  const [d0, d1, d2] = dst;

  const det = (s0.x - s2.x) * (s1.y - s2.y) - (s1.x - s2.x) * (s0.y - s2.y);
  if (Math.abs(det) < 1e-10) return null;

  const a = ((d0.x - d2.x) * (s1.y - s2.y) - (d1.x - d2.x) * (s0.y - s2.y)) / det;
  const b = ((d1.x - d2.x) * (s0.x - s2.x) - (d0.x - d2.x) * (s1.x - s2.x)) / det;
  const c = d2.x - a * s2.x - b * s2.y;
  const d = ((d0.y - d2.y) * (s1.y - s2.y) - (d1.y - d2.y) * (s0.y - s2.y)) / det;
  const e = ((d1.y - d2.y) * (s0.x - s2.x) - (d0.y - d2.y) * (s1.x - s2.x)) / det;
  const f = d2.y - d * s2.x - e * s2.y;

  return { a, b, c, d, e, f };
}