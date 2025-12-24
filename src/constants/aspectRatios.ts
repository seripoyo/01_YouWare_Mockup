/**
 * アスペクト比切り抜き機能用の定数定義
 */

export interface AspectRatioOption {
  label: string;           // "1:1", "4:5" など
  ratio: number;           // 幅/高さの比率
  minWidth: number;        // 必要最低幅
  minHeight: number;       // 必要最低高さ
  platforms: string[];     // 対応プラットフォーム
}

export interface CropRect {
  x: number;      // 画像座標系でのX位置
  y: number;      // 画像座標系でのY位置
  width: number;  // 画像座標系での幅
  height: number; // 画像座標系での高さ
}

/**
 * 対応アスペクト比一覧
 * よく使用される順に並べている
 */
export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  // 正方形
  { label: "1:1", ratio: 1, minWidth: 1200, minHeight: 1200, platforms: ["Instagram", "X", "TikTok", "Threads", "Facebook", "LinkedIn"] },

  // 縦長（人気順）
  { label: "4:5", ratio: 0.8, minWidth: 1080, minHeight: 1350, platforms: ["Instagram", "Threads", "Facebook", "LinkedIn"] },
  { label: "9:16", ratio: 0.5625, minWidth: 1080, minHeight: 1920, platforms: ["Instagram", "TikTok"] },
  { label: "3:4", ratio: 0.75, minWidth: 1080, minHeight: 1440, platforms: ["Instagram", "X"] },
  { label: "8:9", ratio: 0.889, minWidth: 1200, minHeight: 1350, platforms: ["X"] },
  { label: "2:3", ratio: 0.667, minWidth: 853, minHeight: 1280, platforms: ["Facebook", "LinkedIn"] },
  { label: "1:2", ratio: 0.5, minWidth: 720, minHeight: 1440, platforms: ["Facebook", "LinkedIn"] },

  // 横長（人気順）
  { label: "16:9", ratio: 1.778, minWidth: 1200, minHeight: 675, platforms: ["X", "TikTok"] },
  { label: "4:3", ratio: 1.333, minWidth: 1080, minHeight: 810, platforms: ["Threads"] },
  { label: "5:4", ratio: 1.25, minWidth: 800, minHeight: 640, platforms: ["Facebook", "LinkedIn"] },
  { label: "3:2", ratio: 1.5, minWidth: 1280, minHeight: 853, platforms: ["Facebook", "LinkedIn"] },
  { label: "2:1", ratio: 2, minWidth: 1440, minHeight: 720, platforms: ["Facebook", "LinkedIn"] },
];

/**
 * デフォルトのアスペクト比（1:1）
 */
export const DEFAULT_ASPECT_RATIO = ASPECT_RATIO_OPTIONS[0];

/**
 * 画像サイズに基づいて初期の切り抜き領域を計算
 * @param imageWidth 画像の幅
 * @param imageHeight 画像の高さ
 * @param aspectRatio 選択されたアスペクト比
 * @returns 切り抜き領域
 */
export function calculateInitialCropRect(
  imageWidth: number,
  imageHeight: number,
  aspectRatio: AspectRatioOption
): CropRect {
  const ratio = aspectRatio.ratio;
  const margin = 0.85; // 画像の85%を使用

  let cropWidth: number;
  let cropHeight: number;

  // 画像のアスペクト比と比較して、収まる最大サイズを計算
  const imageRatio = imageWidth / imageHeight;

  if (imageRatio > ratio) {
    // 画像が選択比率より横長 → 高さを基準にする
    cropHeight = imageHeight * margin;
    cropWidth = cropHeight * ratio;
  } else {
    // 画像が選択比率より縦長 → 幅を基準にする
    cropWidth = imageWidth * margin;
    cropHeight = cropWidth / ratio;
  }

  // 画像境界内に収まるように調整
  if (cropWidth > imageWidth) {
    cropWidth = imageWidth * margin;
    cropHeight = cropWidth / ratio;
  }
  if (cropHeight > imageHeight) {
    cropHeight = imageHeight * margin;
    cropWidth = cropHeight * ratio;
  }

  // 中央に配置
  const x = (imageWidth - cropWidth) / 2;
  const y = (imageHeight - cropHeight) / 2;

  return { x, y, width: cropWidth, height: cropHeight };
}

/**
 * 切り抜き領域を画像境界内に制限
 */
export function constrainCropRect(
  cropRect: CropRect,
  imageWidth: number,
  imageHeight: number
): CropRect {
  let { x, y, width, height } = cropRect;

  // 最小サイズを保証
  const minSize = 50;
  width = Math.max(minSize, width);
  height = Math.max(minSize, height);

  // 画像境界内に制限
  x = Math.max(0, Math.min(imageWidth - width, x));
  y = Math.max(0, Math.min(imageHeight - height, y));

  // サイズが画像を超える場合は調整
  if (x + width > imageWidth) {
    width = imageWidth - x;
  }
  if (y + height > imageHeight) {
    height = imageHeight - y;
  }

  return { x, y, width, height };
}
