export type DeviceCategory = 'smartphone' | 'tablet' | 'laptop' | 'desktop';
export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5' | '3:4' | '8:9';
export type DeviceIndex = 0 | 1 | 2;

export interface ScreenRectPct {
  xPct: number; // 0..1 left offset relative to frame width
  yPct: number; // 0..1 top offset relative to frame height
  wPct: number; // 0..1 width relative to frame width
  hPct: number; // 0..1 height relative to frame height
}

export interface ScreenRegion {
  id: string;
  name: string;
  rect: ScreenRectPct;
  deviceIndex?: DeviceIndex;
  fillColor?: string;
}

// 各デバイス領域の状態
export interface DeviceRegionState {
  deviceIndex: DeviceIndex;
  rect: ScreenRectPct | null;
  corners: [Point, Point, Point, Point] | null;  // 検出領域の4隅座標を追加
  maskDataUrl: string | null;
  hardMaskUrl: string | null;
  darkOverlayUrl: string | null;
  compositeUrl: string | null;
  imageUrl: string | null;
  imageNatural: { w: number; h: number } | null;
  fillColor: string;
  isActive: boolean;
  // 画像の実際の表示位置情報を追加
  displayPosition?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // デバイスタイプ検出結果を追加
  deviceType?: 'laptop' | 'smartphone' | 'tablet' | 'unknown';
  deviceTypeConfidence?: number;
  detectionReasoning?: string;
  verticalDirection?: '↑' | '→' | '↗' | '↘' | '?';  // 縦方向の矢印（斜め対応）
  shapePattern?: 'rectangle' | 'parallelogram' | 'trapezoid' | 'irregular';  // 形状パターン
}

// Point型を追加
export interface Point {
  x: number;
  y: number;
}

export interface FrameMeta {
  id: string;
  name: string;
  category: DeviceCategory;
  frameImage: string; // absolute public path starting with /assets/
  aspectSupport: AspectRatio[];
  screenRect?: ScreenRectPct; // single-screen legacy
  screenRects?: ScreenRegion[]; // multi-screen (e.g., laptop + phone)
}
