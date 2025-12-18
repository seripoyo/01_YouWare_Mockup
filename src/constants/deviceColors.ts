/**
 * デバイス識別カラーシステム
 * 複数デバイスを視覚的に区別するための色定義
 */

export const DEVICE_FILL_COLORS = {
  primary: '#e5c4be',    // 1台目: ピンクベージュ
  secondary: '#accbde',  // 2台目: ライトブルー
  tertiary: '#ffe2c6',   // 3台目: ピーチ
} as const;

export const DEVICE_COLOR_ORDER = [
  DEVICE_FILL_COLORS.primary,
  DEVICE_FILL_COLORS.secondary,
  DEVICE_FILL_COLORS.tertiary,
] as const;

export type DeviceIndex = 0 | 1 | 2;

/**
 * デバイスインデックスから対応する色を取得
 */
export function getDeviceColor(index: DeviceIndex): string {
  return DEVICE_COLOR_ORDER[index];
}

/**
 * 色からデバイスインデックスを取得
 */
export function getDeviceIndexFromColor(color: string): DeviceIndex | null {
  const index = DEVICE_COLOR_ORDER.indexOf(color as any);
  if (index === -1) return null;
  return index as DeviceIndex;
}