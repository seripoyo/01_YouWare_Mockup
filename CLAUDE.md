# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリのコードを扱う際のガイダンスを提供します。

## プロジェクト概要

YouWareプラットフォーム上で動作する、モバイルファーストのReactアプリケーションです。デバイスフレーム検出とローカル画像合成機能を備えた、AIパワード画像モックアップエディタを提供します。iOS Safari、Android Chrome、およびネイティブWebView環境で動作します。

なお、本プロジェクトでは必ずターミナルの返答は日本語を使ってください。必要な場合以外は原則として日本語利用を徹底すること。

### プロジェクトの目的

- figmaやPhotoshop、Canvaなどを使用しなくとも、画像を追加するだけでイメージ通りのモックアップを生成できるアプリを作り、WEBエンジニアやデザイナーのポートフォリオ充実化をサポートする。

### 主要機能

- **デバイスモックアップ合成**: 白抜きのデバイス画像（ノートPC・スマートフォン等）にユーザー提供画像を合成
- **Canvas APIベースの画像処理**: テキストの明瞭性を保持するためのローカル合成
- **AIテンプレート生成**: nano-banana / Seedream4 による独自モックアップテンプレートの生成
- **複数デバイス対応**: 1枚の画像内で最大3台のデバイスを個別に合成可能
- **柔軟な出力設定**: 6種類のアスペクト比から選択可能
- **インタラクティブドロップゾーン**: 検出された各画面領域に直接ドラッグ＆ドロップでスクリーンショットをアップロード

## 開発コマンド

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動 (http://127.0.0.1:5173)
npm run dev

# プロダクションビルド
npm run build

# ビルドプレビュー
npm run preview
```

## YouWare環境の制約

### プラットフォーム仕様

YouWareでは以下の構成が標準です：

- **フロントエンド**: JavaScript/TypeScript ベース
- **バックエンド**: 画像や設定はすべてクライアント側メモリのみで保持し、React の状態とブラウザメモリのみ。ページ遷移・リロードで完全に破棄する。
- **AI連携**: フロントエンドからAI SDKや既存APIを呼び出すワークフロー

### 使用する画像編集APIについて

以下を使用するものとして仮で設定しておく。
- 呼び出し方法：YouWare が提供する API 経由（HTTP ベース）
- 認証： Bearer Token (API Key: sk-YOUWARE)
- 画像生成APIエンドポイント：https://api.youware.com/public/v1/ai/images/generations
- 画像編集APIエンドポイント：https://api.youware.com/public/v1/ai/images/edits

- 使用モデル名1：nano-banana
  - サポート形式: b64_json または url
- 使用モデル名2：doubao-seedream-4-0-250828
  - サポートサイズ: 2560x1440、1440x2560、2048x2048等
  - サポート形式: url（URL形式のみ）

### 禁止事項

```typescript
// ❌ Pythonバックエンド（OpenCV/Pillow）は使用不可
// YouWareでは専用のPythonランタイムを立てることができません

// ❌ サーバーサイドでの画像処理
// 画像処理はすべてフロントエンド（Canvas API）で実行
```

### 推奨アプローチ

```typescript
// ✅ Canvas APIによるクライアントサイド画像処理
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// ✅ AI APIはフロントエンドから直接呼び出し
const response = await fetch('https://api.youware.com/public/v1/ai/images/edits', {
  method: 'POST',
  body: formData
});
```

## 出力画像設定

### アスペクト比と出力サイズ

ユーザーは以下の6種類のアスペクト比から出力画像サイズを選択できます：

| アスペクト比 | 出力サイズ (px) | 主な用途 |
|-------------|-----------------|----------|
| 1:1 | 1200 × 1200 | X、Instagram、Threads、プロフィール画像 |
| 3:4 | 900 × 1200 | Pinterest、ポートレート |
| 4:5 | 1080 × 1350 | Instagram、Threadsの縦長投稿 |
| 8:9 | 1200 × 1350 | Xでの2枚投稿、3枚投稿1枚目 |
| 16:9 | 1920 × 1080 | YouTube サムネイル、Xにおける3枚投稿2-3枚目、4枚投稿 |
| 9:16 | 1080 × 1920 | Instagram/Threads/TikTok ストーリーズ |

```typescript
// src/constants/outputSizes.ts

export const OUTPUT_ASPECT_RATIOS = {
  '1:1': { width: 1200, height: 1200, label: '1:1 (正方形)' },
  '3:4': { width: 900, height: 1200, label: '3:4 (縦長)' },
  '4:5': { width: 1080, height: 1350, label: '4:5 (Instagram縦)' },
  '8:9': { width: 1200, height: 1350, label: '8:9 (X複数投稿)' },
  '16:9': { width: 1920, height: 1080, label: '16:9 (横長)' },
  '9:16': { width: 1080, height: 1920, label: '9:16 (ストーリーズ)' },
} as const;

export type AspectRatioKey = keyof typeof OUTPUT_ASPECT_RATIOS;
```

## 複数デバイス対応

### デバイス識別カラー

1枚のモックアップ画像内に複数のデバイス（最大3台）が存在する場合、それぞれを識別するために異なるフィル色を使用します：

| デバイス | フィル色 | 用途例 |
|----------|----------|--------|
| 1台目 | `#e5c4be` | メインデバイス（ピンクベージュ） |
| 2台目 | `#accbde` | サブデバイス（ライトブルー） |
| 3台目 | `#ffe2c6` | 第3デバイス（ピーチ） |

```typescript
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

// 検出された白領域にデバイス番号を割り当て
interface DetectedRegion {
  bounds: { x: number; y: number; width: number; height: number };
  corners: [Point, Point, Point, Point];
  score: number;
  filled: boolean;
  deviceIndex: 0 | 1 | 2;  // デバイス番号（0始まり）
  fillColor: string;       // 対応するフィル色
  hasBezelFrame: boolean;  // 黒フレームに囲まれているか
}
```

### 複数デバイス検出ロジック

```typescript
function assignDeviceIndices(regions: DetectedRegion[]): DetectedRegion[] {
  // スコア順にソート（高い順）
  const sorted = [...regions].sort((a, b) => b.score - a.score);
  
  // 最大3台まで、スコア順にデバイス番号を割り当て
  return sorted.slice(0, 3).map((region, index) => ({
    ...region,
    deviceIndex: index as 0 | 1 | 2,
    fillColor: DEVICE_COLOR_ORDER[index],
  }));
}
```

## プリセット画像ギャラリー

### ギャラリーフィルタリング機能

プリセット画像は以下の3つのフィルタでギャラリー表示を行います：

#### 1. アスペクト比フィルタ

プリセット画像のアスペクト比に基づいてフィルタリング。

```typescript
type PresetAspectRatio = '1:1' | '3:4' | '4:5' | '8:9' | '16:9' | '9:16';
```

#### 2. カラートーンフィルタ

画像ファイル名に記載されたカラートーンに基づいてフィルタリング。

```typescript
// ファイル名例: laptop_4x5_047_beige.webp
//              └─ カラートーン: beige

type ColorTone = 
  | 'orange'   // オレンジ
  | 'brown'    // ブラウン
  | 'beige'    // ベージュ
  | 'white'    // ホワイト
  | 'gray'     // グレー
  | 'blue'     // ブルー
  | 'pink'     // ピンク
  | 'green'    // グリーン
  | string;    // その他のカスタムトーン
```

#### 3. デバイス種類フィルタ

```typescript
type DeviceType = 
  | 'SmartPhone'  // スマートフォン単体
  | 'Laptop'      // ノートPC単体
  | 'Tablet'      // タブレット単体
  | 'Mixed';      // 複数デバイス混合

// Mixed の命名規則例:
// - SpAndLaptop_4x5_001_beige.webp  → スマホ + ノートPC
// - LaptopAndTablet_16x9_002_gray.webp  → ノートPC + タブレット
// - 2sp_9x16_123_pink.webp   → スマホ2台
// - SpAndLaptopAndTablet_1x1_003_white.webp → 3デバイス混合
```

### プリセット画像の命名規則

```
保存先: /public/mockup/{AspectRatio}/
ファイル名: {DeviceType}_{AspectRatio}_{SerialNumber}_{ColorTone}.webp

フルパス例:
- /public/mockup/4x5/laptop_4x5_047_beige.webp
- /public/mockup/9x16/smartphone_9x16_012_white.webp
- /public/mockup/9x16/SpAndLaptop_9x16_035_green.webp
- /public/mockup/9x16/2sp_9x16_123_pink.webp
- /public/mockup/16x9/tablet_16x9_008_gray.webp
- /public/mockup/16x9/2sp_16x9_014_pink.webp
```

### ギャラリーフィルタ実装

```typescript
// src/types/preset.ts

export interface PresetImage {
  id: string;
  filename: string;
  path: string;
  aspectRatio: PresetAspectRatio;
  colorTone: string;
  deviceType: DeviceType;
  deviceCount: number;  // 1〜3
  thumbnail: string;
}

// src/utils/presetParser.ts

export function parsePresetFilename(filename: string): Partial<PresetImage> {
  // laptop_4x5_047_beige.webp をパース
  const parts = filename.replace('.webp', '').split('_');
  
  const deviceType = parseDeviceType(parts[0]);
  const aspectRatio = parseAspectRatio(parts[1]);
  const colorTone = parts[3];  // 単一カラートーン
  
  return {
    filename,
    deviceType,
    aspectRatio,
    colorTone,
    deviceCount: getDeviceCount(parts[0]),
  };
}

function parseDeviceType(str: string): DeviceType {
  const lower = str.toLowerCase();
  if (lower === 'smartphone' || lower === 'sp') return 'SmartPhone';
  if (lower === 'laptop') return 'Laptop';
  if (lower === 'tablet') return 'Tablet';
  if (lower.includes('and') || /^\d+sp$/i.test(lower)) return 'Mixed';
  return 'Laptop'; // デフォルト
}

function getDeviceCount(str: string): number {
  const lower = str.toLowerCase();
  // "2sp" → 2台
  const match = lower.match(/^(\d+)sp$/);
  if (match) return parseInt(match[1], 10);
  // "SpAndLaptopAndTablet" → 3台
  if (lower.includes('and')) {
    return lower.split('and').length;
  }
  return 1;
}

// src/hooks/usePresetFilter.ts

export function usePresetFilter(presets: PresetImage[]) {
  const [filters, setFilters] = useState({
    aspectRatio: null as PresetAspectRatio | null,
    colorTone: null as string | null,
    deviceType: null as DeviceType | null,
  });

  const filteredPresets = useMemo(() => {
    return presets.filter(preset => {
      if (filters.aspectRatio && preset.aspectRatio !== filters.aspectRatio) {
        return false;
      }
      if (filters.colorTone && preset.colorTone !== filters.colorTone) {
        return false;
      }
      if (filters.deviceType && preset.deviceType !== filters.deviceType) {
        return false;
      }
      return true;
    });
  }, [presets, filters]);

  return { filters, setFilters, filteredPresets };
}
```

## 画像合成アーキテクチャ

### 設計原則：テキスト明瞭性の保持

**重要**: ユーザー提供画像内のテキストを一字一句そのまま維持するため、画像生成AIではなく**Canvas APIによるプログラム合成**をメインとします。

#### なぜAIだけだと危険なのか

Stable Diffusion系モデル（nano-banana含む）は画像を「貼り付ける」のではなく、「再解釈して描き直す」処理を行います。以下のリスクがあります：

- **文字化け**: 細かい日本語や数字が謎の記号に変換される
- **UIの変形**: ボタンや枠線が歪む
- **情報の改変**: ロゴやアイコンが似て非なるものに変化

### 推奨ワークフロー

```
┌─────────────────────────────────────────────────────────────────┐
│  ユーザー入力                                                    │
│  ├── デバイスフレーム画像（プリセット or AIによるカスタム生成）     │
│  ├── コンテンツ画像（スクリーンショット等）× 最大3枚              │
│  └── 出力アスペクト比の選択                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: 黒フレーム囲み画面領域検出（detectDeviceScreens）         │
│  ├── 輝度閾値 > 0.90 で白/明るい矩形領域を候補として検出            │
│  ├── BFS連結成分抽出                                              │
│  ├── 【重要】黒フレーム（ベゼル）囲みチェック                       │
│  │   └── 周囲8方向に暗いピクセル（輝度 < 0.25）が存在するか確認     │
│  ├── フィルタ: 面積 > 0.5%、矩形度 > 0.65、bezelScore > 0.6        │
│  ├── スコアリング: bezelScore × areaRatio × rectangularity        │
│  └── 最大3領域にデバイス番号を割り当て                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: デバイス別フィル色適用 & ドロップゾーン生成                │
│  ├── 1台目: #e5c4be（ピンクベージュ）                             │
│  ├── 2台目: #accbde（ライトブルー）                               │
│  ├── 3台目: #ffe2c6（ピーチ）                                     │
│  └── 各領域をインタラクティブドロップゾーンとしてオーバーレイ表示   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: ユーザーによるコンテンツ画像アップロード                   │
│  ├── 各ドロップゾーンにドラッグ＆ドロップ or クリックで画像選択     │
│  ├── アップロード時にプレビュー表示（透視変換適用）                 │
│  └── 全領域に画像が設定されるまで合成ボタンは非活性                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: ローカル合成（handleLocalCompose）【メイン処理】          │
│  ├── 各デバイス領域に対応するコンテンツ画像を透視変換               │
│  ├── CONTAIN-fit スケーリング（アスペクト比維持 + レターボックス）   │
│  └── Canvas合成で白領域にコンテンツをオーバーレイ                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: 出力サイズ調整                                           │
│  ├── 選択されたアスペクト比に合わせてリサイズ                       │
│  └── 高品質補間でスケーリング                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 6: AI仕上げ（オプション）【補助的役割のみ】                   │
│  ├── 用途: 光の反射追加、ライティング調整、背景の馴染ませ            │
│  ├── Denoising Strength: 極めて低く (0.1〜0.2以下)                │
│  └── テキスト領域は処理対象外に                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 黒フレーム囲み画面領域検出アルゴリズム

### 背景との混在問題

添付画像のように、背景も明るい色（ピンクベージュ、クリーム色など）の場合、単純な輝度閾値だけでは背景と画面を区別できません。

**問題例:**
- `2sp_9x16_123_pink_beige.webp`: ピンクベージュ背景 + 白い画面 → 背景も検出されてしまう
- `SpAndLaptop_9x16_035_green.webp`: 緑背景 → 問題なし（背景が暗い）

### 解決策: 黒フレーム（ベゼル）検出

デバイスの画面は必ず**黒いベゼル（フレーム）に囲まれている**という特性を利用します。

```typescript
// src/utils/screenDetection.ts

interface Point {
  x: number;
  y: number;
}

interface ScreenRegion {
  bounds: { x: number; y: number; width: number; height: number };
  corners: [Point, Point, Point, Point];  // 透視変換用4隅（時計回り）
  centroid: Point;                        // 重心
  area: number;                           // 面積（ピクセル数）
  rectangularity: number;                 // 矩形度 (0-1)
  bezelScore: number;                     // ベゼル囲みスコア (0-1)
  overallScore: number;                   // 総合スコア
  deviceIndex: 0 | 1 | 2;
  fillColor: string;
  contentImage: HTMLImageElement | null;  // ユーザーがアップロードした画像
}

// 輝度計算
function getLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// 黒フレーム囲みスコアを計算
function calculateBezelScore(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number },
  bezelWidth: number = 15  // チェックするベゼル幅（ピクセル）
): number {
  const { width, height, data } = imageData;
  const { x, y, width: w, height: h } = bounds;
  
  let darkPixelCount = 0;
  let totalPixelCount = 0;
  const DARK_THRESHOLD = 0.25;  // 暗さの閾値
  
  // 上辺のベゼルチェック
  for (let py = Math.max(0, y - bezelWidth); py < y; py++) {
    for (let px = x; px < x + w; px++) {
      const idx = (py * width + px) * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
      if (lum < DARK_THRESHOLD) darkPixelCount++;
      totalPixelCount++;
    }
  }
  
  // 下辺のベゼルチェック
  for (let py = y + h; py < Math.min(height, y + h + bezelWidth); py++) {
    for (let px = x; px < x + w; px++) {
      const idx = (py * width + px) * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
      if (lum < DARK_THRESHOLD) darkPixelCount++;
      totalPixelCount++;
    }
  }
  
  // 左辺のベゼルチェック
  for (let py = y; py < y + h; py++) {
    for (let px = Math.max(0, x - bezelWidth); px < x; px++) {
      const idx = (py * width + px) * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
      if (lum < DARK_THRESHOLD) darkPixelCount++;
      totalPixelCount++;
    }
  }
  
  // 右辺のベゼルチェック
  for (let py = y; py < y + h; py++) {
    for (let px = x + w; px < Math.min(width, x + w + bezelWidth); px++) {
      const idx = (py * width + px) * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
      if (lum < DARK_THRESHOLD) darkPixelCount++;
      totalPixelCount++;
    }
  }
  
  return totalPixelCount > 0 ? darkPixelCount / totalPixelCount : 0;
}

// 4辺それぞれのベゼル存在を個別チェック（より厳密な検出）
function checkBezelEdges(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number },
  bezelWidth: number = 15
): { top: number; bottom: number; left: number; right: number } {
  const { width, height, data } = imageData;
  const { x, y, width: w, height: h } = bounds;
  const DARK_THRESHOLD = 0.25;
  
  const checkEdge = (
    startX: number, endX: number,
    startY: number, endY: number
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

// メイン検出関数
export function detectDeviceScreens(
  imageData: ImageData,
  options: {
    luminanceThreshold?: number;      // 白判定閾値（デフォルト: 0.90）
    minAreaRatio?: number;            // 最小面積比（デフォルト: 0.005 = 0.5%）
    minRectangularity?: number;       // 最小矩形度（デフォルト: 0.65）
    minBezelScore?: number;           // 最小ベゼルスコア（デフォルト: 0.4）
    bezelWidth?: number;              // ベゼルチェック幅（デフォルト: 15px）
  } = {}
): ScreenRegion[] {
  const {
    luminanceThreshold = 0.90,
    minAreaRatio = 0.005,
    minRectangularity = 0.65,
    minBezelScore = 0.4,
    bezelWidth = 15,
  } = options;
  
  const { width, height, data } = imageData;
  const totalPixels = width * height;
  
  // Step 1: 輝度閾値で白ピクセルをマーキング
  const isWhite = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
    isWhite[i] = lum >= luminanceThreshold ? 1 : 0;
  }
  
  // Step 2: BFS連結成分抽出
  const visited = new Uint8Array(totalPixels);
  const regions: Array<{
    pixels: number[];
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
  }> = [];
  
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isWhite[idx] && !visited[idx]) {
        // BFS開始
        const queue: [number, number][] = [[x, y]];
        const pixels: number[] = [];
        const bounds = { minX: x, minY: y, maxX: x, maxY: y };
        
        while (queue.length > 0) {
          const [cx, cy] = queue.shift()!;
          const cIdx = cy * width + cx;
          
          if (visited[cIdx]) continue;
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
              if (isWhite[nIdx] && !visited[nIdx]) {
                queue.push([nx, ny]);
              }
            }
          }
        }
        
        regions.push({ pixels, bounds });
      }
    }
  }
  
  // Step 3: フィルタリングとスコアリング
  const screenRegions: ScreenRegion[] = [];
  
  for (const region of regions) {
    const area = region.pixels.length;
    const areaRatio = area / totalPixels;
    
    // 面積フィルタ
    if (areaRatio < minAreaRatio) continue;
    
    const { minX, minY, maxX, maxY } = region.bounds;
    const boundWidth = maxX - minX + 1;
    const boundHeight = maxY - minY + 1;
    const boundArea = boundWidth * boundHeight;
    
    // 矩形度計算
    const rectangularity = area / boundArea;
    if (rectangularity < minRectangularity) continue;
    
    const bounds = {
      x: minX,
      y: minY,
      width: boundWidth,
      height: boundHeight,
    };
    
    // 【重要】ベゼルスコア計算
    const bezelScore = calculateBezelScore(imageData, bounds, bezelWidth);
    
    // ベゼルスコアフィルタ - 背景の白い部分を除外
    if (bezelScore < minBezelScore) continue;
    
    // 4辺のベゼル存在チェック（少なくとも3辺に黒フレームが必要）
    const edges = checkBezelEdges(imageData, bounds, bezelWidth);
    const edgesWithBezel = [edges.top, edges.bottom, edges.left, edges.right]
      .filter(score => score > 0.3).length;
    if (edgesWithBezel < 3) continue;
    
    // 重心計算
    let sumX = 0, sumY = 0;
    for (const idx of region.pixels) {
      sumX += idx % width;
      sumY += Math.floor(idx / width);
    }
    const centroid = {
      x: sumX / region.pixels.length,
      y: sumY / region.pixels.length,
    };
    
    // 4隅座標（時計回り: 左上、右上、右下、左下）
    const corners: [Point, Point, Point, Point] = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];
    
    // 総合スコア計算
    const overallScore = bezelScore * areaRatio * rectangularity * 1000;
    
    screenRegions.push({
      bounds,
      corners,
      centroid,
      area,
      rectangularity,
      bezelScore,
      overallScore,
      deviceIndex: 0,
      fillColor: DEVICE_FILL_COLORS.primary,
      contentImage: null,
    });
  }
  
  // Step 4: スコア順にソートし、上位3つにデバイス番号を割り当て
  screenRegions.sort((a, b) => b.overallScore - a.overallScore);
  
  return screenRegions.slice(0, 3).map((region, index) => ({
    ...region,
    deviceIndex: index as 0 | 1 | 2,
    fillColor: DEVICE_COLOR_ORDER[index],
  }));
}
```

### 検出パラメータの調整ガイド

| パラメータ | デフォルト値 | 説明 | 調整の目安 |
|-----------|-------------|------|-----------|
| `luminanceThreshold` | 0.90 | 白判定の輝度閾値 | 画面が灰色っぽい場合は下げる (0.85) |
| `minAreaRatio` | 0.005 | 最小面積比 (0.5%) | 小さい画面を検出したい場合は下げる |
| `minRectangularity` | 0.65 | 最小矩形度 | 角丸画面の場合は下げる (0.55) |
| `minBezelScore` | 0.4 | 最小ベゼルスコア | 誤検出が多い場合は上げる (0.5) |
| `bezelWidth` | 15 | ベゼルチェック幅 (px) | 細いベゼルの場合は下げる (8) |

## インタラクティブドロップゾーンUI

### 機能概要

検出された各画面領域を、ユーザーがスクリーンショットをドラッグ＆ドロップまたはクリックでアップロードできるインタラクティブなエリアとして表示します。

### UIフロー

```
┌─────────────────────────────────────────────────────────────────┐
│  1. テンプレート選択後、画面領域が自動検出される                    │
│     └── 各領域に色付きオーバーレイ + ドロップゾーンアイコン表示     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. ユーザーがドロップゾーンに画像をアップロード                    │
│     ├── ドラッグ＆ドロップ: 画像をゾーン上にドロップ                │
│     └── クリック: ファイル選択ダイアログが開く                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. アップロード後、プレビュー表示                                  │
│     ├── 透視変換を適用したプレビューを即座に表示                    │
│     ├── クリックで画像を変更可能                                    │
│     └── 削除ボタンで画像をクリア                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. 全領域に画像が設定されたら「合成」ボタンが活性化                 │
│     └── ボタン押下で最終合成処理を実行                              │
└─────────────────────────────────────────────────────────────────┘
```

### コンポーネント実装

```typescript
// src/components/DropZoneOverlay.tsx

import React, { useCallback, useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DropZoneOverlayProps {
  region: ScreenRegion;
  templateSize: { width: number; height: number };
  displayScale: number;  // 表示スケール（テンプレート画像の表示サイズ / 実サイズ）
  onImageUpload: (deviceIndex: number, image: HTMLImageElement) => void;
  onImageRemove: (deviceIndex: number) => void;
}

export function DropZoneOverlay({
  region,
  templateSize,
  displayScale,
  onImageUpload,
  onImageRemove,
}: DropZoneOverlayProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 表示座標を計算（スケール適用）
  const displayBounds = {
    x: region.bounds.x * displayScale,
    y: region.bounds.y * displayScale,
    width: region.bounds.width * displayScale,
    height: region.bounds.height * displayScale,
  };
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      loadImage(file);
    }
  }, []);
  
  const handleClick = useCallback(() => {
    if (!region.contentImage) {
      fileInputRef.current?.click();
    }
  }, [region.contentImage]);
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadImage(file);
    }
  }, []);
  
  const loadImage = useCallback((file: File) => {
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        onImageUpload(region.deviceIndex, img);
        setIsLoading(false);
      };
      img.onerror = () => {
        setIsLoading(false);
        // エラーハンドリング
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [region.deviceIndex, onImageUpload]);
  
  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onImageRemove(region.deviceIndex);
  }, [region.deviceIndex, onImageRemove]);
  
  const hasImage = !!region.contentImage;
  
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      
      <motion.div
        className="absolute cursor-pointer"
        style={{
          left: displayBounds.x,
          top: displayBounds.y,
          width: displayBounds.width,
          height: displayBounds.height,
        }}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* 背景オーバーレイ */}
        <div
          className={`
            absolute inset-0 rounded-lg transition-all duration-200
            ${hasImage ? 'bg-transparent' : 'bg-opacity-60'}
            ${isDragOver ? 'ring-4 ring-white ring-opacity-80 scale-[1.02]' : ''}
          `}
          style={{
            backgroundColor: hasImage ? 'transparent' : region.fillColor,
          }}
        />
        
        {/* コンテンツ */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </motion.div>
          ) : hasImage ? (
            <motion.div
              key="preview"
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {/* プレビュー画像は親コンポーネントで描画 */}
              
              {/* 削除ボタン */}
              <button
                onClick={handleRemove}
                className="
                  absolute top-2 right-2 p-2 rounded-full
                  bg-black bg-opacity-50 text-white
                  hover:bg-opacity-70 active:scale-95
                  transition-all duration-150
                  min-h-touch min-w-touch
                "
              >
                <X size={20} />
              </button>
              
              {/* 変更ヒント */}
              <div className="absolute bottom-2 left-2 right-2">
                <div className="
                  px-3 py-1.5 rounded-full text-xs text-white
                  bg-black bg-opacity-50 text-center
                ">
                  タップで変更
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className={`
                p-4 rounded-full bg-white bg-opacity-20
                ${isDragOver ? 'scale-110' : ''}
                transition-transform duration-200
              `}>
                <Upload size={32} />
              </div>
              <p className="text-sm font-medium">
                {isDragOver ? 'ドロップして追加' : 'ここにドロップ'}
              </p>
              <p className="text-xs opacity-80">
                またはタップして選択
              </p>
              
              {/* デバイス番号バッジ */}
              <div className="
                absolute top-2 left-2 px-2 py-1 rounded-full
                bg-white bg-opacity-90 text-xs font-bold
              "
                style={{ color: region.fillColor }}
              >
                デバイス {region.deviceIndex + 1}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
```

### メインエディタでのドロップゾーン統合

```typescript
// src/components/ImageMockupEditor.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DropZoneOverlay } from './DropZoneOverlay';
import { detectDeviceScreens, ScreenRegion } from '../utils/screenDetection';

export function ImageMockupEditor() {
  const [templateImage, setTemplateImage] = useState<HTMLImageElement | null>(null);
  const [regions, setRegions] = useState<ScreenRegion[]>([]);
  const [displayScale, setDisplayScale] = useState(1);
  
  // テンプレート画像が変更されたら画面領域を検出
  useEffect(() => {
    if (!templateImage) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = templateImage.width;
    canvas.height = templateImage.height;
    ctx.drawImage(templateImage, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const detectedRegions = detectDeviceScreens(imageData);
    
    setRegions(detectedRegions);
  }, [templateImage]);
  
  // 画像アップロードハンドラ
  const handleImageUpload = useCallback((deviceIndex: number, image: HTMLImageElement) => {
    setRegions(prev => prev.map(region => 
      region.deviceIndex === deviceIndex
        ? { ...region, contentImage: image }
        : region
    ));
  }, []);
  
  // 画像削除ハンドラ
  const handleImageRemove = useCallback((deviceIndex: number) => {
    setRegions(prev => prev.map(region =>
      region.deviceIndex === deviceIndex
        ? { ...region, contentImage: null }
        : region
    ));
  }, []);
  
  // 全領域に画像が設定されているか
  const allRegionsFilled = useMemo(() => {
    return regions.length > 0 && regions.every(r => r.contentImage !== null);
  }, [regions]);
  
  // 合成処理
  const handleCompose = useCallback(async () => {
    if (!templateImage || !allRegionsFilled) return;
    
    // ... 合成処理
  }, [templateImage, regions, allRegionsFilled]);
  
  return (
    <div className="relative">
      {/* テンプレート画像表示 */}
      {templateImage && (
        <div className="relative">
          <img
            src={templateImage.src}
            alt="Template"
            className="max-w-full h-auto"
            onLoad={(e) => {
              const img = e.currentTarget;
              setDisplayScale(img.clientWidth / img.naturalWidth);
            }}
          />
          
          {/* ドロップゾーンオーバーレイ */}
          {regions.map(region => (
            <DropZoneOverlay
              key={region.deviceIndex}
              region={region}
              templateSize={{
                width: templateImage.width,
                height: templateImage.height,
              }}
              displayScale={displayScale}
              onImageUpload={handleImageUpload}
              onImageRemove={handleImageRemove}
            />
          ))}
        </div>
      )}
      
      {/* 合成ボタン */}
      <button
        onClick={handleCompose}
        disabled={!allRegionsFilled}
        className={`
          w-full mt-4 py-4 rounded-xl font-bold text-lg
          transition-all duration-200
          ${allRegionsFilled
            ? 'bg-blue-500 text-white active:scale-[0.98]'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {allRegionsFilled
          ? 'モックアップを生成'
          : `あと ${regions.filter(r => !r.contentImage).length} 枚の画像を追加`
        }
      </button>
    </div>
  );
}
```

### モバイルタッチ最適化

```css
/* src/styles/dropzone.css */

/* ドロップゾーンのタッチ最適化 */
.drop-zone {
  /* 最小タッチターゲット */
  min-height: 44px;
  min-width: 44px;
  
  /* タップハイライト無効化 */
  -webkit-tap-highlight-color: transparent;
  
  /* テキスト選択防止 */
  user-select: none;
  -webkit-user-select: none;
  
  /* スムーズなタッチスクロール */
  touch-action: manipulation;
}

/* ドラッグ中のスタイル */
.drop-zone.drag-over {
  /* 視覚的フィードバック */
  transform: scale(1.02);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.8);
}

/* アップロード完了後のプレビュー */
.drop-zone.has-image {
  /* プレビュー画像のオブジェクトフィット */
  & img {
    object-fit: contain;
    width: 100%;
    height: 100%;
  }
}
```

## Canvas APIによる透視変換実装

```typescript
// src/utils/perspectiveTransform.ts

interface Point {
  x: number;
  y: number;
}

interface TransformMatrix {
  a: number; b: number; c: number;
  d: number; e: number; f: number;
  g: number; h: number;
}

/**
 * 4点透視変換行列を計算
 * @param src 元画像の4隅 [左上, 右上, 右下, 左下]
 * @param dst 変換先の4隅（モックアップ画面の4隅座標）
 */
export function computePerspectiveTransform(
  src: [Point, Point, Point, Point],
  dst: [Point, Point, Point, Point]
): TransformMatrix {
  // 3x3変換行列の計算（ホモグラフィ）
  // ... 実装詳細
}

/**
 * コンテンツ画像を透視変換してCanvasに描画
 */
export function drawPerspectiveImage(
  ctx: CanvasRenderingContext2D,
  contentImage: HTMLImageElement,
  screenCorners: [Point, Point, Point, Point]
): void {
  // 微小三角形分割による透視変換描画
  // テキストの明瞭性を維持するため、補間品質を最高に設定
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // ... 実装詳細
}
```

## AIテンプレート生成機能

### 機能概要

ユーザーが独自のモックアップテンプレート画像を作成する際に、AIで複数のテンプレート案を生成します。

### デバイスフレーム選択フロー

```
┌─────────────────────────────────────────────────────────────────┐
│  デバイスフレーム選択画面                                          │
│  ├── オプション1: プリセットテンプレートをそのまま使用              │
│  │   └── ギャラリーからフィルタ選択                               │
│  │       ├── アスペクト比フィルタ                                 │
│  │       ├── カラートーンフィルタ                                 │
│  │       └── デバイス種類フィルタ                                 │
│  │                                                               │
│  └── オプション2: プリセットをベースにAIでカスタム生成              │
│      └── 選択したプリセットを元に新フレームを生成                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  AIテンプレート生成（オプション2選択時）                            │
│  ├── nano-banana: 2案生成                                        │
│  └── Seedream4: 2案生成                                          │
│  計4案をユーザーに提示 → 1つを選択して使用                          │
└─────────────────────────────────────────────────────────────────┘
```

### AI API設定

#### nano-banana（画像編集）

```typescript
// エンドポイント
const NANO_BANANA_ENDPOINT = 'https://api.youware.com/public/v1/ai/images/edits';

// 出力サイズ
const OUTPUT_SIZES = {
  phone: { width: 1440, height: 2560 },   // 縦向き
  laptop: { width: 2560, height: 1440 },  // 横向き
};

// リクエスト形式
interface NanoBananaRequest {
  model: 'nano-banana';
  image: File;           // 元画像（プリセット）
  mask?: File;           // マスク（オプション）
  prompt: string;
  n: number;             // 生成数: 2
  response_format: 'b64_json';
}
```

#### プロンプト設計

**ポジティブプロンプト（テンプレート生成用）:**
```
realistic device mockup, white screen placeholder, professional product photography,
clean desk setup, modern workspace, soft natural lighting, high-end laptop/smartphone,
sharp details, commercial quality, 8k resolution
```

**ネガティブプロンプト（共通）:**
```
lowres, worst quality, low quality, jpeg artifacts, blurry,
text distortion, unreadable text, blurry text, altered text,
bad font, mutated text, gibberish, logo distortion,
watermark, signature, deformed, disfigured
```

**テキスト保持用追加プロンプト（合成時）:**
```
// ポジティブ
perfect text, sharp text, legible text, screen capture, ui design, exact details

// ネガティブ（強化版）
text distortion, unreadable text, blurry text, altered text,
bad font, mutated text, gibberish, logo distortion
```

#### Seedream4（画像生成）

```typescript
// エンドポイント
const SEEDREAM4_ENDPOINT = 'https://api.youware.com/public/v1/ai/images/generations';

// リクエスト形式
interface Seedream4Request {
  model: 'seedream-4';
  prompt: string;
  negative_prompt: string;
  n: number;              // 生成数: 2
  size: string;          // "1440x2560" or "2560x1440"
  response_format: 'b64_json';
}
```

## 必須モバイル要件

### 1. モバイルデバイスAPI - 必須使用

**必ず `src/utils/mobileFeatures.ts` を使用:**
- 画像ダウンロード: `saveImageToDevice()`
- デバイスフィードバック: `vibrate()`, `hapticFeedback()`
- WebView通信: `callNative()`, `isInWebView()`

**禁止 - モバイルで失敗するコード:**
```typescript
// ❌ 直接的なdownload link.click() - iOS Safari/WebViewで失敗
const link = document.createElement('a');
link.href = imageData;
link.download = 'file.png';
link.click();

// ❌ 直接的なnavigator.vibrate() - iOS非対応、WebView連携なし
navigator.vibrate(200);
```

**必須 - ラッパー関数を常に使用:**
```typescript
// ✅ クロスプラットフォーム画像保存
import { saveImageToDevice, vibrate, hapticFeedback } from './utils/mobileFeatures';
await saveImageToDevice(imageData, 'mockup.png');
vibrate(100);
hapticFeedback('medium');
```

### 2. セーフエリア実装 - 必須

ノッチ付きデバイス（iPhone X以降、Androidノッチ端末）向けに、全画面レイアウトは必ずセーフエリアインセットを使用。

**必須構造:**
```tsx
<div className="w-full h-dvh">
  <main className="w-full h-full relative">
    <div
      className="w-full h-full flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* コンテンツはノッチとホームインジケーターを自動回避 */}
    </div>
  </main>
</div>
```

**利用可能なTailwindユーティリティ:**
- `h-dvh` - 動的ビューポート高さ (100dvh)
- `h-screen-safe` - セーフエリアを除いたビューポート高さ
- `min-h-touch` - 44px最小タッチターゲット
- スペーシング: `safe-top`, `safe-bottom`, `safe-left`, `safe-right`

### 3. モバイルファーストレスポンシブデザイン

- 375pxモバイルから開始、430px（大型モバイル）までスケール
- コンテンツコンテナに `max-w-mobile` (375px) または `max-w-mobile-lg` (430px) を使用
- `mobile:` と `mobile-lg:` ブレークポイントを使用
- すべてのインタラクティブ要素で最小44pxタッチターゲット
- ホバー状態は使用禁止 - アクティブ状態を使用

## コンポーネントアーキテクチャ

### ImageMockupEditor (`src/components/ImageMockupEditor.tsx`)

デバイスフレーム検出とAIパワード画像合成を組み合わせたコア機能。

#### ローカル合成処理

<!-- ```typescript
async function handleLocalCompose(
  frameImage: HTMLImageElement,
  regions: ScreenRegion[],
  outputSize: { width: number; height: number }
): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  // 出力サイズに設定
  canvas.width = outputSize.width;
  canvas.height = outputSize.height;
  
  // スケール計算
  const scaleX = outputSize.width / frameImage.width;
  const scaleY = outputSize.height / frameImage.height;
  
  // フレーム画像を描画（リサイズ）
  ctx.drawImage(frameImage, 0, 0, outputSize.width, outputSize.height);
  
  // 各検出領域に対応するコンテンツを合成
  for (const region of regions) {
    if (region.contentImage) {
      // スケール適用した4隅座標
      const scaledCorners: [Point, Point, Point, Point] = region.corners.map(
        corner => ({ x: corner.x * scaleX, y: corner.y * scaleY })
      ) as [Point, Point, Point, Point];
      
      // 透視変換でコンテンツを変形して描画
      drawPerspectiveImage(ctx, region.contentImage, scaledCorners);
    }
  }
  
  return canvas.toDataURL('image/png');
}
``` -->

### アセットパス

すべてのアセットは絶対パスを使用（dev/build両方で動作）：
- プリセットフレーム: `/mockup/{aspectRatio}/{deviceType}_{aspectRatio}_{serial}_{colorTone}.webp`

※ ユーザーがアップロードするコンテンツ画像はクライアント側メモリで保持し、ファイルとしては保存しない

## 技術スタック

**コア:**
- React 18.3.1 + TypeScript 5.8.3
- Vite 7.0.0（ソースマップ有効）
- Tailwind CSS 3.4.17（モバイルファーストユーティリティ）

**ルーティング & 状態管理:**
- React Router DOM 6.30.1
- Zustand 4.4.7

**UI & アニメーション:**
- Framer Motion 11.0.8
- GSAP 3.13.0
- Headless UI 1.7.18
- Lucide React（アイコン）

**3D/物理（利用可能だが現在未使用）:**
- Three.js 0.179.1
- Cannon-es 0.20.0
- Matter.js 0.20.0

**モバイル統合:**
- カスタム `mobileFeatures.ts`（ネイティブデバイスAPIラッパー）
- React Native通信用WebViewブリッジ
- PWA機能

## 主要設定ファイル

- `vite.config.ts` - `@youware/vite-plugin-react` プラグイン使用、127.0.0.1:5173でサーバー起動
- `tailwind.config.js` - モバイルファーストブレークポイント、セーフエリアユーティリティ、タッチターゲット
- `src/index.css` - モバイルタッチ最適化
- `yw_manifest.json` - プロジェクトタイプとAI画像エディタ設定

## モバイル開発ガイドライン

**タッチインタラクション:**
- 44px最小タッチターゲット
- ホバー状態ではなくアクティブ状態を使用
- すべてのインタラクションで明確な視覚フィードバック
- ジェスチャーネイティブパターン（スワイプ、タップ、長押し）

**レイアウトパターン:**
```tsx
// ✅ レスポンシブモバイルコンテナ
<div className="w-full max-w-mobile mobile-lg:max-w-mobile-lg mx-auto px-4">

// ✅ 固定ヘッダー付きスクロール可能コンテンツエリア
<div className="w-full h-dvh">
  <header className="flex-none p-4">固定ヘッダー</header>
  <div className="flex-1 overflow-y-auto px-4">
    {/* スクロールコンテンツ */}
  </div>
</div>
```

**パフォーマンス:**
- モバイル最適化に `React.memo` と `useMemo` を使用
- `React.lazy` でコンポーネントを遅延読み込み
- 画像最適化（WebP推奨）
- モバイルネットワーク条件向けコード分割

## プロジェクトエントリーポイント

- **HTMLエントリー:** `index.html` - scriptタグを変更禁止: `<script type="module" src="/src/main.tsx"></script>`
- **Reactエントリー:** `src/main.tsx` - React 18ルートレンダー
- **メインコンポーネント:** `src/App.tsx` - ImageMockupEditor付きセーフエリア構造

## 現在の実装（画像モックアップエディタ）

アプリは完全な画像モックアップ編集ワークフローを実装：

1. ユーザーがプリセットギャラリーからフレームを選択（フィルタ機能付き）
   - または、プリセットをベースにAIで新フレームを生成（nano-banana×2 + Seedream4×2）
2. **黒フレーム囲み検出**で画面領域を自動検出（背景との混在を回避）
3. 検出領域にデバイス番号に応じたフィル色を自動適用
   - 1台目: `#e5c4be`、2台目: `#accbde`、3台目: `#ffe2c6`
4. **インタラクティブドロップゾーン**として各領域を表示
5. ユーザーが各ドロップゾーンに画像をドラッグ＆ドロップまたはクリックでアップロード
6. 出力アスペクト比を選択（1:1, 3:4, 4:5, 8:9, 16:9, 9:16）
7. **ローカル合成**: Canvas API透視変換でコンテンツをCONTAIN-fitで領域に合成
8. **オプションAI仕上げ**: ライティング調整等の補助処理（低Denoising Strength）
9. `saveImageToDevice()` で結果を保存（触覚フィードバック付き）

### 主要実装関数

| ファイル | 関数名 | 役割 |
|---------|--------|------|
| `src/utils/screenDetection.ts` | `detectDeviceScreens` | 黒フレーム囲み画面領域検出 |
| `src/utils/screenDetection.ts` | `calculateBezelScore` | ベゼルスコア計算 |
| `src/utils/screenDetection.ts` | `checkBezelEdges` | 4辺ベゼル存在チェック |
| `src/components/DropZoneOverlay.tsx` | `DropZoneOverlay` | インタラクティブドロップゾーンUI |
| `src/components/ImageMockupEditor.tsx` | `handleLocalCompose` | Canvas APIベースローカル合成 |
| `src/components/ImageMockupEditor.tsx` | `handleGenerateTemplate` | AIテンプレート生成 |
| `src/utils/perspectiveTransform.ts` | `drawPerspectiveImage` | 透視変換描画 |

## 品質チェックリスト

### 画面領域検出品質

- [ ] 黒フレームに囲まれた画面のみが検出されているか
- [ ] 明るい背景（ピンク、ベージュ等）が誤検出されていないか
- [ ] 複数デバイスが正しく識別・番号付けされているか
- [ ] ベゼルスコアが適切に計算されているか

### インタラクティブUI

- [ ] ドロップゾーンがタップ/クリックで反応するか
- [ ] ドラッグ＆ドロップが正常に動作するか
- [ ] 画像アップロード後にプレビューが表示されるか
- [ ] 削除ボタンで画像をクリアできるか

### 画像合成品質

- [ ] テキストが一字一句明瞭に表示されているか
- [ ] UIの直線が歪んでいないか
- [ ] ロゴ・アイコンが正確に表示されているか
- [ ] 透視変換の角度が自然か

### モバイル対応

- [ ] セーフエリアが正しく適用されているか
- [ ] タッチターゲットが44px以上か
- [ ] iOS Safari/Android Chrome/WebViewで動作するか
- [ ] `saveImageToDevice()` でダウンロードできるか

### パフォーマンス

- [ ] 大きな画像でもスムーズに動作するか
- [ ] メモリリークがないか
- [ ] Canvas操作が最適化されているか
- [ ] 画面領域検出が1秒以内に完了するか

### プリセットギャラリー

- [ ] フィルタが正しく動作するか（アスペクト比、カラートーン、デバイス種類）
- [ ] プリセット画像の命名規則が統一されているか
- [ ] サムネイルが正しく表示されるか

## ディレクトリマップ

```
project-root/
├── docs/                           # ドキュメント関連
│   └── API.md                      # API仕様書・エンドポイント定義
│
├── public/                         # 静的アセット（ビルド時にそのままコピー）
│   └── mockup/                     # モックアップテンプレート画像
│       ├── 1x1/                    # 1:1 アスペクト比
│       │   └── ...
│       ├── 3x4/                    # 3:4 アスペクト比
│       │   └── ...
│       ├── 4x5/                    # 4:5 アスペクト比
│       │   └── ...
│       ├── 9x16/                   # 9:16 アスペクト比
│       │   └── ...
│       └── 16x9/                   # 16:9 アスペクト比
│           └── ...
│
├── src/                            # ソースコード
│   ├── components/                 # 再利用可能なUIコンポーネント
│   │   ├── ImageMockupEditor.tsx   # メインエディタ：画面検出・合成・UI統合
│   │   ├── DropZoneOverlay.tsx     # ドロップゾーン：D&D/クリックで画像アップロード
│   │   ├── PresetGallery.tsx       # プリセットギャラリー：フィルタ付き一覧表示
│   │   ├── AspectRatioSelector.tsx # アスペクト比選択UI（6種類）
│   │   ├── DeviceColorBadge.tsx    # デバイス番号バッジ（色付きラベル）
│   │   ├── ComposeButton.tsx       # 合成ボタン（全領域設定で活性化）
│   │   └── PreviewCanvas.tsx       # 合成プレビュー表示用Canvas
│   │
│   ├── features/                   # 機能別モジュール（ドメインロジック）
│   │   └── mockup/
│   │       ├── index.ts            # mockup機能のエクスポート
│   │       ├── useMockupEditor.ts  # エディタ状態管理Hook
│   │       ├── useTemplateLoader.ts # テンプレート読み込みHook
│   │       └── useAIGeneration.ts  # AI生成API呼び出しHook
│   │
│   ├── hooks/                      # カスタムReact Hooks
│   │   ├── usePresetFilter.ts      # プリセットフィルタリングロジック
│   │   ├── useImageUpload.ts       # 画像アップロード処理
│   │   ├── useCanvasCompose.ts     # Canvas合成処理
│   │   └── useTouchFeedback.ts     # タッチフィードバック（振動等）
│   │
│   ├── utils/                      # ユーティリティ関数
│   │   ├── screenDetection.ts      # 黒フレーム囲み画面領域検出アルゴリズム
│   │   ├── perspectiveTransform.ts # 4点透視変換・Canvas描画
│   │   ├── presetParser.ts         # ファイル名パース（デバイス種類・色等抽出）
│   │   ├── mobileFeatures.ts       # モバイルAPI（保存・振動・WebView通信）
│   │   ├── imageUtils.ts           # 画像リサイズ・変換ヘルパー
│   │   └── colorUtils.ts           # 輝度計算・色空間変換
│   │
│   ├── constants/                  # 定数定義
│   │   ├── deviceColors.ts         # デバイス識別色（#e5c4be等）
│   │   ├── outputSizes.ts          # 出力アスペクト比・サイズ定義
│   │   ├── detectionParams.ts      # 検出アルゴリズムパラメータ
│   │   └── apiEndpoints.ts         # API URL・認証情報
│   │
│   ├── types/                      # TypeScript型定義
│   │   ├── preset.ts               # PresetImage, DeviceType, ColorTone等
│   │   ├── region.ts               # ScreenRegion, DetectedRegion, Point等
│   │   ├── editor.ts               # EditorState, ComposeOptions等
│   │   └── api.ts                  # APIリクエスト/レスポンス型
│   │
│   ├── styles/                     # CSS/スタイル関連
│   │   ├── dropzone.css            # ドロップゾーン専用スタイル
│   │   └── animations.css          # アニメーション定義
│   │
│   ├── App.tsx                     # ルートコンポーネント（セーフエリア構造）
│   ├── index.css                   # グローバルスタイル・Tailwind読み込み
│   ├── main.tsx                    # React 18エントリーポイント
│   └── vite-env.d.ts               # Vite環境型定義
│
├── index.html                      # HTMLエントリー（script src="/src/main.tsx"）
├── package.json                    # 依存関係・スクリプト定義
├── tailwind.config.js              # Tailwind設定（モバイルブレークポイント等）
├── vite.config.ts                  # Vite設定（@youware/vite-plugin-react）
├── tsconfig.json                   # TypeScript設定
├── YOUWARE.md                      # YouWareプラットフォーム仕様書
├── yw_manifest.json                # YouWareマニフェスト（プロジェクト設定）
└── CLAUDE.md                       # 本ファイル（Claude Code用ガイダンス）
```

### ディレクトリ別ファイル概要

#### `src/components/` - UIコンポーネント

| ファイル名 | 概要 |
|-----------|------|
| `ImageMockupEditor.tsx` | メインエディタコンポーネント。テンプレート選択、画面検出、ドロップゾーン統合、合成処理を統括 |
| `DropZoneOverlay.tsx` | 検出された画面領域上に表示するインタラクティブなドロップゾーン。D&D/クリックで画像アップロード |
| `PresetGallery.tsx` | プリセットテンプレート一覧。アスペクト比・カラートーン・デバイス種類でフィルタリング |
| `AspectRatioSelector.tsx` | 出力アスペクト比選択UI。6種類（1:1, 3:4, 4:5, 8:9, 16:9, 9:16）から選択 |
| `DeviceColorBadge.tsx` | デバイス番号を示す色付きバッジ。1台目ピンク、2台目ブルー、3台目ピーチ |
| `ComposeButton.tsx` | 合成実行ボタン。全領域に画像が設定されると活性化 |
| `PreviewCanvas.tsx` | 合成結果のプレビュー表示。透視変換適用後の画像を描画 |

#### `src/features/mockup/` - モックアップ機能モジュール

| ファイル名 | 概要 |
|-----------|------|
| `index.ts` | mockup機能のパブリックAPIエクスポート |
| `useMockupEditor.ts` | エディタ全体の状態管理。regions、contentImages、outputSize等を管理 |
| `useTemplateLoader.ts` | テンプレート画像の読み込みと画面領域検出の実行 |
| `useAIGeneration.ts` | nano-banana/Seedream4 APIを呼び出してテンプレート生成 |

#### `src/hooks/` - カスタムHooks

| ファイル名 | 概要 |
|-----------|------|
| `usePresetFilter.ts` | プリセット画像のフィルタリングロジック。filters状態とfilteredPresetsを提供 |
| `useImageUpload.ts` | ファイル選択/D&Dからの画像読み込み処理をカプセル化 |
| `useCanvasCompose.ts` | Canvas APIによる透視変換合成処理。handleLocalComposeを提供 |
| `useTouchFeedback.ts` | 振動・触覚フィードバックのモバイル対応ラッパー |

#### `src/utils/` - ユーティリティ関数

| ファイル名 | 概要 |
|-----------|------|
| `screenDetection.ts` | 黒フレーム囲み画面領域検出。detectDeviceScreens、calculateBezelScore等 |
| `perspectiveTransform.ts` | 4点変換行列計算とCanvas描画。drawPerspectiveImage |
| `presetParser.ts` | プリセットファイル名から属性抽出。parsePresetFilename |
| `mobileFeatures.ts` | モバイルAPI統合。saveImageToDevice、vibrate、hapticFeedback、callNative |
| `imageUtils.ts` | 画像リサイズ、フォーマット変換、dataURL変換等のヘルパー |
| `colorUtils.ts` | RGB→輝度変換、色空間変換、閾値判定 |

#### `src/constants/` - 定数定義

| ファイル名 | 概要 |
|-----------|------|
| `deviceColors.ts` | デバイス識別色定義。DEVICE_FILL_COLORS、DEVICE_COLOR_ORDER |
| `outputSizes.ts` | 出力サイズ定義。OUTPUT_ASPECT_RATIOS（6種類） |
| `detectionParams.ts` | 検出パラメータデフォルト値。luminanceThreshold、minBezelScore等 |
| `apiEndpoints.ts` | API URL、認証ヘッダー、モデル名定義 |

#### `src/types/` - 型定義

| ファイル名 | 概要 |
|-----------|------|
| `preset.ts` | PresetImage、PresetAspectRatio、DeviceType、ColorTone |
| `region.ts` | ScreenRegion、Point、Bounds、TransformMatrix |
| `editor.ts` | EditorState、ComposeOptions、UploadState |
| `api.ts` | NanoBananaRequest、Seedream4Request、APIResponse |

#### `public/mockup/` - モックアップテンプレート画像

| ディレクトリ | 概要 |
|-------------|------|
| `1x1/` | 1:1 アスペクト比のテンプレート画像 |
| `3x4/` | 3:4 アスペクト比のテンプレート画像 |
| `4x5/` | 4:5 アスペクト比のテンプレート画像 |
| `8x9/` | 8:9 アスペクト比のテンプレート画像 |
| `9x16/` | 9:16 アスペクト比のテンプレート画像 |
| `16x9/` | 16:9 アスペクト比のテンプレート画像 |

※ ユーザーがアップロードするコンテンツ画像はファイルとして保存せず、クライアント側メモリで保持

#### ルートファイル

| ファイル名 | 概要 |
|-----------|------|
| `index.html` | HTMLエントリーポイント。`/src/main.tsx`をモジュールとして読み込み |
| `package.json` | npm依存関係、スクリプト（dev/build/preview）定義 |
| `tailwind.config.js` | Tailwind CSS設定。モバイルブレークポイント、セーフエリア、タッチターゲット |
| `vite.config.ts` | Viteビルド設定。@youware/vite-plugin-react使用 |
| `tsconfig.json` | TypeScriptコンパイラ設定 |
| `YOUWARE.md` | YouWareプラットフォーム仕様・制約の説明 |
| `yw_manifest.json` | YouWareマニフェスト。プロジェクトタイプ、AI設定等 |
| `CLAUDE.md` | Claude Code用ガイダンス（本ファイル） |
