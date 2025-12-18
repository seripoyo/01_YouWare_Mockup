export type KeyboardDetectionMethod = 'black' | 'midTone' | 'pattern' | 'frame-extension';

export interface KeyboardMetrics {
  detected: boolean;
  blackRatio?: number;
  midToneRatio?: number;
  whiteRatio?: number;
  method?: KeyboardDetectionMethod;
  region?: string;
}

export interface FrameKeyboardMetrics extends KeyboardMetrics {
  keyboardAreaHeight?: number;
  expandedHeight?: number;
}

export interface NotchMetrics {
  detected: boolean;
  blackRatio?: number;
  consecutiveRows?: number;
  scanArea?: string;
}

export interface MetalSideMetrics {
  detected: boolean;
  metalRatio?: number;
}

export interface DeviceAreaMetrics {
  expandedHeight?: number;
  originalHeight?: number;
  width?: number;
  height?: number;
}

export interface DeviceDetectionMetrics {
  keyboardMetrics?: KeyboardMetrics;
  frameKeyboardMetrics?: FrameKeyboardMetrics;
  notchMetrics?: NotchMetrics;
  metalSideMetrics?: MetalSideMetrics;
  deviceAreaMetrics?: DeviceAreaMetrics;
}

export interface DeviceAnalysisMetrics {
  aspectRatio?: number;
  pixelArea?: number;
  keyboard?: KeyboardMetrics;
  notch?: NotchMetrics;
  metalSide?: MetalSideMetrics;
  frameIntersection?: {
    expandedHeight?: number;
    screenBottomThreshold?: number;
  };
}
