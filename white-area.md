# 白エリアと黒ベゼルの検出方法 - 完全ガイド

## 目次

1. [概要と目的](#概要と目的)
2. [検出アルゴリズムの全体構造](#検出アルゴリズムの全体構造)
3. [ステップ1: 画像データの取得と前処理](#ステップ1-画像データの取得と前処理)
4. [ステップ2: 輝度計算と白ピクセルの判定](#ステップ2-輝度計算と白ピクセルの判定)
5. [ステップ3: BFS連結成分抽出](#ステップ3-bfs連結成分抽出)
6. [ステップ4: 黒ベゼル検出](#ステップ4-黒ベゼル検出)
7. [ステップ5: フィルタリングとスコアリング](#ステップ5-フィルタリングとスコアリング)
8. [ステップ6: 最終的なデバイス番号割り当て](#ステップ6-最終的なデバイス番号割り当て)
9. [完全な実装コード](#完全な実装コード)
10. [パラメータ調整ガイド](#パラメータ調整ガイド)
11. [トラブルシューティング](#トラブルシューティング)

---

## 概要と目的

### 解決すべき課題

モックアップ画像から**デバイスの画面領域（白エリア）**を自動検出する際、以下の課題があります：

1. **背景との混在問題**: 背景も明るい色（ベージュ、ピンク等）の場合、単純な輝度閾値では背景も検出されてしまう
2. **複数デバイス識別**: 1枚の画像に複数のデバイスが存在する場合、それぞれを正確に識別する必要がある
3. **ノイズ除去**: 小さな反射や光の当たり方による誤検出を除外する

### 解決アプローチ

**黒ベゼル（デバイスのフレーム）を利用した検出**

- デバイスの画面は必ず**黒いベゼルに囲まれている**という物理的特性を活用
- 白領域の周囲に黒いピクセルが存在するかチェックすることで、背景との区別が可能

---

## 検出アルゴリズムの全体構造

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│ 入力: モックアップ画像（HTMLImageElement）                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ ステップ1: Canvas APIでImageDataを取得                             │
│  └── RGBA配列として全ピクセルのデータを読み込む                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ ステップ2: 輝度計算と白ピクセル判定                                │
│  ├── 各ピクセルの輝度を計算（0.0〜1.0）                            │
│  └── 閾値（デフォルト0.90）以上を白ピクセルとしてマーキング         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ ステップ3: BFS連結成分抽出                                         │
│  ├── 隣接する白ピクセルをグループ化                                │
│  └── 各グループの境界ボックスを計算                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ ステップ4: 黒ベゼル検出（重要！）                                  │
│  ├── 各領域の周囲15pxをサンプリング                                │
│  ├── 暗いピクセル（輝度 < 0.25）の割合を計算                       │
│  └── ベゼルスコア（0〜1）を算出                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ ステップ5: フィルタリングとスコアリング                             │
│  ├── 面積フィルタ: 全体の0.5%未満を除外                           │
│  ├── 矩形度フィルタ: 0.65未満を除外                               │
│  ├── ベゼルスコアフィルタ: 0.4未満を除外                           │
│  └── 総合スコア = ベゼルスコア × 面積比 × 矩形度                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ ステップ6: デバイス番号割り当て                                    │
│  ├── 総合スコア順にソート                                          │
│  ├── 上位3つを選択                                                 │
│  └── デバイス番号（0, 1, 2）と色を割り当て                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 出力: ScreenRegion[] （検出された画面領域の配列）                   │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

---

## ステップ1: 画像データの取得と前処理

### 目的

HTMLImageElementから全ピクセルのRGBA値を取得し、処理可能な形式に変換します。

### 実装

\`\`\`typescript
/**
 * 画像からImageDataを取得
 * @param image - モックアップ画像（HTMLImageElement）
 * @returns ImageData（width, height, dataを含む）
 */
function getImageData(image: HTMLImageElement): ImageData {
  // オフスクリーンCanvasを作成
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Canvas 2Dコンテキストの取得に失敗しました');
  }

  // Canvasサイズを画像サイズに合わせる
  canvas.width = image.width;
  canvas.height = image.height;

  // 画像を描画
  ctx.drawImage(image, 0, 0);

  // ImageDataを取得
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return imageData;
}
\`\`\`

### ImageDataの構造

\`\`\`typescript
interface ImageData {
  width: number;   // 画像の幅（ピクセル）
  height: number;  // 画像の高さ（ピクセル）
  data: Uint8ClampedArray;  // RGBAデータの1次元配列
}

// data配列の構造:
// [R0, G0, B0, A0, R1, G1, B1, A1, R2, G2, B2, A2, ...]
// 各ピクセルは4要素で構成（RGBA）
// インデックス = (y * width + x) * 4
\`\`\`

### ピクセル位置とインデックスの計算

\`\`\`typescript
/**
 * 座標からdata配列のインデックスを計算
 * @param x - X座標（0から width-1）
 * @param y - Y座標（0から height-1）
 * @param width - 画像の幅
 * @returns data配列の開始インデックス
 */
function getPixelIndex(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}

// 使用例:
const idx = getPixelIndex(100, 50, imageData.width);
const r = imageData.data[idx];     // Red
const g = imageData.data[idx + 1]; // Green
const b = imageData.data[idx + 2]; // Blue
const a = imageData.data[idx + 3]; // Alpha
\`\`\`

---

## ステップ2: 輝度計算と白ピクセルの判定

### 目的

各ピクセルの明るさ（輝度）を計算し、白として判定すべきかを決定します。

### 輝度計算の理論

人間の目は**緑に最も敏感**で、青には最も敏感ではありません。そのため、単純な平均ではなく、**加重平均**を使用します。

\`\`\`
輝度（Luminance） = 0.299 × R + 0.587 × G + 0.114 × B
\`\`\`

この係数は**ITU-R BT.601標準**に基づいています。

### 実装

\`\`\`typescript
/**
 * RGBから輝度を計算（0.0〜1.0の範囲）
 * @param r - Red値（0〜255）
 * @param g - Green値（0〜255）
 * @param b - Blue値（0〜255）
 * @returns 輝度（0.0〜1.0）
 */
function getLuminance(r: number, g: number, b: number): number {
  // ITU-R BT.601標準の係数を使用
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * 全ピクセルの白判定を実行
 * @param imageData - 画像データ
 * @param threshold - 白判定の閾値（0.0〜1.0、デフォルト0.90）
 * @returns 白ピクセルのマスク（1 = 白、0 = それ以外）
 */
function createWhitePixelMask(
  imageData: ImageData,
  threshold: number = 0.90
): Uint8Array {
  const { width, height, data } = imageData;
  const totalPixels = width * height;
  const mask = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    // 輝度を計算
    const luminance = getLuminance(r, g, b);

    // 閾値以上を白としてマーク
    mask[i] = luminance >= threshold ? 1 : 0;
  }

  return mask;
}
\`\`\`

### 閾値の選び方

| 閾値 | 効果 | 使用場面 |
|------|------|----------|
| 0.95 | 非常に明るいピクセルのみ | 真っ白な画面のみ検出したい場合 |
| **0.90** | **推奨値** | **ほとんどの白い画面を検出** |
| 0.85 | やや明るいピクセルも含む | グレーっぽい画面も検出したい場合 |
| 0.80 | 広範囲を検出 | 誤検出が増える可能性あり |


### 視覚化（デバッグ用）

\`\`\`typescript
/**
 * 白ピクセルマスクを画像として可視化（デバッグ用）
 */
function visualizeWhiteMask(
  mask: Uint8Array,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);

  for (let i = 0; i < mask.length; i++) {
    const idx = i * 4;
    const value = mask[i] * 255;
    imageData.data[idx] = value;
    imageData.data[idx + 1] = value;
    imageData.data[idx + 2] = value;
    imageData.data[idx + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
\`\`\`

---

## ステップ3: BFS連結成分抽出

### 目的

隣接する白ピクセルをグループ化し、個別の領域として抽出します。

### アルゴリズムの概要

**幅優先探索（BFS: Breadth-First Search）**を使用して、連結した白ピクセルを発見します。

\`\`\`
1. 未訪問の白ピクセルを見つける
2. そのピクセルから開始してBFSを実行
3. 上下左右の隣接ピクセルをチェック
4. 白かつ未訪問なら、キューに追加
5. 全ての連結ピクセルを訪問したら、1つの領域として記録
6. 次の未訪問白ピクセルを探して繰り返す
\`\`\`

### データ構造

\`\`\`typescript
interface Region {
  pixels: number[];  // この領域に属するピクセルのインデックス配列
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}
\`\`\`

### 実装

\`\`\`typescript
/**
 * BFSで連結成分を抽出
 */
function extractConnectedRegions(
  mask: Uint8Array,
  width: number,
  height: number
): Region[] {
  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const regions: Region[] = [];

  // 4方向の移動
  const directions = [
    [-1, 0],  // 上
    [1, 0],   // 下
    [0, -1],  // 左
    [0, 1],   // 右
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

        while (queue.length > 0) {
          const [cx, cy] = queue.shift()!;
          const cIdx = cy * width + cx;

          if (visited[cIdx] === 1) continue;

          visited[cIdx] = 1;
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
\`\`\`

---

## ステップ4: 黒ベゼル検出

### 目的

検出された白領域が本当にデバイスの画面か、背景の一部かを判定します。

### 黒ベゼルとは

- デバイス（スマホ、ノートPC等）の画面周囲には**黒いフレーム（ベゼル）**が存在します
- このベゼルは画面領域を物理的に囲んでいます
- 背景にはこのような黒い囲みは存在しません

### ベゼル検出の戦略

各白領域の**外側15px**をサンプリングし、暗いピクセルの割合を計算します。

### 実装

\`\`\`typescript
/**
 * 黒ベゼルスコアを計算
 */
function calculateBezelScore(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number },
  bezelWidth: number = 15
): number {
  const { width, height, data } = imageData;
  const { x, y, width: w, height: h } = bounds;

  let darkPixelCount = 0;
  let totalPixelCount = 0;
  const DARK_THRESHOLD = 0.25;

  // 上辺のベゼルをチェック
  for (let py = Math.max(0, y - bezelWidth); py < y; py++) {
    for (let px = x; px < x + w; px++) {
      if (px < 0 || px >= width) continue;

      const idx = (py * width + px) * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);

      if (lum < DARK_THRESHOLD) darkPixelCount++;
      totalPixelCount++;
    }
  }

  // 下辺のベゼルをチェック
  for (let py = y + h; py < Math.min(height, y + h + bezelWidth); py++) {
    for (let px = x; px < x + w; px++) {
      if (px < 0 || px >= width) continue;

      const idx = (py * width + px) * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);

      if (lum < DARK_THRESHOLD) darkPixelCount++;
      totalPixelCount++;
    }
  }

  // 左辺のベゼルをチェック
  for (let py = y; py < y + h; py++) {
    for (let px = Math.max(0, x - bezelWidth); px < x; px++) {
      if (py < 0 || py >= height) continue;

      const idx = (py * width + px) * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);

      if (lum < DARK_THRESHOLD) darkPixelCount++;
      totalPixelCount++;
    }
  }

  // 右辺のベゼルをチェック
  for (let py = y; py < y + h; py++) {
    for (let px = x + w; px < Math.min(width, x + w + bezelWidth); px++) {
      if (py < 0 || py >= height) continue;

      const idx = (py * width + px) * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);

      if (lum < DARK_THRESHOLD) darkPixelCount++;
      totalPixelCount++;
    }
  }

  return totalPixelCount > 0 ? darkPixelCount / totalPixelCount : 0;
}
\`\`\`

### 4辺個別チェック（より厳密な検出）

\`\`\`typescript
/**
 * 4辺それぞれのベゼル存在を個別チェック
 */
function checkBezelEdges(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number },
  bezelWidth: number = 15
): { top: number; bottom: number; left: number; right: number } {
  const { width, height, data } = imageData;
  const { x, y, width: w, height: h } = bounds;
  const DARK_THRESHOLD = 0.25;

  const checkEdge = (
    startX: number,
    endX: number,
    startY: number,
    endY: number
  ): number => {
    let darkCount = 0;
    let totalCount = 0;

    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        if (px < 0 || px >= width || py < 0 || py >= height) continue;

        const idx = (py * width + px) * 4;
        const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);

        if (lum < DARK_THRESHOLD) darkCount++;
        totalCount++;
      }
    }

    return totalCount > 0 ? darkCount / totalCount : 0;
  };

  return {
    top: checkEdge(x, x + w, Math.max(0, y - bezelWidth), y),
    bottom: checkEdge(x, x + w, y + h, Math.min(height, y + h + bezelWidth)),
    left: checkEdge(Math.max(0, x - bezelWidth), x, y, y + h),
    right: checkEdge(x + w, Math.min(width, x + w + bezelWidth), y, y + h),
  };
}
\`\`\`


---

## ステップ5: フィルタリングとスコアリング

### 目的

検出された領域から、デバイス画面として妥当なものだけを選別します。

### フィルタ条件

#### 1. 面積フィルタ

小さすぎる領域（ノイズ、反射等）を除外します。

\`\`\`typescript
function filterByArea(
  region: Region,
  totalPixels: number,
  minAreaRatio: number = 0.005
): boolean {
  const areaRatio = region.pixels.length / totalPixels;
  return areaRatio >= minAreaRatio;
}
\`\`\`

#### 2. 矩形度フィルタ

画面領域は矩形に近い形状のはずです。変形した領域を除外します。

\`\`\`typescript
/**
 * 矩形度を計算
 * @returns 矩形度（0.0〜1.0、1.0が完全な矩形）
 */
function calculateRectangularity(region: Region): number {
  const { bounds, pixels } = region;
  const { minX, minY, maxX, maxY } = bounds;

  const boundWidth = maxX - minX + 1;
  const boundHeight = maxY - minY + 1;
  const boundArea = boundWidth * boundHeight;

  // 矩形度 = 実際の面積 / 境界ボックスの面積
  return pixels.length / boundArea;
}
\`\`\`

#### 3. ベゼルスコアフィルタ

ベゼルスコアが低い領域（背景の可能性）を除外します。

\`\`\`typescript
function filterByBezelScore(
  bezelScore: number,
  minBezelScore: number = 0.4
): boolean {
  return bezelScore >= minBezelScore;
}
\`\`\`

### 総合スコアリング

複数の指標を組み合わせて、最も画面らしい領域を選出します。

\`\`\`typescript
/**
 * 総合スコアを計算
 * @returns 総合スコア（値が大きいほど画面らしい）
 */
function calculateOverallScore(
  region: Region,
  bezelScore: number,
  totalPixels: number
): number {
  const areaRatio = region.pixels.length / totalPixels;
  const rectangularity = calculateRectangularity(region);

  // 総合スコア = ベゼルスコア × 面積比 × 矩形度 × 1000
  return bezelScore * areaRatio * rectangularity * 1000;
}
\`\`\`

---

## ステップ6: 最終的なデバイス番号割り当て

### 目的

総合スコアが高い順に、最大3つの領域にデバイス番号を割り当てます。

### デバイス識別色

\`\`\`typescript
// src/constants/deviceColors.ts

export const DEVICE_FILL_COLORS = {
  primary: '#e5c4be',    // 1台目: ピンクベージュ
  secondary: '#accbde',  // 2台目: ライトブルー
  tertiary: '#ffe2c6',   // 3台目: ピーチ
} as const;

export const DEVICE_COLOR_ORDER = [
  DEVICE_FILL_COLORS.primary,
  DEVICE_FILL_COLORS.secondary,
  DEVICE_FILL_COLORS.tertiary,
];
\`\`\`

### 実装

\`\`\`typescript
interface Point {
  x: number;
  y: number;
}

interface ScreenRegion {
  bounds: { x: number; y: number; width: number; height: number };
  corners: [Point, Point, Point, Point];
  centroid: Point;
  area: number;
  rectangularity: number;
  bezelScore: number;
  overallScore: number;
  deviceIndex: 0 | 1 | 2;
  fillColor: string;
  contentImage: HTMLImageElement | null;
}

/**
 * デバイス番号と色を割り当て
 */
function assignDeviceIndices(regions: any[]): ScreenRegion[] {
  // スコア順にソート（降順）
  const sorted = [...regions].sort((a, b) => b.overallScore - a.overallScore);

  // 最大3つを選択
  return sorted.slice(0, 3).map((region, index) => {
    const { bounds } = region;
    const { x, y, width, height } = bounds;

    // 4隅の座標（時計回り: 左上、右上、右下、左下）
    const corners: [Point, Point, Point, Point] = [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];

    // 重心計算
    const centroid = {
      x: x + width / 2,
      y: y + height / 2,
    };

    return {
      ...region,
      corners,
      centroid,
      deviceIndex: index as 0 | 1 | 2,
      fillColor: DEVICE_COLOR_ORDER[index],
      contentImage: null,
    };
  });
}
\`\`\`

---

## 完全な実装コード

### メイン関数

\`\`\`typescript
// src/utils/screenDetection.ts

interface DetectionOptions {
  luminanceThreshold?: number;   // 白判定閾値
  minAreaRatio?: number;         // 最小面積比
  minRectangularity?: number;    // 最小矩形度
  minBezelScore?: number;        // 最小ベゼルスコア
  bezelWidth?: number;           // ベゼルチェック幅
}

/**
 * デバイス画面領域を検出（メイン関数）
 */
export function detectDeviceScreens(
  imageData: ImageData,
  options: DetectionOptions = {}
): ScreenRegion[] {
  const {
    luminanceThreshold = 0.90,
    minAreaRatio = 0.005,
    minRectangularity = 0.65,
    minBezelScore = 0.4,
    bezelWidth = 15,
  } = options;

  const { width, height } = imageData;
  const totalPixels = width * height;

  // ステップ1: 白ピクセルマスクを作成
  const mask = createWhitePixelMask(imageData, luminanceThreshold);

  // ステップ2: BFS連結成分抽出
  const rawRegions = extractConnectedRegions(mask, width, height);

  // ステップ3: フィルタリングとスコアリング
  const screenRegions: any[] = [];

  for (const region of rawRegions) {
    const { bounds, pixels } = region;
    const { minX, minY, maxX, maxY } = bounds;

    // 面積フィルタ
    const areaRatio = pixels.length / totalPixels;
    if (areaRatio < minAreaRatio) continue;

    // 矩形度フィルタ
    const boundWidth = maxX - minX + 1;
    const boundHeight = maxY - minY + 1;
    const boundArea = boundWidth * boundHeight;
    const rectangularity = pixels.length / boundArea;

    if (rectangularity < minRectangularity) continue;

    // ベゼルスコア計算
    const regionBounds = {
      x: minX,
      y: minY,
      width: boundWidth,
      height: boundHeight,
    };

    const bezelScore = calculateBezelScore(imageData, regionBounds, bezelWidth);

    if (bezelScore < minBezelScore) continue;

    // 4辺チェック
    const edges = checkBezelEdges(imageData, regionBounds, bezelWidth);
    const edgesWithBezel = [edges.top, edges.bottom, edges.left, edges.right]
      .filter(score => score > 0.3).length;

    if (edgesWithBezel < 3) continue;

    // 総合スコア計算
    const overallScore = bezelScore * areaRatio * rectangularity * 1000;

    screenRegions.push({
      bounds: regionBounds,
      area: pixels.length,
      rectangularity,
      bezelScore,
      overallScore,
    });
  }

  // ステップ4: デバイス番号割り当て
  return assignDeviceIndices(screenRegions);
}
\`\`\`


---

## パラメータ調整ガイド

### 一般的な問題と解決策

#### 問題1: 画面が検出されない

**原因**: 閾値が高すぎる、または画面が灰色がかっている

**解決策**:
\`\`\`typescript
const regions = detectDeviceScreens(imageData, {
  luminanceThreshold: 0.85,  // デフォルト0.90から下げる
  minBezelScore: 0.3,        // デフォルト0.4から下げる
});
\`\`\`

#### 問題2: 背景が誤検出される

**原因**: ベゼルスコアの閾値が低すぎる

**解決策**:
\`\`\`typescript
const regions = detectDeviceScreens(imageData, {
  minBezelScore: 0.5,  // デフォルト0.4から上げる
  bezelWidth: 20,      // デフォルト15pxから広げる
});
\`\`\`

#### 問題3: 小さな反射が検出される

**原因**: 最小面積比が小さすぎる

**解決策**:
\`\`\`typescript
const regions = detectDeviceScreens(imageData, {
  minAreaRatio: 0.01,  // デフォルト0.005から上げる
});
\`\`\`

#### 問題4: 角丸画面が検出されない

**原因**: 矩形度の閾値が高すぎる

**解決策**:
\`\`\`typescript
const regions = detectDeviceScreens(imageData, {
  minRectangularity: 0.55,  // デフォルト0.65から下げる
});
\`\`\`

### パラメータ早見表

| パラメータ | デフォルト | 推奨範囲 | 効果 |
|-----------|----------|---------|------|
| \`luminanceThreshold\` | 0.90 | 0.80〜0.95 | 低い = より多くの領域を検出 |
| \`minAreaRatio\` | 0.005 | 0.003〜0.02 | 高い = 小さい領域を除外 |
| \`minRectangularity\` | 0.65 | 0.50〜0.80 | 低い = 変形した領域も検出 |
| \`minBezelScore\` | 0.4 | 0.3〜0.6 | 高い = より厳密な検出 |
| \`bezelWidth\` | 15 | 8〜25 | 広い = 太いベゼルも検出 |

---

## トラブルシューティング

### デバッグテクニック

#### 1. 中間結果の可視化

\`\`\`typescript
// 白ピクセルマスクを画像として表示
const maskCanvas = visualizeWhiteMask(mask, width, height);
document.body.appendChild(maskCanvas);

// 検出された領域を矩形で描画
function drawRegionBounds(
  canvas: HTMLCanvasElement,
  regions: ScreenRegion[]
): void {
  const ctx = canvas.getContext('2d')!;

  regions.forEach((region, i) => {
    const { bounds, fillColor } = region;

    ctx.strokeStyle = fillColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    ctx.fillStyle = fillColor;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(
      \`Device \${i + 1}\`,
      bounds.x + 10,
      bounds.y + 30
    );
  });
}
\`\`\`

#### 2. 詳細ログの出力

\`\`\`typescript
// 検出されなかった場合の診断
if (regions.length === 0) {
  console.error('❌ 画面が検出されませんでした');
  console.log('診断情報:');
  console.log('- 画像サイズ:', imageData.width, 'x', imageData.height);
  console.log('推奨: luminanceThresholdを下げてください');
}
\`\`\`

#### 3. パラメータの段階的調整

\`\`\`typescript
// パラメータを段階的に緩めて試す
const parameterSets = [
  // 最も厳密
  { luminanceThreshold: 0.90, minBezelScore: 0.5 },
  // 標準
  { luminanceThreshold: 0.90, minBezelScore: 0.4 },
  // やや緩い
  { luminanceThreshold: 0.85, minBezelScore: 0.4 },
  // 緩い
  { luminanceThreshold: 0.85, minBezelScore: 0.3 },
];

for (const params of parameterSets) {
  const regions = detectDeviceScreens(imageData, params);
  if (regions.length > 0) {
    console.log('✅ 検出成功:', params);
    break;
  }
}
\`\`\`

### よくあるエラーと対処法

#### エラー1: "Canvas 2Dコンテキストの取得に失敗"

**原因**: ブラウザがCanvas APIをサポートしていない

**解決策**:
\`\`\`typescript
const ctx = canvas.getContext('2d', {
  willReadFrequently: true,
  alpha: true,
});

if (!ctx) {
  throw new Error('Canvas APIがサポートされていません');
}
\`\`\`

#### エラー2: メモリ不足（大きな画像）

**原因**: 高解像度画像の処理でメモリが枯渇

**解決策**:
\`\`\`typescript
// 画像を縮小してから処理
function resizeImage(
  img: HTMLImageElement,
  maxSize: number = 2048
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  let width = img.width;
  let height = img.height;

  if (width > maxSize || height > maxSize) {
    const scale = Math.min(maxSize / width, maxSize / height);
    width *= scale;
    height *= scale;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  return canvas;
}
\`\`\`

#### エラー3: BFSが無限ループ

**原因**: visitedフラグが正しく設定されていない

**解決策**:
\`\`\`typescript
// キューに追加する前にチェック
if (mask[nIdx] === 1 && visited[nIdx] === 0) {
  visited[nIdx] = 1; // 即座にマーク
  queue.push([nx, ny]);
}
\`\`\`

---

## まとめ

### 検出アルゴリズムの要点

1. **輝度閾値による白ピクセル判定**
   - ITU-R BT.601標準の加重平均を使用
   - デフォルト閾値: 0.90

2. **BFS連結成分抽出**
   - 4方向接続で隣接ピクセルをグループ化
   - 各グループの境界ボックスを計算

3. **黒ベゼル検出（重要！）**
   - 領域外側15pxをサンプリング
   - 暗いピクセルの割合でスコアリング
   - 背景との区別に不可欠

4. **多段階フィルタリング**
   - 面積フィルタ（最小0.5%）
   - 矩形度フィルタ（最小0.65）
   - ベゼルスコアフィルタ（最小0.4）

5. **総合スコアリングとデバイス番号割り当て**
   - 複数の指標を統合
   - 上位3つを選択
   - デバイス番号と識別色を付与

### 推奨設定

**標準設定**（ほとんどの場合に有効）:
\`\`\`typescript
const regions = detectDeviceScreens(imageData, {
  luminanceThreshold: 0.90,
  minAreaRatio: 0.005,
  minRectangularity: 0.65,
  minBezelScore: 0.4,
  bezelWidth: 15,
});
\`\`\`

**厳密設定**（背景が明るい場合）:
\`\`\`typescript
const regions = detectDeviceScreens(imageData, {
  luminanceThreshold: 0.90,
  minAreaRatio: 0.01,
  minRectangularity: 0.70,
  minBezelScore: 0.5,
  bezelWidth: 20,
});
\`\`\`

**寛容設定**（画面が暗い・角丸の場合）:
\`\`\`typescript
const regions = detectDeviceScreens(imageData, {
  luminanceThreshold: 0.85,
  minAreaRatio: 0.003,
  minRectangularity: 0.55,
  minBezelScore: 0.3,
  bezelWidth: 12,
});
\`\`\`

### 次のステップ

検出された \`ScreenRegion[]\` を使って、以下の処理を実装できます：

1. **インタラクティブドロップゾーン表示**
   - 各領域にユーザー画像をアップロード可能に

2. **透視変換による画像合成**
   - \`corners\` 座標を使って4点透視変換を適用

3. **複数デバイスの個別管理**
   - \`deviceIndex\` と \`fillColor\` で識別

詳細は \`CLAUDE.md\` の「インタラクティブドロップゾーンUI」および「Canvas APIによる透視変換実装」セクションを参照してください。

---

## 実践的なケーススタディ：複数デバイス画像の検出

### 対象画像の特徴

以下のような複数デバイスが配置された画像を例に、検出の流れを説明します：

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│    ┌─────────────────┐                                │
│   ╱                   ╲     ┌──────┐                  │
│  │   ノートPC画面      │    │スマホ│                  │
│  │   (傾いて配置)      │    │ 画面 │                  │
│   ╲                   ╱     └──────┘                  │
│    └─────────────────┘                                │
│         木目調デスク背景                               │
└────────────────────────────────────────────────────────┘
```

### 検出の課題

1. **ノートPC**: 傾いて配置されている（透視変換が必要）
2. **スマートフォン**: 小さいが、明確な黒ベゼルを持つ
3. **背景**: 木目調で比較的暗いため、誤検出のリスクは低い

### 検出フロー

```typescript
// ステップ1: 画像読み込みとImageData取得
const img = new Image();
img.src = 'mockup_laptop_and_phone.png';
await new Promise(resolve => img.onload = resolve);

const canvas = document.createElement('canvas');
canvas.width = img.width;
canvas.height = img.height;
const ctx = canvas.getContext('2d')!;
ctx.drawImage(img, 0, 0);
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

// ステップ2: デバイス画面検出
const regions = detectDeviceScreens(imageData, {
  luminanceThreshold: 0.85,  // やや低めに設定（ピンク画面対応）
  minAreaRatio: 0.003,       // 小さいスマホも検出
  minRectangularity: 0.60,   // 傾きによる変形を許容
  minBezelScore: 0.35,       // ベゼルが部分的でも検出
  bezelWidth: 12,
});

console.log(`検出されたデバイス数: ${regions.length}`);
// 期待出力: 検出されたデバイス数: 2

// ステップ3: 各デバイスの情報を表示
regions.forEach((region, i) => {
  console.log(`デバイス ${i + 1}:`, {
    bounds: region.bounds,
    area: region.area,
    bezelScore: region.bezelScore.toFixed(3),
    fillColor: region.fillColor,
  });
});
```

### 検出結果の塗りつぶし処理

検出された領域を指定色で塗りつぶすには、以下の手順を使用します：

```typescript
/**
 * 検出された画面領域を指定色で塗りつぶす
 */
function fillDetectedScreens(
  ctx: CanvasRenderingContext2D,
  regions: ScreenRegion[],
  colors: string[] = ['#e5c4be', '#accbde', '#ffe2c6']
): void {
  regions.forEach((region, index) => {
    const { bounds, corners } = region;
    const fillColor = colors[index] || colors[0];
    
    ctx.save();
    ctx.fillStyle = fillColor;
    
    // 矩形の場合（傾きなし）
    if (isAxisAligned(corners)) {
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    } 
    // 傾いている場合（4点で描画）
    else {
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.restore();
  });
}

/**
 * 4隅が軸に平行かチェック
 */
function isAxisAligned(corners: [Point, Point, Point, Point]): boolean {
  const tolerance = 5; // ピクセル許容誤差
  return (
    Math.abs(corners[0].y - corners[1].y) < tolerance &&
    Math.abs(corners[2].y - corners[3].y) < tolerance &&
    Math.abs(corners[0].x - corners[3].x) < tolerance &&
    Math.abs(corners[1].x - corners[2].x) < tolerance
  );
}
```

---

## 高度な検出改善策

### 問題1: 傾いたデバイスが検出されない

#### 原因分析

傾いたデバイスの画面は、軸に平行な境界ボックスでは正確にカバーできず、以下の問題が発生します：

1. **矩形度の低下**: 傾いた領域は境界ボックス内の空白が増え、矩形度が下がる
2. **ベゼル検出の失敗**: 水平/垂直方向のサンプリングでは、傾いたベゼルを正しく検出できない

```
問題のある検出（矩形度が低い）:
┌─────────────────────────┐
│      ╱───────────╲      │ ← 境界ボックス
│     ╱             ╲     │
│    │   傾いた画面  │    │ ← 実際の画面領域
│     ╲             ╱     │
│      ╲───────────╱      │
└─────────────────────────┘
  ↑ 空白部分が多く、矩形度が低下
```

#### 解決策1: 回転した境界ボックス（OBB）の使用

```typescript
interface OrientedBoundingBox {
  center: Point;
  width: number;
  height: number;
  angle: number;  // ラジアン
}

/**
 * 領域の最小外接回転矩形を計算
 * @param pixels - 領域に属するピクセルの座標配列
 * @returns 回転した境界ボックス
 */
function calculateOrientedBoundingBox(
  pixels: number[],
  imageWidth: number
): OrientedBoundingBox {
  // ピクセルインデックスを座標に変換
  const points = pixels.map(idx => ({
    x: idx % imageWidth,
    y: Math.floor(idx / imageWidth),
  }));
  
  // 重心を計算
  const centroid = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
  
  // 共分散行列を計算
  let cxx = 0, cyy = 0, cxy = 0;
  for (const p of points) {
    const dx = p.x - centroid.x;
    const dy = p.y - centroid.y;
    cxx += dx * dx;
    cyy += dy * dy;
    cxy += dx * dy;
  }
  
  // 主軸の角度を計算（固有値分解）
  const angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  
  // 回転した座標系での範囲を計算
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  
  let minU = Infinity, maxU = -Infinity;
  let minV = Infinity, maxV = -Infinity;
  
  for (const p of points) {
    const dx = p.x - centroid.x;
    const dy = p.y - centroid.y;
    const u = dx * cos - dy * sin;
    const v = dx * sin + dy * cos;
    
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  
  return {
    center: centroid,
    width: maxU - minU,
    height: maxV - minV,
    angle,
  };
}

/**
 * OBBを使った矩形度計算
 */
function calculateOrientedRectangularity(
  pixelCount: number,
  obb: OrientedBoundingBox
): number {
  const obbArea = obb.width * obb.height;
  return obbArea > 0 ? pixelCount / obbArea : 0;
}
```

#### 解決策2: 傾いたベゼル検出

```typescript
/**
 * 傾いた領域の周囲をサンプリングしてベゼルスコアを計算
 */
function calculateOrientedBezelScore(
  imageData: ImageData,
  obb: OrientedBoundingBox,
  bezelWidth: number = 15
): number {
  const { width, height, data } = imageData;
  const { center, width: obbW, height: obbH, angle } = obb;
  
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  
  let darkPixelCount = 0;
  let totalPixelCount = 0;
  const DARK_THRESHOLD = 0.25;
  
  // OBBの4辺に沿ってサンプリング
  const halfW = obbW / 2;
  const halfH = obbH / 2;
  
  // サンプリング点の生成（各辺の外側bezelWidth分）
  const samplePoints: Point[] = [];
  
  // 上辺と下辺
  for (let u = -halfW; u <= halfW; u += 3) {
    // 上辺の外側
    for (let v = -halfH - bezelWidth; v < -halfH; v += 3) {
      const x = center.x + u * cos - v * sin;
      const y = center.y + u * sin + v * cos;
      samplePoints.push({ x, y });
    }
    // 下辺の外側
    for (let v = halfH; v < halfH + bezelWidth; v += 3) {
      const x = center.x + u * cos - v * sin;
      const y = center.y + u * sin + v * cos;
      samplePoints.push({ x, y });
    }
  }
  
  // 左辺と右辺
  for (let v = -halfH; v <= halfH; v += 3) {
    // 左辺の外側
    for (let u = -halfW - bezelWidth; u < -halfW; u += 3) {
      const x = center.x + u * cos - v * sin;
      const y = center.y + u * sin + v * cos;
      samplePoints.push({ x, y });
    }
    // 右辺の外側
    for (let u = halfW; u < halfW + bezelWidth; u += 3) {
      const x = center.x + u * cos - v * sin;
      const y = center.y + u * sin + v * cos;
      samplePoints.push({ x, y });
    }
  }
  
  // 各サンプリング点の輝度をチェック
  for (const p of samplePoints) {
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    
    if (px < 0 || px >= width || py < 0 || py >= height) continue;
    
    const idx = (py * width + px) * 4;
    const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
    
    if (lum < DARK_THRESHOLD) darkPixelCount++;
    totalPixelCount++;
  }
  
  return totalPixelCount > 0 ? darkPixelCount / totalPixelCount : 0;
}
```

#### 解決策3: 傾き検出対応の統合関数

```typescript
/**
 * 傾いたデバイスも検出できる改良版検出関数
 */
export function detectDeviceScreensAdvanced(
  imageData: ImageData,
  options: DetectionOptions & { enableOrientedDetection?: boolean } = {}
): ScreenRegion[] {
  const {
    luminanceThreshold = 0.88,
    minAreaRatio = 0.003,
    minRectangularity = 0.55,  // 傾き許容のため低めに
    minBezelScore = 0.35,
    bezelWidth = 12,
    enableOrientedDetection = true,
  } = options;
  
  const { width, height } = imageData;
  const totalPixels = width * height;
  
  // 基本的な検出処理
  const mask = createWhitePixelMask(imageData, luminanceThreshold);
  const rawRegions = extractConnectedRegions(mask, width, height);
  
  const screenRegions: any[] = [];
  
  for (const region of rawRegions) {
    const { bounds, pixels } = region;
    
    // 面積フィルタ
    const areaRatio = pixels.length / totalPixels;
    if (areaRatio < minAreaRatio) continue;
    
    let rectangularity: number;
    let bezelScore: number;
    let finalCorners: [Point, Point, Point, Point];
    
    if (enableOrientedDetection) {
      // OBBを使った傾き対応検出
      const obb = calculateOrientedBoundingBox(pixels, width);
      rectangularity = calculateOrientedRectangularity(pixels.length, obb);
      bezelScore = calculateOrientedBezelScore(imageData, obb, bezelWidth);
      
      // OBBの4隅を計算
      const cos = Math.cos(obb.angle);
      const sin = Math.sin(obb.angle);
      const halfW = obb.width / 2;
      const halfH = obb.height / 2;
      
      finalCorners = [
        {
          x: obb.center.x + (-halfW) * cos - (-halfH) * sin,
          y: obb.center.y + (-halfW) * sin + (-halfH) * cos,
        },
        {
          x: obb.center.x + halfW * cos - (-halfH) * sin,
          y: obb.center.y + halfW * sin + (-halfH) * cos,
        },
        {
          x: obb.center.x + halfW * cos - halfH * sin,
          y: obb.center.y + halfW * sin + halfH * cos,
        },
        {
          x: obb.center.x + (-halfW) * cos - halfH * sin,
          y: obb.center.y + (-halfW) * sin + halfH * cos,
        },
      ];
    } else {
      // 従来の軸平行検出
      const { minX, minY, maxX, maxY } = bounds;
      const boundWidth = maxX - minX + 1;
      const boundHeight = maxY - minY + 1;
      rectangularity = pixels.length / (boundWidth * boundHeight);
      
      const regionBounds = { x: minX, y: minY, width: boundWidth, height: boundHeight };
      bezelScore = calculateBezelScore(imageData, regionBounds, bezelWidth);
      
      finalCorners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
    }
    
    if (rectangularity < minRectangularity) continue;
    if (bezelScore < minBezelScore) continue;
    
    const overallScore = bezelScore * areaRatio * rectangularity * 1000;
    
    screenRegions.push({
      bounds: region.bounds,
      corners: finalCorners,
      area: pixels.length,
      rectangularity,
      bezelScore,
      overallScore,
    });
  }
  
  return assignDeviceIndices(screenRegions);
}
```


---

### 問題2: 画像端のデバイスが検出されない（エッジ問題）

#### 原因分析

デバイスが画像の端に配置されている場合、以下の問題が発生します：

1. **ベゼルサンプリング範囲不足**: 画像外の領域はサンプリングできない
2. **4辺チェックでの除外**: 「少なくとも3辺にベゼルが必要」という条件で除外される
3. **領域の切断**: デバイスの一部が画像外に出ている場合、矩形度が低下

```
画像端の問題：
┌─────────────────────────────┐
│                             │
│         画面領域            │
│                             │
│─────────────────────────────│ ← 画像の端
      ↑ 下側のベゼルがサンプリングできない
```

#### 解決策1: エッジ対応のベゼルスコア計算

```typescript
/**
 * 画像端を考慮したベゼルスコア計算
 */
function calculateBezelScoreWithEdgeAwareness(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number },
  bezelWidth: number = 15
): { score: number; validEdges: number; edgeDetails: EdgeDetails } {
  const { width: imgWidth, height: imgHeight, data } = imageData;
  const { x, y, width: w, height: h } = bounds;
  const DARK_THRESHOLD = 0.25;
  
  interface EdgeResult {
    score: number;
    isAtImageEdge: boolean;
    sampleCount: number;
  }
  
  const checkEdge = (
    startX: number, endX: number,
    startY: number, endY: number,
    edgeName: 'top' | 'bottom' | 'left' | 'right'
  ): EdgeResult => {
    let darkCount = 0;
    let totalCount = 0;
    let isAtImageEdge = false;
    
    // 画像端かどうかをチェック
    switch (edgeName) {
      case 'top':
        isAtImageEdge = y <= bezelWidth;
        break;
      case 'bottom':
        isAtImageEdge = y + h >= imgHeight - bezelWidth;
        break;
      case 'left':
        isAtImageEdge = x <= bezelWidth;
        break;
      case 'right':
        isAtImageEdge = x + w >= imgWidth - bezelWidth;
        break;
    }
    
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        if (px < 0 || px >= imgWidth || py < 0 || py >= imgHeight) continue;
        
        const idx = (py * imgWidth + px) * 4;
        const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
        
        if (lum < DARK_THRESHOLD) darkCount++;
        totalCount++;
      }
    }
    
    return {
      score: totalCount > 0 ? darkCount / totalCount : 0,
      isAtImageEdge,
      sampleCount: totalCount,
    };
  };
  
  const edges = {
    top: checkEdge(x, x + w, Math.max(0, y - bezelWidth), y, 'top'),
    bottom: checkEdge(x, x + w, y + h, Math.min(imgHeight, y + h + bezelWidth), 'bottom'),
    left: checkEdge(Math.max(0, x - bezelWidth), x, y, y + h, 'left'),
    right: checkEdge(x + w, Math.min(imgWidth, x + w + bezelWidth), y, y + h, 'right'),
  };
  
  // 有効なエッジ（画像端でないエッジ）のみでスコア計算
  let totalScore = 0;
  let validEdgeCount = 0;
  
  for (const [name, edge] of Object.entries(edges)) {
    if (!edge.isAtImageEdge && edge.sampleCount > 10) {
      totalScore += edge.score;
      validEdgeCount++;
    }
  }
  
  // 画像端にあるエッジは「存在する」として扱う
  const edgeAtBoundaryCount = Object.values(edges)
    .filter(e => e.isAtImageEdge).length;
  
  return {
    score: validEdgeCount > 0 ? totalScore / validEdgeCount : 0,
    validEdges: validEdgeCount + edgeAtBoundaryCount, // 画像端も有効としてカウント
    edgeDetails: {
      top: edges.top,
      bottom: edges.bottom,
      left: edges.left,
      right: edges.right,
    },
  };
}

interface EdgeDetails {
  top: { score: number; isAtImageEdge: boolean; sampleCount: number };
  bottom: { score: number; isAtImageEdge: boolean; sampleCount: number };
  left: { score: number; isAtImageEdge: boolean; sampleCount: number };
  right: { score: number; isAtImageEdge: boolean; sampleCount: number };
}
```

#### 解決策2: エッジ対応のフィルタリング条件

```typescript
/**
 * 画像端を考慮したフィルタリング
 */
function shouldIncludeRegion(
  bezelResult: { score: number; validEdges: number; edgeDetails: EdgeDetails },
  rectangularity: number,
  areaRatio: number,
  options: {
    minBezelScore: number;
    minValidEdges: number;
    minRectangularity: number;
    minAreaRatio: number;
  }
): boolean {
  const { score, validEdges, edgeDetails } = bezelResult;
  
  // 画像端にあるデバイスの場合、条件を緩和
  const atImageEdgeCount = Object.values(edgeDetails)
    .filter(e => e.isAtImageEdge).length;
  
  // 2辺以上が画像端にある場合は、検証可能なエッジのみで判断
  if (atImageEdgeCount >= 2) {
    // 検証可能なエッジが1つでも高スコアなら採用
    const verifiableEdges = Object.values(edgeDetails)
      .filter(e => !e.isAtImageEdge && e.sampleCount > 10);
    
    if (verifiableEdges.length > 0) {
      const avgVerifiableScore = verifiableEdges
        .reduce((sum, e) => sum + e.score, 0) / verifiableEdges.length;
      
      // 検証可能なエッジのスコアが高ければ採用
      if (avgVerifiableScore >= options.minBezelScore * 1.2) {
        return areaRatio >= options.minAreaRatio * 0.8 && 
               rectangularity >= options.minRectangularity * 0.8;
      }
    }
    
    // 面積と矩形度が十分高ければ、ベゼルスコアを緩和して採用
    if (areaRatio >= options.minAreaRatio * 1.5 && 
        rectangularity >= options.minRectangularity * 1.1) {
      return score >= options.minBezelScore * 0.5;
    }
  }
  
  // 通常のフィルタリング
  return (
    score >= options.minBezelScore &&
    validEdges >= options.minValidEdges &&
    rectangularity >= options.minRectangularity &&
    areaRatio >= options.minAreaRatio
  );
}
```

#### 解決策3: パディング追加による検出改善

```typescript
/**
 * 画像にパディングを追加して端のデバイスを検出しやすくする
 */
function addImagePadding(
  imageData: ImageData,
  paddingSize: number = 50,
  paddingColor: { r: number; g: number; b: number } = { r: 128, g: 128, b: 128 }
): { paddedImageData: ImageData; offset: { x: number; y: number } } {
  const { width, height, data } = imageData;
  
  const newWidth = width + paddingSize * 2;
  const newHeight = height + paddingSize * 2;
  
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d')!;
  
  // パディング色で塗りつぶし
  ctx.fillStyle = `rgb(${paddingColor.r}, ${paddingColor.g}, ${paddingColor.b})`;
  ctx.fillRect(0, 0, newWidth, newHeight);
  
  // 元画像を中央に配置
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  const tempImageData = tempCtx.createImageData(width, height);
  tempImageData.data.set(data);
  tempCtx.putImageData(tempImageData, 0, 0);
  
  ctx.drawImage(tempCanvas, paddingSize, paddingSize);
  
  return {
    paddedImageData: ctx.getImageData(0, 0, newWidth, newHeight),
    offset: { x: paddingSize, y: paddingSize },
  };
}

/**
 * パディング付きで検出し、座標を元に戻す
 */
function detectWithPadding(
  imageData: ImageData,
  options: DetectionOptions = {}
): ScreenRegion[] {
  const paddingSize = 50;
  const { paddedImageData, offset } = addImagePadding(imageData, paddingSize);
  
  // パディング付き画像で検出
  const regions = detectDeviceScreens(paddedImageData, options);
  
  // 座標をオフセット分戻す
  return regions.map(region => ({
    ...region,
    bounds: {
      x: region.bounds.x - offset.x,
      y: region.bounds.y - offset.y,
      width: region.bounds.width,
      height: region.bounds.height,
    },
    corners: region.corners.map(c => ({
      x: c.x - offset.x,
      y: c.y - offset.y,
    })) as [Point, Point, Point, Point],
    centroid: {
      x: region.centroid.x - offset.x,
      y: region.centroid.y - offset.y,
    },
  }));
}
```


---

### 問題3: 小さなデバイス（スマートフォン等）が面積フィルタで除外される

#### 実際のログ分析

以下のログでは、スマートフォン領域が面積フィルタで除外されています：

```
候補領域:
  [0] 1884x1288 at (737,465) - 2213525px (13.403%) ← ノートPC（検出成功）
  [1] 76x195 at (4529,1071) - 803px (0.005%)      ← スマホ（除外される）

フィルタ除外理由:
  [1] AREA_TOO_SMALL - 面積比:0.005%

設定:
  最小面積比: 0.005 (0.5%)
```

#### 原因分析

1. **高解像度画像の問題**: 5376x3072 = 16,515,072ピクセル
2. **スマホの面積**: 76×195 ≒ 14,820ピクセル
3. **面積比**: 14,820 / 16,515,072 ≒ 0.00089 (0.009%)
4. **閾値**: 0.005 (0.5%) → **約55倍の差**で除外

#### 解決策1: 絶対ピクセル数による最小面積フィルタ

```typescript
interface AreaFilterOptions {
  // 相対的な最小面積比（画像全体に対する割合）
  minAreaRatio: number;
  // 絶対的な最小面積（ピクセル数）
  minAbsoluteArea: number;
  // どちらかの条件を満たせばOK
  useOrLogic: boolean;
}

/**
 * 面積フィルタ（絶対値と相対値の両方をサポート）
 */
function filterByAreaAdvanced(
  pixelCount: number,
  totalPixels: number,
  options: AreaFilterOptions = {
    minAreaRatio: 0.005,      // 0.5%
    minAbsoluteArea: 5000,    // 5000ピクセル（約70x70相当）
    useOrLogic: true,         // どちらかを満たせばOK
  }
): boolean {
  const { minAreaRatio, minAbsoluteArea, useOrLogic } = options;
  
  const meetsRatioRequirement = (pixelCount / totalPixels) >= minAreaRatio;
  const meetsAbsoluteRequirement = pixelCount >= minAbsoluteArea;
  
  if (useOrLogic) {
    // どちらかの条件を満たせばOK
    return meetsRatioRequirement || meetsAbsoluteRequirement;
  } else {
    // 両方の条件を満たす必要がある
    return meetsRatioRequirement && meetsAbsoluteRequirement;
  }
}

// 使用例
const shouldInclude = filterByAreaAdvanced(803, 16515072, {
  minAreaRatio: 0.005,
  minAbsoluteArea: 500,  // 500ピクセル以上あればOK
  useOrLogic: true,
});
// 結果: true（803 >= 500 なので採用）
```

#### 解決策2: 画像解像度に応じた動的閾値

```typescript
/**
 * 画像解像度に応じて最小面積比を動的に調整
 */
function calculateDynamicMinAreaRatio(
  imageWidth: number,
  imageHeight: number,
  baseMinAreaRatio: number = 0.005,
  referenceResolution: number = 1920 * 1080  // 基準解像度
): number {
  const currentResolution = imageWidth * imageHeight;
  
  // 高解像度画像では閾値を下げる
  if (currentResolution > referenceResolution) {
    const scaleFactor = referenceResolution / currentResolution;
    // 最小でも元の1/10まで下げる
    return Math.max(baseMinAreaRatio * scaleFactor, baseMinAreaRatio * 0.1);
  }
  
  return baseMinAreaRatio;
}

// 使用例
const imageWidth = 5376;
const imageHeight = 3072;
const dynamicMinAreaRatio = calculateDynamicMinAreaRatio(
  imageWidth, 
  imageHeight, 
  0.005
);
// 結果: 約 0.000625 (基準解像度との比率で調整)
```

#### 解決策3: デバイスタイプ別の面積閾値

```typescript
interface DeviceTypeThreshold {
  name: string;
  minAbsoluteArea: number;  // 最小絶対面積
  aspectRatioRange: {       // アスペクト比の範囲
    min: number;
    max: number;
  };
}

const DEVICE_TYPE_THRESHOLDS: DeviceTypeThreshold[] = [
  {
    name: 'smartphone_portrait',  // 縦向きスマホ
    minAbsoluteArea: 300,
    aspectRatioRange: { min: 1.5, max: 2.5 },  // 縦長
  },
  {
    name: 'smartphone_landscape', // 横向きスマホ
    minAbsoluteArea: 300,
    aspectRatioRange: { min: 0.4, max: 0.67 }, // 横長
  },
  {
    name: 'tablet',               // タブレット
    minAbsoluteArea: 1000,
    aspectRatioRange: { min: 0.7, max: 1.5 },
  },
  {
    name: 'laptop',               // ノートPC
    minAbsoluteArea: 5000,
    aspectRatioRange: { min: 0.5, max: 0.8 },
  },
];

/**
 * デバイスタイプを推定して適切な面積閾値を適用
 */
function inferDeviceTypeAndFilter(
  bounds: { width: number; height: number },
  pixelCount: number
): { isValid: boolean; inferredType: string | null } {
  const aspectRatio = bounds.height / bounds.width;
  
  for (const threshold of DEVICE_TYPE_THRESHOLDS) {
    const { min, max } = threshold.aspectRatioRange;
    
    if (aspectRatio >= min && aspectRatio <= max) {
      if (pixelCount >= threshold.minAbsoluteArea) {
        return { isValid: true, inferredType: threshold.name };
      }
    }
  }
  
  // どのタイプにも該当しない場合
  return { isValid: false, inferredType: null };
}

// 使用例: スマホ領域（76x195）の判定
const result = inferDeviceTypeAndFilter(
  { width: 76, height: 195 },
  803
);
// アスペクト比: 195/76 ≒ 2.57 → smartphone_portrait に近い
// 803 >= 300 なので isValid: true
```

#### 解決策4: 推奨パラメータ設定

```typescript
/**
 * 高解像度画像向けの推奨検出パラメータ
 */
export function getRecommendedOptionsForHighRes(
  imageWidth: number,
  imageHeight: number
): DetectionOptions {
  const totalPixels = imageWidth * imageHeight;
  const isHighRes = totalPixels > 4000000; // 4MP以上を高解像度とみなす
  
  if (isHighRes) {
    return {
      luminanceThreshold: 0.88,
      // 高解像度では相対面積比を大幅に下げる
      minAreaRatio: 0.0005,  // 0.05% (デフォルトの1/10)
      minRectangularity: 0.60,
      minBezelScore: 0.35,
      bezelWidth: Math.max(8, Math.floor(Math.min(imageWidth, imageHeight) * 0.005)),
      // 追加オプション
      minAbsoluteArea: 500,  // 500ピクセル以上
    };
  }
  
  // 標準解像度
  return {
    luminanceThreshold: 0.90,
    minAreaRatio: 0.005,
    minRectangularity: 0.65,
    minBezelScore: 0.4,
    bezelWidth: 15,
    minAbsoluteArea: 1000,
  };
}
```

---

### 問題4: 片側配置のデバイス（ベゼルが1-2辺しかない）

#### 原因分析

デバイスが机やテーブルの上に置かれている場合、底面のベゼルが見えないことがあります：

```
片側のベゼルが見えないケース：
┌─────────────────┐  ← 上側ベゼル（見える）
│                 │
│   画面領域       │  ← 左右ベゼル（見える）
│                 │
└─────────────────┘
        ↓
    机の表面（ベゼルが机に隠れている）
```

このとき、「少なくとも3辺にベゼルが必要」という条件で除外されてしまいます。

#### 解決策1: ベゼル辺数の要件を緩和

```typescript
/**
 * ベゼル検出の改良版（片側配置対応）
 */
interface BezelValidationResult {
  isValid: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

function validateBezelEdgesFlexible(
  edges: { top: number; bottom: number; left: number; right: number },
  options: {
    strongBezelThreshold: number;   // 強いベゼル判定閾値
    weakBezelThreshold: number;     // 弱いベゼル判定閾値
    minStrongEdges: number;         // 最小強ベゼル辺数
    minTotalEdges: number;          // 最小合計辺数
  } = {
    strongBezelThreshold: 0.5,
    weakBezelThreshold: 0.25,
    minStrongEdges: 1,
    minTotalEdges: 2,
  }
): BezelValidationResult {
  const { strongBezelThreshold, weakBezelThreshold, minStrongEdges, minTotalEdges } = options;
  
  const edgeScores = [edges.top, edges.bottom, edges.left, edges.right];
  
  // 強いベゼル（高スコア）の辺数
  const strongEdges = edgeScores.filter(s => s >= strongBezelThreshold).length;
  
  // 弱いベゼル（低〜中スコア）の辺数
  const weakEdges = edgeScores.filter(s => s >= weakBezelThreshold && s < strongBezelThreshold).length;
  
  // 合計
  const totalValidEdges = strongEdges + weakEdges;
  
  // 判定ロジック
  if (strongEdges >= 2 && totalValidEdges >= 3) {
    return { isValid: true, confidence: 'high', reason: '複数の強いベゼルを検出' };
  }
  
  if (strongEdges >= minStrongEdges && totalValidEdges >= minTotalEdges) {
    return { isValid: true, confidence: 'medium', reason: '必要最小限のベゼルを検出' };
  }
  
  // 対向する辺にベゼルがあれば許容（上下または左右）
  if ((edges.top >= strongBezelThreshold && edges.bottom >= weakBezelThreshold) ||
      (edges.bottom >= strongBezelThreshold && edges.top >= weakBezelThreshold)) {
    return { isValid: true, confidence: 'medium', reason: '上下にベゼルを検出' };
  }
  
  if ((edges.left >= strongBezelThreshold && edges.right >= weakBezelThreshold) ||
      (edges.right >= strongBezelThreshold && edges.left >= weakBezelThreshold)) {
    return { isValid: true, confidence: 'medium', reason: '左右にベゼルを検出' };
  }
  
  // 1辺でも非常に強いベゼルがあれば、他の条件と組み合わせて判断
  if (Math.max(...edgeScores) >= 0.8 && totalValidEdges >= 1) {
    return { isValid: true, confidence: 'low', reason: '1辺に非常に強いベゼルを検出' };
  }
  
  return { isValid: false, confidence: 'low', reason: 'ベゼル検出不足' };
}
```

#### 解決策2: 領域の形状から補完判定

```typescript
/**
 * 形状特徴からデバイス画面らしさを判定
 */
function evaluateScreenLikelihood(
  bounds: { width: number; height: number },
  rectangularity: number,
  bezelScore: number
): number {
  let score = 0;
  
  // アスペクト比がデバイスらしいか
  const aspectRatio = bounds.width / bounds.height;
  const commonAspectRatios = [
    16/9,   // 16:9（一般的なPC画面）
    4/3,    // 4:3（タブレット）
    3/2,    // 3:2（Surface等）
    19.5/9, // スマホ（縦）の逆数
    9/19.5, // スマホ（縦）
    9/16,   // 9:16
  ];
  
  const closestRatio = commonAspectRatios.reduce((prev, curr) =>
    Math.abs(curr - aspectRatio) < Math.abs(prev - aspectRatio) ? curr : prev
  );
  
  const aspectRatioMatch = 1 - Math.abs(aspectRatio - closestRatio) / closestRatio;
  score += aspectRatioMatch * 30;  // 最大30点
  
  // 矩形度
  score += rectangularity * 40;  // 最大40点
  
  // ベゼルスコア
  score += bezelScore * 30;  // 最大30点
  
  return score;
}

/**
 * ベゼルが弱くても、形状が十分デバイスらしければ採用
 */
function shouldIncludeWithShapeFallback(
  bounds: { width: number; height: number },
  rectangularity: number,
  bezelScore: number,
  bezelValidation: BezelValidationResult,
  minLikelihoodScore: number = 60
): boolean {
  // ベゼル検証が通れば採用
  if (bezelValidation.isValid) {
    return true;
  }
  
  // 形状からの補完判定
  const likelihood = evaluateScreenLikelihood(bounds, rectangularity, bezelScore);
  
  // 形状スコアが高ければ、ベゼル検証が失敗しても採用
  return likelihood >= minLikelihoodScore;
}
```


---

### 問題5: 黒ベゼル辺判定が難しいケース

#### ケース5-1: ベゼルの色が真っ黒でない（グレー、ダークブルーなど）

##### 原因分析

デバイスによってはベゼルが純粋な黒ではなく、濃いグレーやダークブルーの場合があります：

```
輝度の問題：
  真っ黒ベゼル: 輝度 ≒ 0.05 → 検出成功
  ダークグレー: 輝度 ≒ 0.15 → 検出成功
  グレー:      輝度 ≒ 0.30 → 閾値(0.25)を超えて検出失敗
```

##### 解決策1: 動的な暗さ閾値の調整

```typescript
/**
 * ベゼル周辺の平均輝度を計算し、動的に閾値を調整
 */
function calculateAdaptiveDarkThreshold(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number },
  bezelWidth: number = 15
): number {
  const { width, height, data } = imageData;
  const { x, y, width: w, height: h } = bounds;
  
  // ベゼル領域のピクセルを収集
  const bezelPixelLuminances: number[] = [];
  
  // 4辺のベゼル領域をサンプリング
  const sampleRegions = [
    // 上辺
    { startX: x, endX: x + w, startY: Math.max(0, y - bezelWidth), endY: y },
    // 下辺
    { startX: x, endX: x + w, startY: y + h, endY: Math.min(height, y + h + bezelWidth) },
    // 左辺
    { startX: Math.max(0, x - bezelWidth), endX: x, startY: y, endY: y + h },
    // 右辺
    { startX: x + w, endX: Math.min(width, x + w + bezelWidth), startY: y, endY: y + h },
  ];
  
  for (const region of sampleRegions) {
    for (let py = region.startY; py < region.endY; py++) {
      for (let px = region.startX; px < region.endX; px++) {
        const idx = (py * width + px) * 4;
        const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
        bezelPixelLuminances.push(lum);
      }
    }
  }
  
  if (bezelPixelLuminances.length === 0) return 0.25; // デフォルト
  
  // 輝度のヒストグラムを作成
  const sorted = [...bezelPixelLuminances].sort((a, b) => a - b);
  
  // 下位25%の平均（暗いピクセルの代表値）
  const lowerQuartileEnd = Math.floor(sorted.length * 0.25);
  const darkPixelAvg = sorted
    .slice(0, lowerQuartileEnd)
    .reduce((sum, v) => sum + v, 0) / lowerQuartileEnd;
  
  // 動的閾値: 暗いピクセルの平均 + マージン
  const margin = 0.15;
  return Math.min(darkPixelAvg + margin, 0.40); // 最大0.40に制限
}

/**
 * 適応的ベゼルスコア計算
 */
function calculateBezelScoreAdaptive(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number },
  bezelWidth: number = 15
): { score: number; adaptedThreshold: number } {
  const adaptedThreshold = calculateAdaptiveDarkThreshold(imageData, bounds, bezelWidth);
  
  const { width, height, data } = imageData;
  const { x, y, width: w, height: h } = bounds;
  
  let darkPixelCount = 0;
  let totalPixelCount = 0;
  
  // 4辺のサンプリング（前述と同様）
  const checkEdge = (
    startX: number, endX: number,
    startY: number, endY: number
  ) => {
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        const idx = (py * width + px) * 4;
        const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
        if (lum < adaptedThreshold) darkPixelCount++;
        totalPixelCount++;
      }
    }
  };
  
  checkEdge(x, x + w, Math.max(0, y - bezelWidth), y);
  checkEdge(x, x + w, y + h, Math.min(height, y + h + bezelWidth));
  checkEdge(Math.max(0, x - bezelWidth), x, y, y + h);
  checkEdge(x + w, Math.min(width, x + w + bezelWidth), y, y + h);
  
  return {
    score: totalPixelCount > 0 ? darkPixelCount / totalPixelCount : 0,
    adaptedThreshold,
  };
}
```

##### 解決策2: 色相を考慮したベゼル検出

```typescript
/**
 * 色相・彩度・明度（HSL）を考慮したベゼル検出
 * グレーやダークブルーのベゼルに対応
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  
  if (max === min) {
    return { h: 0, s: 0, l };
  }
  
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  
  let h: number;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
    default: h = 0;
  }
  
  return { h, s, l };
}

/**
 * ベゼルとして認識できるピクセルかどうかを判定
 */
function isBezelPixel(r: number, g: number, b: number): boolean {
  const { h, s, l } = rgbToHsl(r, g, b);
  
  // 条件1: 明度が低い（暗い）
  if (l < 0.35) {
    return true;
  }
  
  // 条件2: 明度がやや低く、彩度も低い（暗いグレー系）
  if (l < 0.45 && s < 0.15) {
    return true;
  }
  
  // 条件3: 特定の暗い色相（ダークブルー、ダークグレー等）
  // 青系（h: 0.55-0.70）で明度が低い
  if (h >= 0.55 && h <= 0.70 && l < 0.40) {
    return true;
  }
  
  return false;
}

/**
 * HSLベースのベゼルスコア計算
 */
function calculateBezelScoreWithHsl(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number },
  bezelWidth: number = 15
): number {
  const { width, height, data } = imageData;
  const { x, y, width: w, height: h } = bounds;
  
  let bezelPixelCount = 0;
  let totalPixelCount = 0;
  
  const checkEdge = (
    startX: number, endX: number,
    startY: number, endY: number
  ) => {
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        const idx = (py * width + px) * 4;
        if (isBezelPixel(data[idx], data[idx + 1], data[idx + 2])) {
          bezelPixelCount++;
        }
        totalPixelCount++;
      }
    }
  };
  
  checkEdge(x, x + w, Math.max(0, y - bezelWidth), y);
  checkEdge(x, x + w, y + h, Math.min(height, y + h + bezelWidth));
  checkEdge(Math.max(0, x - bezelWidth), x, y, y + h);
  checkEdge(x + w, Math.min(width, x + w + bezelWidth), y, y + h);
  
  return totalPixelCount > 0 ? bezelPixelCount / totalPixelCount : 0;
}
```

#### ケース5-2: ベゼルが細すぎる（薄いフレームのモダンデバイス）

##### 原因分析

最新のスマートフォンやノートPCは非常に細いベゼルを持つため、サンプリング幅が広すぎると背景も含めてしまいます：

```
細いベゼルの問題：
┌─────────────────────────────────┐
│■│                           │■│  ← 2-3px程度の細いベゼル
│                               │
│         画面領域              │
│                               │
│■│                           │■│
└─────────────────────────────────┘

サンプリング幅15pxだと：
├───15px───┤
■■│背景背景背景│ ← ベゼル以外も含まれる
```

##### 解決策1: 可変サンプリング幅

```typescript
/**
 * デバイスサイズに応じてベゼル幅を推定
 */
function estimateBezelWidth(
  bounds: { width: number; height: number },
  imageSize: { width: number; height: number }
): number {
  const deviceSize = Math.sqrt(bounds.width * bounds.height);
  const imageSize_ = Math.sqrt(imageSize.width * imageSize.height);
  
  // デバイスが画像に占める割合
  const sizeRatio = deviceSize / imageSize_;
  
  // 小さいデバイスは細いベゼル、大きいデバイスは太いベゼルと推定
  if (sizeRatio < 0.1) {
    return 5;   // 非常に小さい → 5px
  } else if (sizeRatio < 0.2) {
    return 8;   // 小さい → 8px
  } else if (sizeRatio < 0.4) {
    return 12;  // 中程度 → 12px
  } else {
    return 18;  // 大きい → 18px
  }
}

/**
 * 段階的なベゼル幅でスコアを計算し、最も高いものを採用
 */
function calculateBezelScoreMultiScale(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number }
): { score: number; optimalBezelWidth: number } {
  const bezelWidths = [5, 8, 12, 18, 25];
  
  let bestScore = 0;
  let optimalWidth = 15;
  
  for (const width of bezelWidths) {
    const score = calculateBezelScore(imageData, bounds, width);
    if (score > bestScore) {
      bestScore = score;
      optimalWidth = width;
    }
  }
  
  return { score: bestScore, optimalBezelWidth: optimalWidth };
}
```

##### 解決策2: グラデーション検出（ベゼル境界の特定）

```typescript
/**
 * ベゼルと背景の境界をグラデーションで検出
 */
function detectBezelBoundary(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number },
  direction: 'top' | 'bottom' | 'left' | 'right',
  maxSearchWidth: number = 30
): { bezelWidth: number; confidence: number } {
  const { width, height, data } = imageData;
  const { x, y, width: w, height: h } = bounds;
  
  // 検索方向に沿って輝度の変化を追跡
  const luminanceProfile: number[] = [];
  
  if (direction === 'top' || direction === 'bottom') {
    const startY = direction === 'top' 
      ? Math.max(0, y - maxSearchWidth) 
      : y + h;
    const endY = direction === 'top' 
      ? y 
      : Math.min(height, y + h + maxSearchWidth);
    const step = direction === 'top' ? 1 : 1;
    
    for (let py = startY; py !== endY; py += step) {
      let rowLuminance = 0;
      let count = 0;
      
      for (let px = x; px < x + w; px++) {
        const idx = (py * width + px) * 4;
        rowLuminance += getLuminance(data[idx], data[idx + 1], data[idx + 2]);
        count++;
      }
      
      luminanceProfile.push(rowLuminance / count);
    }
  } else {
    // left/right の場合は同様に列方向で計算
    const startX = direction === 'left'
      ? Math.max(0, x - maxSearchWidth)
      : x + w;
    const endX = direction === 'left'
      ? x
      : Math.min(width, x + w + maxSearchWidth);
    
    for (let px = startX; px !== endX; px++) {
      let colLuminance = 0;
      let count = 0;
      
      for (let py = y; py < y + h; py++) {
        const idx = (py * width + px) * 4;
        colLuminance += getLuminance(data[idx], data[idx + 1], data[idx + 2]);
        count++;
      }
      
      luminanceProfile.push(colLuminance / count);
    }
  }
  
  // 輝度の急激な変化点を検出
  let maxGradient = 0;
  let boundaryIndex = 0;
  
  for (let i = 1; i < luminanceProfile.length; i++) {
    const gradient = Math.abs(luminanceProfile[i] - luminanceProfile[i - 1]);
    if (gradient > maxGradient) {
      maxGradient = gradient;
      boundaryIndex = i;
    }
  }
  
  // 信頼度は最大グラデーションの大きさで判断
  const confidence = Math.min(maxGradient / 0.3, 1.0);
  
  return {
    bezelWidth: boundaryIndex,
    confidence,
  };
}

/**
 * 4辺のベゼル境界を自動検出
 */
function autoDetectBezelWidths(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number }
): { top: number; bottom: number; left: number; right: number } {
  return {
    top: detectBezelBoundary(imageData, bounds, 'top').bezelWidth,
    bottom: detectBezelBoundary(imageData, bounds, 'bottom').bezelWidth,
    left: detectBezelBoundary(imageData, bounds, 'left').bezelWidth,
    right: detectBezelBoundary(imageData, bounds, 'right').bezelWidth,
  };
}
```

#### ケース5-3: ベゼルと画面の境界がぼやけている（反射・グラデーション）

##### 原因分析

光の反射やアンチエイリアスにより、ベゼルと画面の境界がシャープでない場合があります：

```
ぼやけた境界：
│ベゼル │ 境界（グラデ） │  画面  │
│ 0.1  │ 0.2 0.4 0.6 0.8 │  0.95  │
        ↑ どこからが画面か不明確
```

##### 解決策1: エッジ検出による境界強調

```typescript
/**
 * Sobelフィルタでエッジを検出
 */
function sobelEdgeDetection(
  imageData: ImageData
): { magnitude: Float32Array; direction: Float32Array } {
  const { width, height, data } = imageData;
  const magnitude = new Float32Array(width * height);
  const direction = new Float32Array(width * height);
  
  // Sobelカーネル
  const sobelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ];
  
  const sobelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
          
          gx += lum * sobelX[ky + 1][kx + 1];
          gy += lum * sobelY[ky + 1][kx + 1];
        }
      }
      
      const idx = y * width + x;
      magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
      direction[idx] = Math.atan2(gy, gx);
    }
  }
  
  return { magnitude, direction };
}

/**
 * エッジ強度を使ったベゼル境界検出
 */
function detectBezelWithEdges(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number },
  bezelWidth: number = 15
): { score: number; edgeQuality: number } {
  const { width, height } = imageData;
  const { x, y, width: w, height: h } = bounds;
  
  const edges = sobelEdgeDetection(imageData);
  
  // 境界線上のエッジ強度を計算
  let edgeStrengthSum = 0;
  let edgeCount = 0;
  
  // 上辺
  for (let px = x; px < x + w; px++) {
    const idx = y * width + px;
    edgeStrengthSum += edges.magnitude[idx];
    edgeCount++;
  }
  
  // 下辺
  for (let px = x; px < x + w; px++) {
    const idx = (y + h - 1) * width + px;
    edgeStrengthSum += edges.magnitude[idx];
    edgeCount++;
  }
  
  // 左辺
  for (let py = y; py < y + h; py++) {
    const idx = py * width + x;
    edgeStrengthSum += edges.magnitude[idx];
    edgeCount++;
  }
  
  // 右辺
  for (let py = y; py < y + h; py++) {
    const idx = py * width + (x + w - 1);
    edgeStrengthSum += edges.magnitude[idx];
    edgeCount++;
  }
  
  const avgEdgeStrength = edgeStrengthSum / edgeCount;
  
  // 通常のベゼルスコア
  const bezelScore = calculateBezelScore(imageData, bounds, bezelWidth);
  
  // エッジ品質（0-1に正規化）
  const edgeQuality = Math.min(avgEdgeStrength / 0.5, 1.0);
  
  return {
    score: bezelScore,
    edgeQuality,
  };
}
```

##### 解決策2: モルフォロジー演算による境界クリーンアップ

```typescript
/**
 * 収縮（Erosion）演算 - 白領域を縮小
 */
function erosion(
  mask: Uint8Array,
  width: number,
  height: number,
  kernelSize: number = 3
): Uint8Array {
  const result = new Uint8Array(width * height);
  const half = Math.floor(kernelSize / 2);
  
  for (let y = half; y < height - half; y++) {
    for (let x = half; x < width - half; x++) {
      let allWhite = true;
      
      for (let ky = -half; ky <= half && allWhite; ky++) {
        for (let kx = -half; kx <= half && allWhite; kx++) {
          const idx = (y + ky) * width + (x + kx);
          if (mask[idx] === 0) {
            allWhite = false;
          }
        }
      }
      
      result[y * width + x] = allWhite ? 1 : 0;
    }
  }
  
  return result;
}

/**
 * 膨張（Dilation）演算 - 白領域を拡大
 */
function dilation(
  mask: Uint8Array,
  width: number,
  height: number,
  kernelSize: number = 3
): Uint8Array {
  const result = new Uint8Array(width * height);
  const half = Math.floor(kernelSize / 2);
  
  for (let y = half; y < height - half; y++) {
    for (let x = half; x < width - half; x++) {
      let anyWhite = false;
      
      for (let ky = -half; ky <= half && !anyWhite; ky++) {
        for (let kx = -half; kx <= half && !anyWhite; kx++) {
          const idx = (y + ky) * width + (x + kx);
          if (mask[idx] === 1) {
            anyWhite = true;
          }
        }
      }
      
      result[y * width + x] = anyWhite ? 1 : 0;
    }
  }
  
  return result;
}

/**
 * Opening演算（収縮→膨張）でノイズ除去
 * Closing演算（膨張→収縮）で穴埋め
 */
function morphologicalCleanup(
  mask: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  // Opening: ノイズ除去
  let cleaned = erosion(mask, width, height, 3);
  cleaned = dilation(cleaned, width, height, 3);
  
  // Closing: 穴埋め
  cleaned = dilation(cleaned, width, height, 3);
  cleaned = erosion(cleaned, width, height, 3);
  
  return cleaned;
}
```

#### ケース5-4: 複数のベゼル層（ケース/カバー付きデバイス）

##### 原因分析

保護ケースやカバーが付いたデバイスでは、複数のフレーム層が見える場合があります：

```
ケース付きデバイス：
┌─────────────────────────┐  ← ケースの外枠（暗いグレー）
│┌───────────────────────┐│
││┌─────────────────────┐││  ← デバイス本体のベゼル（黒）
│││                     │││
│││     画面領域        │││
│││                     │││
││└─────────────────────┘││
│└───────────────────────┘│
└─────────────────────────┘

サンプリング位置によって異なるベゼルを検出
```

##### 解決策: 最も内側のベゼルを優先

```typescript
/**
 * 複数層のベゼルを検出し、最も内側を採用
 */
function detectInnermostBezel(
  imageData: ImageData,
  whiteMask: Uint8Array,
  initialBounds: { x: number; y: number; width: number; height: number },
  maxLayers: number = 3
): { 
  bounds: { x: number; y: number; width: number; height: number };
  bezelLayers: number;
} {
  const { width, height, data } = imageData;
  let currentBounds = { ...initialBounds };
  let layerCount = 0;
  
  // 外側から内側へ向かってベゼル層を探す
  for (let layer = 0; layer < maxLayers; layer++) {
    // 現在の境界の内側に白領域があるか確認
    const innerBounds = shrinkBounds(currentBounds, 20);
    
    if (innerBounds.width < 10 || innerBounds.height < 10) {
      break; // これ以上縮小できない
    }
    
    // 内側の境界でベゼルスコアを計算
    const innerBezelScore = calculateBezelScore(imageData, innerBounds, 10);
    
    if (innerBezelScore > 0.4) {
      // 内側にもベゼルがある → さらに内側を探す
      currentBounds = innerBounds;
      layerCount++;
    } else {
      // 内側にベゼルがない → 現在が最内層
      break;
    }
  }
  
  return {
    bounds: currentBounds,
    bezelLayers: layerCount,
  };
}

/**
 * 境界を指定ピクセル数だけ縮小
 */
function shrinkBounds(
  bounds: { x: number; y: number; width: number; height: number },
  amount: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: bounds.x + amount,
    y: bounds.y + amount,
    width: bounds.width - amount * 2,
    height: bounds.height - amount * 2,
  };
}
```

#### ケース5-5: 統合ソリューション - ロバストなベゼル検出関数

```typescript
/**
 * 上記すべての改善策を統合したロバストなベゼル検出
 */
interface RobustBezelDetectionResult {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  method: string;
  details: {
    adaptiveScore: number;
    hslScore: number;
    edgeQuality: number;
    multiScaleScore: number;
    optimalBezelWidth: number;
  };
}

function detectBezelRobust(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number }
): RobustBezelDetectionResult {
  // 1. 適応的閾値でのスコア
  const adaptiveResult = calculateBezelScoreAdaptive(imageData, bounds);
  
  // 2. HSLベースのスコア
  const hslScore = calculateBezelScoreWithHsl(imageData, bounds);
  
  // 3. エッジ品質
  const edgeResult = detectBezelWithEdges(imageData, bounds);
  
  // 4. マルチスケールスコア
  const multiScaleResult = calculateBezelScoreMultiScale(imageData, bounds);
  
  // 統合スコア計算
  const scores = [
    adaptiveResult.score,
    hslScore,
    edgeResult.score,
    multiScaleResult.score,
  ];
  
  // 最大値と平均値の加重平均
  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const finalScore = maxScore * 0.6 + avgScore * 0.4;
  
  // 信頼度判定
  let confidence: 'high' | 'medium' | 'low';
  let method: string;
  
  if (finalScore >= 0.6 && edgeResult.edgeQuality >= 0.5) {
    confidence = 'high';
    method = 'multi-method-consensus';
  } else if (finalScore >= 0.4 || maxScore >= 0.6) {
    confidence = 'medium';
    method = maxScore === hslScore ? 'hsl-based' : 
             maxScore === adaptiveResult.score ? 'adaptive-threshold' :
             'multi-scale';
  } else {
    confidence = 'low';
    method = 'fallback';
  }
  
  return {
    score: finalScore,
    confidence,
    method,
    details: {
      adaptiveScore: adaptiveResult.score,
      hslScore,
      edgeQuality: edgeResult.edgeQuality,
      multiScaleScore: multiScaleResult.score,
      optimalBezelWidth: multiScaleResult.optimalBezelWidth,
    },
  };
}
```

#### 黒ベゼル検出のパラメータ調整ガイド

| ケース | 推奨アプローチ | パラメータ調整 |
|--------|--------------|---------------|
| グレーベゼル | HSLベース or 適応的閾値 | `darkThreshold`: 0.35-0.45 |
| 細いベゼル | マルチスケール検出 | `bezelWidths`: [3, 5, 8, 12] |
| ぼやけた境界 | エッジ検出併用 | `edgeQualityThreshold`: 0.3 |
| ケース付き | 最内層検出 | `maxLayers`: 2-3 |
| 反射あり | モルフォロジー前処理 | `kernelSize`: 3-5 |

