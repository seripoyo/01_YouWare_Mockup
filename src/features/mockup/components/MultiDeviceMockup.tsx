import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import type { AspectRatio, FrameMeta, ScreenRectPct, DeviceIndex, DeviceRegionState, Point } from '../types/frame';
import { frames } from '../data/frames';
import { containSize, coverSize, coverSizeWithBleed, getOptimalBleedPercent } from '../utils/fit';
import { DEVICE_COLOR_ORDER, getDeviceColor } from '../../../constants/deviceColors';
import DebugButton from '../../../components/DebugButton';
import { DebugPanel } from '../../../components/DebugPanel';
import { EnhancedDebugPanel } from '../../../components/EnhancedDebugPanel';
import { analyzeDeviceType, analyzeDeviceLayout } from '../../../utils/deviceTypeAnalyzer';
import {
  detectWhiteMargins,
  analyzeDeviceOrientation,
  type WhiteMarginAnalysis,
  type DeviceOrientationAnalysis
} from '../utils/debugAnalysis';
import {
  getOrientation,
  getDeviceAngle,
  isOrientationMatched,
  getCornerRadius,
  generateDeviceDebugInfo,
  detectNotchOrientation,
  type DeviceDebugInfo
} from '../utils/deviceOrientation';
import {
  logCoordinateTransform,
  checkMaskContentAlignment,
  generateDebugReport
} from '../utils/debugVisualization';
import {
  detectDeviceType,
  detectDeviceTypeFromRegion,
  detectDeviceVerticalDirection,
  determineDeviceOrientation,
  getDeviceDisplayName,
  getOptimalBleedForDevice,
  type DeviceType
} from '../utils/deviceTypeDetection';

function aspectToCss(aspect: AspectRatio) {
  switch (aspect) {
    case '9:16':
      return '9 / 16';
    case '16:9':
      return '16 / 9';
    case '1:1':
      return '1 / 1';
    case '4:5':
      return '4 / 5';
    case '3:4':
      return '3 / 4';
    case '8:9':
      return '8 / 9';
    default:
      return '1 / 1';
  }
}

function isWhitePixel(r: number, g: number, b: number, a: number) {
  const thr = 240;
  return a > 200 && r >= thr && g >= thr && b >= thr;
}

// マスクを指定ピクセル分拡張する関数
function expandMask(imageData: ImageData, expandPixels: number): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const src = imageData.data;
  const output = new ImageData(width, height);
  const dst = output.data;

  console.log(`🔧 expandMask called: ${width}x${height}, expanding by ${expandPixels}px`);

  // 初期化：元データをコピー
  for (let i = 0; i < src.length; i++) {
    dst[i] = src[i];
  }

  let expandedPixelCount = 0;
  let whitePixelCount = 0;

  // 拡張処理：白い領域を広げる
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const luminance = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;

      // 白いピクセルの場合、周囲を白くする
      if (luminance > 200) {
        whitePixelCount++;
        for (let dy = -expandPixels; dy <= expandPixels; dy++) {
          for (let dx = -expandPixels; dx <= expandPixels; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            // 境界チェック
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              // 円形の拡張（よりスムーズな結果）
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= expandPixels) {
                const nidx = (ny * width + nx) * 4;
                // 元が黒でない場合のみ白くする（黒フレームは保護）
                const origLum = (src[nidx] + src[nidx + 1] + src[nidx + 2]) / 3;
                if (origLum > 50) {  // 完全に黒い部分は拡張しない
                  // 元のピクセルが白でない場合のみカウント
                  if (dst[nidx] !== 255 || dst[nidx + 1] !== 255 || dst[nidx + 2] !== 255) {
                    expandedPixelCount++;
                  }
                  dst[nidx] = 255;
                  dst[nidx + 1] = 255;
                  dst[nidx + 2] = 255;
                  dst[nidx + 3] = 255;
                }
              }
            }
          }
        }
      }
    }
  }

  console.log(`🔧 expandMask complete: ${whitePixelCount} white pixels found, ${expandedPixelCount} pixels expanded`);

  return output;
}

function findNearestWhite(x: number, y: number, data: Uint8ClampedArray, w: number, h: number, maxR = 6) {
  let idx = (y * w + x) * 4;
  if (isWhitePixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) return { x, y };

  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      const dx = r - Math.abs(dy);
      const tryPoints = [
        { px: x - dx, py: y + dy },
        { px: x + dx, py: y + dy },
      ];
      for (const { px, py } of tryPoints) {
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const i = (py * w + px) * 4;
        if (isWhitePixel(data[i], data[i + 1], data[i + 2], data[i + 3])) {
          return { x: px, y: py };
        }
      }
    }
  }
  return null;
}

interface MultiDeviceMockupProps {
  initialMockup?: import("../gallery/types").MockupGalleryItem | null;
}

export default function MultiDeviceMockup({ initialMockup }: MultiDeviceMockupProps = {}) {
  const [selectedFrame, setSelectedFrame] = useState<FrameMeta | null>(null);
  const [aspect, setAspect] = useState<AspectRatio>('9:16');
  // Coverモードのみを使用
  const fitMode = 'cover' as const;
  const [showOverlay, setShowOverlay] = useState<boolean>(false);
  const [frameNatural, setFrameNatural] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 800, h: 800 });
  const [fillEnabled, setFillEnabled] = useState<boolean>(true);
  const [feather, setFeather] = useState<number>(0); // エッジを明確にするため0に設定
  const [editedFrameUrl, setEditedFrameUrl] = useState<string | null>(null);
  const [isEditingFrame, setIsEditingFrame] = useState<boolean>(false);
  const [debugMode, setDebugMode] = useState<boolean>(false); // デバッグモードをOFFに
  const [whiteMarginAnalyses, setWhiteMarginAnalyses] = useState<WhiteMarginAnalysis[]>([]);
  const [orientationAnalyses, setOrientationAnalyses] = useState<DeviceOrientationAnalysis[]>([]);

  // 複数デバイス対応の状態管理
  const [deviceRegions, setDeviceRegions] = useState<DeviceRegionState[]>([]);
  const [activeDeviceIndex, setActiveDeviceIndex] = useState<DeviceIndex | null>(null);
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState<DeviceIndex | null>(null); // クリックされたデバイスを追跡
  const [imageUrls, setImageUrls] = useState<(string | null)[]>([null, null, null]);
  const [imageKeys, setImageKeys] = useState<number[]>([0, 0, 0]);

  const containerRef = useRef<HTMLDivElement>(null);
  const debugLogRef = useRef<string[]>([]);
  const deviceDebugInfoRef = useRef<DeviceDebugInfo[]>([]);
  const imageUrlsRef = useRef<(string | null)[]>([null, null, null]);

  const frameUrl = useMemo(() => (selectedFrame ? (editedFrameUrl ?? selectedFrame.frameImage) : null), [selectedFrame, editedFrameUrl]);

  // Canvas refs
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenImageDataRef = useRef<ImageData | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastMasksRef = useRef<Map<DeviceIndex, { rx: number; ry: number; rw: number; rh: number; mask: Uint8Array }>>(new Map());

  // デバイス領域の初期化
  useEffect(() => {
    const newRegions: DeviceRegionState[] = [];
    for (let i = 0; i < 3; i++) {
      newRegions.push({
        deviceIndex: i as DeviceIndex,
        rect: null,
        corners: null,  // 4隅座標を初期化
        maskDataUrl: null,
        hardMaskUrl: null,
        darkOverlayUrl: null,
        compositeUrl: null,
        imageUrl: null,
        imageNatural: null,
        fillColor: getDeviceColor(i as DeviceIndex),
        isActive: false,
      });
    }
    setDeviceRegions(newRegions);
  }, []);

  // initialMockup が変更されたときにフレームを設定
  useEffect(() => {
    if (initialMockup) {
      // アスペクト比を設定
      const aspectMap: Record<string, AspectRatio> = {
        '1:1': '1:1',
        '4:5': '4:5',
        '9:16': '9:16',
        '16:9': '16:9',
      };
      const mappedAspect = aspectMap[initialMockup.aspectRatio] || '9:16';
      setAspect(mappedAspect);

      // フレームを作成して設定
      const newFrame: FrameMeta = {
        id: initialMockup.id,
        name: initialMockup.displayName,
        category: 'smartphone',
        frameImage: initialMockup.publicPath,
        screen: { type: 'rect', xPct: 10, yPct: 10, wPct: 80, hPct: 80 },
        supports: [mappedAspect],
      };
      setSelectedFrame(newFrame);
    }
  }, [initialMockup]);

  useLayoutEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const w = Math.min(window.innerWidth * 0.9, 800);
      const [a, b] = aspect.split(':').map(Number);
      const h = w * (b / a);
      setContainerSize({ w, h });
      debugLogRef.current.push(`container-size: ${w}x${h}`);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [aspect]);

  useEffect(() => {
    // imageUrlsが変更されたときにrefも更新
    imageUrlsRef.current = imageUrls;
  }, [imageUrls]);

  useEffect(() => {
    // コンポーネントがアンマウントされる時だけURLをrevoke
    return () => {
      imageUrlsRef.current.forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  // フレーム切り替え時に画像とエリア判定をクリア
  useEffect(() => {
    // 初回レンダリング時はスキップ
    if (!selectedFrame) return;

    // すべてのデータをリセット（エリア判定も含む）
    setDeviceRegions(prev => prev.map(region => ({
      ...region,
      rect: null,           // エリア判定もクリア
      corners: null,        // 4隅座標もクリア
      maskDataUrl: null,
      hardMaskUrl: null,
      darkOverlayUrl: null,
      compositeUrl: null,
      imageUrl: null,
      imageNatural: null,
      isActive: false,      // アクティブ状態もリセット
    })));

    // 画像URLsもクリア
    setImageUrls([null, null, null]);

    // マスクデータもクリア
    lastMasksRef.current.clear();

    // オーバーレイキャンバスもクリア
    const overlay = overlayCanvasRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
      }
    }

    debugLogRef.current.push('frame-changed-all-cleared');
  }, [selectedFrame]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, deviceIndex: DeviceIndex) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);

    // 古いURLを取得
    let oldUrl: string | null = null;
    const currentRegion = deviceRegions[deviceIndex];
    if (currentRegion && currentRegion.imageUrl) {
      oldUrl = currentRegion.imageUrl;
    }

    // imageUrls配列も更新（互換性のため）
    const newUrls = [...imageUrls];
    newUrls[deviceIndex] = url;
    setImageUrls(newUrls);

    const probe = new Image();
    probe.onload = () => {
      console.log(`🎨 Device ${deviceIndex} - Image loaded:`, {
        width: probe.naturalWidth,
        height: probe.naturalHeight,
        url: url.substring(0, 50) + '...'
      });

      setDeviceRegions(prev => {
        const updated = prev.map((region, idx) => {
          if (idx === deviceIndex) {
            // 画像の自然サイズを設定し、imageUrlも更新
            const updatedRegion = {
              ...region,
              imageUrl: url,
              imageNatural: { w: probe.naturalWidth, h: probe.naturalHeight }
            };
            console.log(`✅ Device ${deviceIndex} - Region updated:`, {
              hasImageUrl: !!updatedRegion.imageUrl,
              hasImageNatural: !!updatedRegion.imageNatural,
              imageNatural: updatedRegion.imageNatural
            });
            return updatedRegion;
          }
          return region;
        });
        return updated;
      });

      // 古いURLは画像が読み込まれてからrevoke（タイミングを遅らせる）
      setTimeout(() => {
        if (oldUrl && oldUrl !== url) {
          URL.revokeObjectURL(oldUrl);
          console.log(`🗑️ Device ${deviceIndex} - Old URL revoked`);
        }
      }, 100);

      debugLogRef.current.push(`device-${deviceIndex}-upload: ${probe.naturalWidth}x${probe.naturalHeight}`);
    };

    probe.onerror = () => {
      console.error(`❌ Device ${deviceIndex} - Failed to load image`);
    };

    probe.src = url;

    const newKeys = [...imageKeys];
    newKeys[deviceIndex] = (newKeys[deviceIndex] || 0) + 1;
    setImageKeys(newKeys);

    e.target.value = '';
    debugLogRef.current.push(`device-${deviceIndex}-image-changed`);
  };

  const aspectCss = useMemo(() => aspectToCss(aspect), [aspect]);

  useEffect(() => {
    if (!selectedFrame || !frameNatural || !frameUrl) return;

    const off = document.createElement('canvas');
    off.width = frameNatural.w;
    off.height = frameNatural.h;
    const offctx = off.getContext('2d');
    if (!offctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = frameUrl;
    img.onload = () => {
      offctx.drawImage(img, 0, 0, frameNatural.w, frameNatural.h);
      const imgData = offctx.getImageData(0, 0, frameNatural.w, frameNatural.h);
      offscreenCanvasRef.current = off;
      offscreenImageDataRef.current = imgData;
      debugLogRef.current.push('offscreen-ready');

      // リセット
      setDeviceRegions(prev => prev.map(region => ({
        ...region,
        rect: null,
        corners: null,  // 4隅座標もクリア
        maskDataUrl: null,
        hardMaskUrl: null,
        darkOverlayUrl: null,
        compositeUrl: null,
      })));
      lastMasksRef.current.clear();
    };

    const overlay = overlayCanvasRef.current;
    if (overlay) {
      overlay.width = frameNatural.w;
      overlay.height = frameNatural.h;
      const ctx = overlay.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
      }
    }
  }, [selectedFrame, frameNatural, frameUrl]);

  const drawMaskIntoOverlay = () => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const octx = overlay.getContext('2d');
    if (!octx) return;

    octx.clearRect(0, 0, overlay.width, overlay.height);

    deviceRegions.forEach((region, idx) => {
      if (region.rect && lastMasksRef.current.has(idx as DeviceIndex)) {
        const maskData = lastMasksRef.current.get(idx as DeviceIndex)!;
        const { rx, ry, rw, rh, mask } = maskData;

        const img = octx.getImageData(rx, ry, rw, rh);
        const d = img.data;

        // デバイスごとの色を使用
        const color = parseInt(region.fillColor.substring(1), 16);
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;

        for (let j = 0; j < rh; j++) {
          for (let i = 0; i < rw; i++) {
            const m = mask[j * rw + i];
            if (m) {
              const p = (j * rw + i) * 4;
              d[p] = r;
              d[p + 1] = g;
              d[p + 2] = b;
              d[p + 3] = 0xFF;
            }
          }
        }
        octx.putImageData(img, rx, ry);
      }
    });
  };

  const maskToDataUrl = (mask: Uint8Array, rw: number, rh: number, featherPx: number) => {
    const mCan = document.createElement('canvas');
    mCan.width = rw; mCan.height = rh;
    const mctx = mCan.getContext('2d');
    if (!mctx) return null;
    const mImg = mctx.createImageData(rw, rh);
    const md = mImg.data;
    for (let j = 0; j < rh; j++) {
      for (let i = 0; i < rw; i++) {
        const k = j * rw + i;
        const p = k * 4;
        const v = mask[k] ? 255 : 0;
        md[p] = v; md[p+1] = v; md[p+2] = v; md[p+3] = 255;
      }
    }
    mctx.putImageData(mImg, 0, 0);
    if (featherPx > 0) {
      const bCan = document.createElement('canvas');
      bCan.width = rw; bCan.height = rh;
      const bctx = bCan.getContext('2d');
      if (!bctx) return mCan.toDataURL('image/png');
      bctx.filter = `blur(${featherPx}px)`;
      bctx.drawImage(mCan, 0, 0);
      return bCan.toDataURL('image/png');
    }
    return mCan.toDataURL('image/png');
  };

  const findDeviceIndexByPosition = (x: number, y: number): DeviceIndex | null => {
    for (let i = deviceRegions.length - 1; i >= 0; i--) {
      const region = deviceRegions[i];
      if (region.rect && frameNatural) {
        const rx = region.rect.xPct * frameNatural.w;
        const ry = region.rect.yPct * frameNatural.h;
        const rw = region.rect.wPct * frameNatural.w;
        const rh = region.rect.hPct * frameNatural.h;

        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
          return i as DeviceIndex;
        }
      }
    }
    return null;
  };

  const onOverlayClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const overlay = overlayCanvasRef.current;
    const imgData = offscreenImageDataRef.current;
    if (!overlay || !imgData) return;

    const rect = overlay.getBoundingClientRect();
    const sx = overlay.width / rect.width;
    const sy = overlay.height / rect.height;
    let x = Math.floor((e.clientX - rect.left) * sx);
    let y = Math.floor((e.clientY - rect.top) * sy);

    const w = imgData.width;
    const h = imgData.height;
    const data = imgData.data;

    // まず既存の領域内かチェック
    const existingDevice = findDeviceIndexByPosition(x, y);
    if (existingDevice !== null) {
      setActiveDeviceIndex(existingDevice);
      setSelectedDeviceIndex(existingDevice);
      debugLogRef.current.push(`switched-to-device-${existingDevice}`);

      // デバッグモード時は簡易分析データを生成
      if (debugMode) {
        const region = deviceRegions[existingDevice];
        console.log(`🖱️ Device ${existingDevice + 1} clicked via overlay - showing info immediately`);

        if (region?.rect) {
          const aspectRatio = region.rect.wPct / region.rect.hPct;
          const deviceType = aspectRatio > 1.3 ? 'laptop' :
                           aspectRatio < 0.7 ? 'smartphone' : 'tablet';

          const simpleAnalysis: DeviceOrientationAnalysis = {
            deviceIndex: existingDevice,
            deviceType: deviceType,
            deviceRotation: 0,
            majorAxisAngle: 0,
            notchPosition: { x: 0, y: 0, angle: 0 },
            recommendedImageRotation: 0,
            analysisDetails: {
              aspectRatio: aspectRatio,
              isPortrait: aspectRatio < 1,
              isLandscape: aspectRatio > 1,
              isDiagonal: false
            },
            confidence: 0.5
          };

          setOrientationAnalyses(prev => {
            const existing = prev.filter(a => a.deviceIndex !== existingDevice);
            return [...existing, simpleAnalysis];
          });
        }
      }

      return;
    }

    // 新しいデバイス領域を検出
    const availableIndex = deviceRegions.findIndex(r => !r.isActive);
    if (availableIndex === -1) {
      debugLogRef.current.push('max-devices-reached');
      return;
    }

    const seed = findNearestWhite(x, y, data, w, h, 6);
    if (!seed) {
      debugLogRef.current.push(`no-white-nearby @${x},${y}`);
      return;
    }
    x = seed.x; y = seed.y;

    // BFS flood fill
    const visited = new Uint8Array(w * h);
    const stack: number[] = [y * w + x];
    visited[y * w + x] = 1;

    let minX = x, minY = y, maxX = x, maxY = y;

    while (stack.length) {
      const p = stack.pop() as number;
      const py = Math.floor(p / w);
      const px = p % w;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;

      const tryPush = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
        const pos = ny * w + nx;
        if (visited[pos]) return;
        const i = pos * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (isWhitePixel(r, g, b, a)) {
          visited[pos] = 1;
          stack.push(pos);
        }
      };

      tryPush(px - 1, py);
      tryPush(px + 1, py);
      tryPush(px, py - 1);
      tryPush(px, py + 1);
    }

    const rx = minX;
    const ry = minY;
    const rw = Math.max(1, maxX - minX + 1);
    const rh = Math.max(1, maxY - minY + 1);

    // 検出領域の4隅座標を取得（左上、右上、右下、左下）
    const corners: [Point, Point, Point, Point] = [
      { x: rx, y: ry },           // 左上
      { x: rx + rw, y: ry },      // 右上
      { x: rx + rw, y: ry + rh }, // 右下
      { x: rx, y: ry + rh }       // 左下
    ];

    // マスク生成
    const baseMask = new Uint8Array(rw * rh);
    for (let j = 0; j < rh; j++) {
      for (let i = 0; i < rw; i++) {
        const pos = (ry + j) * w + (rx + i);
        baseMask[j * rw + i] = visited[pos] ? 1 : 0;
      }
    }

    // 穴埋め処理
    const seen = new Uint8Array(rw * rh);
    const q: number[] = [];
    const enqueueIf = (ix: number, iy: number) => {
      if (ix < 0 || iy < 0 || ix >= rw || iy >= rh) return;
      const p = iy * rw + ix;
      if (seen[p]) return;
      if (baseMask[p] === 0) {
        seen[p] = 1;
        q.push(p);
      }
    };

    for (let i = 0; i < rw; i++) { enqueueIf(i, 0); enqueueIf(i, rh - 1); }
    for (let j = 0; j < rh; j++) { enqueueIf(0, j); enqueueIf(rw - 1, j); }

    while (q.length) {
      const p = q.shift() as number;
      const py = Math.floor(p / rw);
      const px = p % rw;
      const pushN = (ix: number, iy: number) => {
        if (ix < 0 || iy < 0 || ix >= rw || iy >= rh) return;
        const np = iy * rw + ix;
        if (seen[np]) return;
        if (baseMask[np] === 0) { seen[np] = 1; q.push(np); }
      };
      pushN(px - 1, py);
      pushN(px + 1, py);
      pushN(px, py - 1);
      pushN(px, py + 1);
    }

    const finalMask = new Uint8Array(rw * rh);
    const holeDarkMask = new Uint8Array(rw * rh);
    for (let j = 0; j < rh; j++) {
      for (let i = 0; i < rw; i++) {
        const k = j * rw + i;
        if (baseMask[k]) { finalMask[k] = 1; continue; }
        const isHole = seen[k] === 0;
        const gx = rx + i;
        const gy = ry + j;
        const gi = (gy * w + gx) * 4;
        const r = data[gi], g = data[gi + 1], b = data[gi + 2], a = data[gi + 3];
        const whiteish = isWhitePixel(r, g, b, a);
        if (isHole) {
          finalMask[k] = whiteish ? 1 : 0;
          holeDarkMask[k] = !whiteish && a > 0 ? 1 : 0;
        } else {
          finalMask[k] = 0;
        }
      }
    }

    // 新しいデバイス領域として保存
    const deviceIndex = availableIndex as DeviceIndex;
    lastMasksRef.current.set(deviceIndex, { rx, ry, rw, rh, mask: finalMask });

    const mUrl = maskToDataUrl(finalMask, rw, rh, feather);
    const hUrl = maskToDataUrl(finalMask, rw, rh, 0);

    // Dark overlay
    const frameData = offscreenImageDataRef.current;
    let darkUrl: string | null = null;
    if (frameData) {
      const dCan = document.createElement('canvas');
      dCan.width = rw; dCan.height = rh;
      const dctx = dCan.getContext('2d');
      if (dctx) {
        const out = dctx.createImageData(rw, rh);
        const od = out.data;
        for (let j = 0; j < rh; j++) {
          for (let i = 0; i < rw; i++) {
            const k = j * rw + i;
            if (holeDarkMask[k]) {
              const gx = rx + i;
              const gy = ry + j;
              const gi = (gy * frameData.width + gx) * 4;
              const r = frameData.data[gi], g = frameData.data[gi + 1], b = frameData.data[gi + 2], a = frameData.data[gi + 3];
              const p = k * 4;
              od[p] = r; od[p+1] = g; od[p+2] = b; od[p+3] = a;
            }
          }
        }
        dctx.putImageData(out, 0, 0);
        darkUrl = dCan.toDataURL('image/png');
      }
    }

    const newRect: ScreenRectPct = {
      xPct: rx / w,
      yPct: ry / h,
      wPct: rw / w,
      hPct: rh / h,
    };

    // エリア選定時にデバイスタイプ分析を実行（corners情報も渡す）
    const deviceAnalysis = analyzeDeviceType(newRect, undefined, undefined, { corners });

    console.log(`\n🔍 Device ${deviceIndex + 1} エリア選定時の分析:`);
    console.log(`デバイスタイプ: ${deviceAnalysis.deviceType}`);
    console.log(`信頼度: ${(deviceAnalysis.confidence * 100).toFixed(0)}%`);
    console.log(`判定理由: ${deviceAnalysis.reasoning.primary}`);
    console.log(`縦方向: ${deviceAnalysis.verticalDirection}`);
    console.log(`形状パターン: ${deviceAnalysis.shapePattern || '検出なし'}`);

    setDeviceRegions(prev => prev.map((region, idx) =>
      idx === deviceIndex
        ? {
            ...region,
            rect: newRect,
            corners,
            maskDataUrl: mUrl,
            hardMaskUrl: hUrl,
            darkOverlayUrl: darkUrl,
            isActive: true,
            // デバイスタイプ情報を追加
            deviceType: deviceAnalysis.deviceType,
            deviceTypeConfidence: deviceAnalysis.confidence,
            detectionReasoning: deviceAnalysis.reasoning.primary,
            verticalDirection: deviceAnalysis.verticalDirection,
            shapePattern: deviceAnalysis.shapePattern
          }
        : region
    ));
    setActiveDeviceIndex(deviceIndex);

    drawMaskIntoOverlay();
    debugLogRef.current.push(`device-${deviceIndex}-rect: ${JSON.stringify(newRect)}`);
  };

  const clearOverlay = () => {
    // 画像とコンポジットのみをクリア、エリア判定（rect）とオーバーレイ表示は残す
    setDeviceRegions(prev => prev.map(region => ({
      ...region,
      // rect は残す（エリア判定を保持）
      // maskDataUrl も残す（塗りつぶしエリアを保持）
      // hardMaskUrl も残す
      // darkOverlayUrl も残す
      compositeUrl: null,  // 合成画像のみクリア
      imageUrl: null,      // アップロード画像のみクリア
      imageNatural: null,  // 画像サイズ情報のみクリア
      // isActive は保持
    })));

    // 画像URLsもクリア
    setImageUrls([null, null, null]);

    // オーバーレイの表示は維持（再描画）
    drawMaskIntoOverlay();

    debugLogRef.current.push('images-cleared-keeping-detection');
  };

  const clearDevice = (deviceIndex: DeviceIndex) => {
    // 画像のみクリア、エリア判定は保持
    setDeviceRegions(prev => prev.map((region, idx) =>
      idx === deviceIndex
        ? {
            ...region,
            // rect, maskDataUrl, hardMaskUrl, darkOverlayUrl, isActive は保持
            compositeUrl: null,   // 合成画像のみクリア
            imageUrl: null,       // アップロード画像のみクリア
            imageNatural: null    // 画像サイズ情報のみクリア
          }
        : region
    ));

    // 該当デバイスの画像URLもクリア
    setImageUrls(prev => {
      const newUrls = [...prev];
      newUrls[deviceIndex] = null;
      return newUrls;
    });

    drawMaskIntoOverlay();
    debugLogRef.current.push(`device-${deviceIndex}-image-cleared`);
  };

  // Re-generate masks when feather changes
  useEffect(() => {
    drawMaskIntoOverlay();
  }, [deviceRegions]);

  useEffect(() => {
    lastMasksRef.current.forEach((maskData, deviceIndex) => {
      const { rw: maskWidth, rh: maskHeight, mask } = maskData;
      const url = maskToDataUrl(mask, maskWidth, maskHeight, feather);
      if (url) {
        setDeviceRegions(prev => prev.map((region, idx) =>
          idx === deviceIndex ? { ...region, maskDataUrl: url } : region
        ));
      }
    });
  }, [feather]);

  // Composite images for each device
  useEffect(() => {
    console.log('🔄 ==========  Composite useEffect triggered ==========');
    console.log('Device regions:', deviceRegions);
    console.log('Debug mode:', debugMode);

    // デバイスが存在しない場合は早期リターン
    if (deviceRegions.length === 0) {
      console.log('⚠️ No device regions found. Exiting.');
      return;
    }

    // debugModeを現在の値として取得
    const currentDebugMode = debugMode;

    let isCancelled = false;

    // 実際に存在するデバイスのみを処理
    deviceRegions.forEach((region, deviceIndex) => {
      if (!region) {
        console.log(`⚠️ Device ${deviceIndex}: Region is null`);
        return;
      }

      // deviceRegion内のimageUrlを使用
      const imageUrl = region.imageUrl;

      console.log(`🔧 Processing Device ${region.deviceIndex}:`, {
        hasImageUrl: !!imageUrl,
        hasHardMaskUrl: !!region.hardMaskUrl,
        hasImageNatural: !!region.imageNatural,
        hasRect: !!region.rect,
        imageUrl: imageUrl,
        // デバッグ用に詳細情報を追加
        rectDetails: region.rect ? {
          xPct: region.rect.xPct.toFixed(3),
          yPct: region.rect.yPct.toFixed(3),
          wPct: region.rect.wPct.toFixed(3),
          hPct: region.rect.hPct.toFixed(3)
        } : null,
        isActive: region.isActive
      });

      (async () => {
        if (isCancelled) return;
        const last = lastMasksRef.current.get(region.deviceIndex as DeviceIndex);

        console.log(`📋 Device ${region.deviceIndex} Prerequisites Check:`, {
          last: !!last,
          hardMaskUrl: !!region.hardMaskUrl,
          imageUrl: !!imageUrl,
          imageNatural: !!region.imageNatural,
          rect: !!region.rect,
          frameNatural: !!frameNatural
        });

        // lastMasksRefが空の場合でも、region.rectとframeNaturalがあれば処理を続行
        if (!region.hardMaskUrl || !imageUrl || !region.imageNatural || !region.rect || !frameNatural) {
          console.log(`❌ Device ${region.deviceIndex}: Missing prerequisites. Skipping.`);
          console.log(`   Missing: ${[
            !region.hardMaskUrl ? 'hardMaskUrl' : null,
            !imageUrl ? 'imageUrl' : null,
            !region.imageNatural ? 'imageNatural' : null,
            !region.rect ? 'rect' : null,
            !frameNatural ? 'frameNatural' : null
          ].filter(Boolean).join(', ')}`);
          if (region.compositeUrl) {
            setDeviceRegions(prev => prev.map((r, idx) =>
              idx === deviceIndex ? { ...r, compositeUrl: null } : r
            ));
          }
          return;
        }

        // lastMasksRefが空の場合、region.rectから計算
        let rw: number, rh: number;
        if (last) {
          ({ rw, rh } = last);
        } else {
          // region.rectとframeNaturalから計算
          rw = Math.round(region.rect.wPct * frameNatural.w);
          rh = Math.round(region.rect.hPct * frameNatural.h);
          console.log(`⚠️ Device ${region.deviceIndex}: Using fallback size calculation from rect. rw=${rw}, rh=${rh}`);
        }

        // 表示用のサイズを計算
        let canvasWidth = rw;
        let canvasHeight = rh;

        // frameNaturalが存在する場合、表示サイズに合わせて調整
        if (frameNatural && containerSize) {
          const scale = Math.min(
            containerSize.w / frameNatural.w,
            containerSize.h / frameNatural.h
          );
          const displayWidth = frameNatural.w * scale;
          const displayHeight = frameNatural.h * scale;

          canvasWidth = Math.round(region.rect.wPct * displayWidth);
          canvasHeight = Math.round(region.rect.hPct * displayHeight);
        }

        const comp = document.createElement('canvas');
        comp.width = canvasWidth;
        comp.height = canvasHeight;
        const cctx = comp.getContext('2d');
        if (!cctx) return;

        console.log(`🖼️ Device ${region.deviceIndex}: Loading images...`);
        const up = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.onload = () => {
            console.log(`✅ Device ${region.deviceIndex}: User image loaded`, {
              width: im.width,
              height: im.height,
              src: im.src.substring(0, 50) + '...'
            });
            resolve(im);
          };
          im.onerror = (e) => {
            console.error(`❌ Device ${region.deviceIndex}: Failed to load user image`, e);
            reject(e);
          };
          im.src = imageUrl;
        });
        const mk = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.onload = () => {
            console.log(`✅ Device ${region.deviceIndex}: Mask image loaded`, {
              width: im.width,
              height: im.height,
              src: im.src.substring(0, 50) + '...'
            });
            resolve(im);
          };
          im.onerror = (e) => {
            console.error(`❌ Device ${region.deviceIndex}: Failed to load mask image`, e);
            reject(e);
          };
          im.src = region.hardMaskUrl!;
        });

        // 統合デバッグログ用の情報を収集開始
        const deviceDebugLog: any = {
          deviceIndex: region.deviceIndex,
          canvasSize: { width: canvasWidth, height: canvasHeight },
        };

        // 改良版デバイスタイプ判定
        // フレーム画像全体からデバイス領域を切り出してキーボードを検出
        const tempAnalysisCanvas = document.createElement('canvas');

        // デバイス領域を拡張してキーボード部分も含める
        // 画面領域の下に20%の余白を追加（キーボード検出用）
        const expandedHeight = canvasHeight * 1.3; // 高さを30%拡張
        tempAnalysisCanvas.width = canvasWidth;
        tempAnalysisCanvas.height = expandedHeight;
        const tempAnalysisCtx = tempAnalysisCanvas.getContext('2d', { willReadFrequently: true });

        let deviceAreaData: ImageData | undefined;

        if (tempAnalysisCtx && frameUrl) {
          // フレーム画像から対応する領域を切り出し
          const frameImg = new Image();
          frameImg.src = frameUrl;
          await new Promise((resolve) => {
            frameImg.onload = resolve;
          });

          // デバイス領域の座標を計算（フレーム画像内での位置）
          const frameW = frameImg.width;
          const frameH = frameImg.height;
          const deviceX = region.rect.xPct * frameW;
          const deviceY = region.rect.yPct * frameH;
          const deviceW = region.rect.wPct * frameW;
          const deviceH = region.rect.hPct * frameH;

          // 拡張高さの計算（画像の境界を超えないように）
          const expandedDeviceH = Math.min(deviceH * 1.3, frameH - deviceY);

          // フレーム画像から拡張されたデバイス領域を描画
          tempAnalysisCtx.drawImage(
            frameImg,
            deviceX, deviceY, deviceW, expandedDeviceH,
            0, 0, canvasWidth, expandedHeight
          );

          deviceAreaData = tempAnalysisCtx.getImageData(0, 0, canvasWidth, expandedHeight);

          console.log(`🔍 Device ${region.deviceIndex}: Extended area analysis`, {
            originalHeight: canvasHeight,
            expandedHeight: expandedHeight,
            expandedDeviceH: expandedDeviceH,
            deviceAreaDataSize: deviceAreaData ? `${deviceAreaData.width}x${deviceAreaData.height}` : 'none'
          });
        }

        // フレーム全体のImageDataを取得（キーボード検出用）
        let frameFullImageData: ImageData | undefined;
        if (tempAnalysisCtx && frameUrl) {
          const frameFullCanvas = document.createElement('canvas');
          const frameFullCtx = frameFullCanvas.getContext('2d');
          if (frameFullCtx) {
            const frameImg = new Image();
            frameImg.src = frameUrl;
            await new Promise((resolve) => {
              frameImg.onload = resolve;
            });

            frameFullCanvas.width = frameImg.width;
            frameFullCanvas.height = frameImg.height;
            frameFullCtx.drawImage(frameImg, 0, 0);
            frameFullImageData = frameFullCtx.getImageData(0, 0, frameImg.width, frameImg.height);

            console.log('📷 Frame full image loaded for keyboard detection:', {
              deviceIndex: region.deviceIndex,
              frameSize: `${frameImg.width}x${frameImg.height}`,
              dataSize: frameFullImageData ? `${frameFullImageData.width}x${frameFullImageData.height}` : 'none'
            });
          }
        }

        // 新しいデバイス判定ロジックを使用（フレーム全体のデータも渡す）
        const deviceDetectionResult = detectDeviceTypeFromRegion(
          region.rect,
          { w: containerSize.w, h: containerSize.h },
          deviceAreaData || undefined,
          frameFullImageData || undefined
        );

        const deviceType: string = deviceDetectionResult.type;
        const detectionConfidence = deviceDetectionResult.confidence;
        const hasNotchDetected = deviceDetectionResult.hasNotch;
        const hasKeyboardDetected = deviceDetectionResult.hasKeyboard;
        const aspectRatio = canvasWidth / canvasHeight;  // aspectRatio変数を定義

        const keyboardMetrics = deviceDetectionResult.keyboardMetrics || deviceDetectionResult.frameKeyboardMetrics;
        const notchMetrics = deviceDetectionResult.notchMetrics;
        const metalSideMetrics = deviceDetectionResult.metalSideMetrics;
        const frameMetrics = deviceDetectionResult.frameKeyboardMetrics;
        const deviceAreaMetrics = deviceDetectionResult.deviceAreaMetrics;

        // デバイスの縦方向（矢印の向き）を検出
        const deviceAspectRatio = region.rect.wPct / region.rect.hPct;
        const verticalDirection = detectDeviceVerticalDirection(
          deviceDetectionResult.type,
          deviceAspectRatio
        );
        const verticalArrow = verticalDirection === 'up' ? '↑' :
                              verticalDirection === 'right' ? '→' : '↗';

        // デバッグログに詳細情報を追加
        deviceDebugLog.deviceTypeDetection = {
          type: deviceType,
          displayName: getDeviceDisplayName(deviceDetectionResult.type),
          confidence: `${detectionConfidence.toFixed(1)}%`,
          hasNotch: hasNotchDetected,
          hasKeyboard: hasKeyboardDetected,
          aspectRatio: aspectRatio.toFixed(2),
          visualFeatures: hasKeyboardDetected ? '⌨️ Keyboard detected' : hasNotchDetected ? '📱 Notch detected' : 'None',
          verticalDirection: `${verticalArrow} (${verticalDirection})`,
          metrics: {
            keyboard: keyboardMetrics,
            notch: notchMetrics,
            metalSide: metalSideMetrics,
            frame: frameMetrics,
            deviceArea: deviceAreaMetrics,
          }
        };

        const analysisMetrics: DeviceAnalysisMetrics = {
          aspectRatio,
          pixelArea: (region.rect.wPct * containerSize.w) * (region.rect.hPct * containerSize.h),
          keyboard: keyboardMetrics,
          notch: notchMetrics,
          metalSide: metalSideMetrics,
          frameIntersection: frameMetrics
            ? {
                expandedHeight: frameMetrics.expandedHeight,
                screenBottomThreshold: frameMetrics.keyboardAreaHeight,
              }
            : undefined,
        };

        deviceDebugLog.analysisMetrics = analysisMetrics;
        region.analysisMetrics = analysisMetrics;

        // マスク処理関連のデバッグログ（デバッグモードがONの時のみ）
        if (currentDebugMode) {
          console.log(`🎭 Device ${region.deviceIndex} Mask Processing:`, {
            deviceType: deviceType,
            aspectRatio: aspectRatio.toFixed(2),
            cornerRadius: `${getCornerRadius(canvasWidth, canvasHeight, deviceType)}px`,
            featherStrength: `${feather}px`,
            maskSize: { width: rw, height: rh },
            canvasSize: { width: canvasWidth, height: canvasHeight },
            orientation: getOrientation(canvasWidth, canvasHeight)
          });
        }

        // 実際の領域パーセンテージと期待される座標
        if (frameNatural && region.rect) {
          const scale = Math.min(
            containerSize.w / frameNatural.w,
            containerSize.h / frameNatural.h
          );
          const displayWidth = frameNatural.w * scale;
          const displayHeight = frameNatural.h * scale;
          const offsetX = (containerSize.w - displayWidth) / 2;
          const offsetY = (containerSize.h - displayHeight) / 2;

          const expectedPixels = {
            x: Math.round(offsetX + region.rect.xPct * displayWidth),
            y: Math.round(offsetY + region.rect.yPct * displayHeight),
            width: Math.round(region.rect.wPct * displayWidth),
            height: Math.round(region.rect.hPct * displayHeight)
          };

          if (currentDebugMode) {
            console.log('Expected Pixel Coords:', expectedPixels);
            console.log('Actual Canvas Size:', { width: canvasWidth, height: canvasHeight });
            console.log('Original Detection Size (Natural):', { width: rw, height: rh });

            if (Math.abs(expectedPixels.width - canvasWidth) > 5 || Math.abs(expectedPixels.height - canvasHeight) > 5) {
              console.error('🚨 SIZE MISMATCH DETECTED!');
              console.error('Expected:', expectedPixels.width, 'x', expectedPixels.height);
              console.error('Actual Canvas:', canvasWidth, 'x', canvasHeight);
              console.error('This will cause the image to not fit properly in the designated area!');
            }
          }
        }

        // デバッグ情報を保存
        deviceDebugInfoRef.current[region.deviceIndex] = deviceDebugLog;
        debugLogRef.current.push(`device-${region.deviceIndex}: ${JSON.stringify(deviceDebugLog)}`);

        // ソース画像のサイズを保持
        let sourceImage: HTMLImageElement | HTMLCanvasElement = up;
        let sourceWidth = up.width;
        let sourceHeight = up.height;

        // 検出領域に画像をフィット（coverモードのみ使用）
        // デバイスタイプに応じた最適なブリード値を適用（新しい判定ロジック使用）
        const optimalBleed = getOptimalBleedForDevice(deviceDetectionResult.type);
        const fitRect = coverSizeWithBleed(canvasWidth, canvasHeight, sourceWidth, sourceHeight, optimalBleed);

        // デバッグログに追加
        deviceDebugLog.imageSize = { width: sourceWidth, height: sourceHeight };
        deviceDebugLog.optimalBleed = `${optimalBleed}%`;
        deviceDebugLog.fitMode = 'cover';


        // マスクを使用した正確な画像クリッピング処理
        // 重要: マスクの形状に完全に従って画像を切り抜く

        // ステップ1: 画像を一時キャンバスに描画
        const tempImageCanvas = document.createElement('canvas');
        tempImageCanvas.width = canvasWidth;
        tempImageCanvas.height = canvasHeight;
        const tempImageCtx = tempImageCanvas.getContext('2d', { alpha: true });

        if (tempImageCtx) {
          // 高品質な画像補間設定
          tempImageCtx.imageSmoothingEnabled = true;
          tempImageCtx.imageSmoothingQuality = 'high';

          // 画像を描画（必要に応じて回転）
          tempImageCtx.save();

          // 回転が必要な場合（ノッチ位置による補正）
          let rotationAngle = 0;

          // 新しい向き検出ロジックを使用
          // デバイスタイプに応じた適切な向きを決定
          try {
            rotationAngle = determineDeviceOrientation(
              deviceDetectionResult.type,
              undefined,  // maskDataはオプショナル
              region.rect,
              region.imageNatural ?? undefined
            );

            deviceDebugLog.orientationDetection = {
              deviceType: deviceDetectionResult.type,
              rotationAngle: `${rotationAngle}°`,
              imageAspectRatio: region.imageNatural ? (region.imageNatural.w / region.imageNatural.h).toFixed(2) : 'N/A',
              deviceAspectRatio: (region.rect.wPct / region.rect.hPct).toFixed(2),
              method: deviceDetectionResult.type === 'smartphone' ? 'Portrait orientation check' :
                      deviceDetectionResult.type === 'laptop' ? 'Landscape orientation check' :
                      deviceDetectionResult.type === 'tablet' ? 'Aspect ratio matching' :
                      'Default',
              explanation: rotationAngle === 0 ? 'No rotation needed' :
                          rotationAngle === 180 ? 'Rotate 180°' :
                          rotationAngle === 90 ? 'Rotate 90° clockwise' :
                          rotationAngle === -90 ? 'Rotate 90° counter-clockwise' :
                          'Custom rotation'
            };
          } catch (error) {
            console.error(`❌ Error during orientation detection for Device ${region.deviceIndex}:`, error);
            rotationAngle = 0;
            deviceDebugLog.orientationDetection = {
              error: String(error),
              rotationAngle: '0° (fallback)'
            };
          }

          // 回転処理
          if (rotationAngle !== 0) {
            console.log(`🔄 Device ${region.deviceIndex}: Applying rotation ${rotationAngle}°`);
            // キャンバスの中心を基準に回転
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;

            tempImageCtx.translate(centerX, centerY);
            tempImageCtx.rotate((rotationAngle * Math.PI) / 180);
            tempImageCtx.translate(-centerX, -centerY);

            // 回転後の画像を調整
            const absAngle = Math.abs(rotationAngle);

            if (absAngle === 90 || absAngle === 270) {
              const rotatedFitRect = coverSizeWithBleed(canvasWidth, canvasHeight, sourceHeight, sourceWidth, optimalBleed);
              tempImageCtx.drawImage(sourceImage, rotatedFitRect.left, rotatedFitRect.top, rotatedFitRect.w, rotatedFitRect.h);
              deviceDebugLog.imageRotation = {
                applied: true,
                angle: `${rotationAngle}°`,
                fitRect: rotatedFitRect
              };
            } else if (absAngle === 180) {
              tempImageCtx.drawImage(sourceImage, fitRect.left, fitRect.top, fitRect.w, fitRect.h);
              deviceDebugLog.imageRotation = {
                applied: true,
                angle: '180°',
                fitRect: fitRect
              };
            } else {
              tempImageCtx.drawImage(sourceImage, fitRect.left, fitRect.top, fitRect.w, fitRect.h);
              deviceDebugLog.imageRotation = {
                applied: true,
                angle: `${rotationAngle}° (custom)`,
                fitRect: fitRect
              };
            }
          } else {
            tempImageCtx.drawImage(sourceImage, fitRect.left, fitRect.top, fitRect.w, fitRect.h);
            deviceDebugLog.imageRotation = {
              applied: false,
              reason: 'No rotation needed'
            };
          }

          tempImageCtx.restore();

          // 描画後の確認
          const tempImageData = tempImageCtx.getImageData(0, 0, canvasWidth, canvasHeight);
          let hasImagePixels = false;
          for (let i = 3; i < tempImageData.data.length; i += 4) {
            if (tempImageData.data[i] > 0) {
              hasImagePixels = true;
              break;
            }
          }

          deviceDebugLog.imageDrawing = {
            success: hasImagePixels,
            status: hasImagePixels ? 'Image drawn successfully' : 'No image pixels detected'
          };

          if (!hasImagePixels) {
            console.error(`❌ Device ${region.deviceIndex}: No image pixels in tempImageCanvas after drawing!`);
          }

          // ステップ2: マスクを準備（フェザリング処理も含む）
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = canvasWidth;
          maskCanvas.height = canvasHeight;
          const maskCtx = maskCanvas.getContext('2d', { alpha: true });

          if (maskCtx) {
            // 高品質なマスク処理
            maskCtx.imageSmoothingEnabled = true;
            maskCtx.imageSmoothingQuality = 'high';

            // まずマスクをそのまま描画
            maskCtx.drawImage(mk, 0, 0, mk.width, mk.height, 0, 0, canvasWidth, canvasHeight);

            // マスクデータを取得
            let maskData = maskCtx.getImageData(0, 0, canvasWidth, canvasHeight);

            // マスクを内側に5px拡張（白い隙間を覆うため）
            const expandPixels = 5;

            let expandedMaskData;
            try {
              expandedMaskData = expandMask(maskData, expandPixels);
              if (!expandedMaskData || !expandedMaskData.data) {
                throw new Error('Invalid mask data returned');
              }
              deviceDebugLog.maskExpansion = {
                success: true,
                expandPixels: expandPixels,
                originalSize: { width: maskData.width, height: maskData.height },
                expandedSize: { width: expandedMaskData.width, height: expandedMaskData.height }
              };
            } catch (error) {
              console.error(`❌ expandMask failed for device ${region.deviceIndex}:`, error);
              expandedMaskData = maskData;
              deviceDebugLog.maskExpansion = {
                success: false,
                error: String(error),
                fallback: 'Using original mask data'
              };
            }

            maskCtx.putImageData(expandedMaskData, 0, 0);

            // 拡張後のマスクデータを再取得して黒い部分を透明に変換
            maskData = maskCtx.getImageData(0, 0, canvasWidth, canvasHeight);
            const data = maskData.data;

            // デバッグ用：黒いピクセルのカウント
            let blackPixelCount = 0;
            let whitePixelCount = 0;
            let grayPixelCount = 0;

            // 黒い部分（ノッチ、ダイナミックアイランド）を検出して透明にする
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];

              // 輝度計算（0-255の範囲）
              const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

              // 黒い部分（輝度が低い部分）は完全に透明に
              // 白い部分（輝度が高い部分）は不透明に
              // グレースケールのマスクをアルファチャンネルに変換
              if (luminance < 30) {
                // 完全に黒い部分（ノッチなど）は透明
                data[i + 3] = 0;
                blackPixelCount++;
              } else if (luminance < 240) {
                // グレーの部分は半透明（アンチエイリアス処理）
                data[i + 3] = luminance;
                grayPixelCount++;
              } else {
                // 白い部分は完全に不透明
                data[i + 3] = 255;
                whitePixelCount++;
              }

              // RGB値を白に設定（アルファチャンネルで制御）
              data[i] = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
            }

            // ノッチ/カットアウト情報をデバッグログに追加
            if (blackPixelCount > 0) {
              deviceDebugLog.maskCutout = {
                blackPixels: blackPixelCount,
                whitePixels: whitePixelCount,
                grayPixels: grayPixelCount,
                totalPixels: data.length / 4,
                blackRatio: `${((blackPixelCount / (data.length / 4)) * 100).toFixed(2)}%`,
                hasNotch: blackPixelCount > 100
              };
            }

            // 変換したマスクをキャンバスに戻す
            maskCtx.putImageData(maskData, 0, 0);

            // フェザリング効果が必要な場合
            if (feather > 0) {
              const blurCanvas = document.createElement('canvas');
              blurCanvas.width = canvasWidth;
              blurCanvas.height = canvasHeight;
              const blurCtx = blurCanvas.getContext('2d', { alpha: true });

              if (blurCtx) {
                blurCtx.filter = `blur(${feather}px)`;
                blurCtx.drawImage(maskCanvas, 0, 0);
                maskCtx.clearRect(0, 0, canvasWidth, canvasHeight);
                maskCtx.drawImage(blurCanvas, 0, 0);
              }
            }

            // ステップ3: メインキャンバスをクリアして合成
            cctx.clearRect(0, 0, canvasWidth, canvasHeight);

            // 高品質な合成設定（シャープな境界を保ちつつ、画質を向上）
            cctx.imageSmoothingEnabled = true;
            cctx.imageSmoothingQuality = 'high';
            maskCtx.imageSmoothingEnabled = false;

            // 画像を描画
            cctx.drawImage(tempImageCanvas, 0, 0);

            // マスクでクリッピング
            cctx.globalCompositeOperation = 'destination-in';
            cctx.drawImage(maskCanvas, 0, 0);
            cctx.globalCompositeOperation = 'source-over';

            // 画像補間を元に戻す
            cctx.imageSmoothingEnabled = true;

            // 最終確認
            const finalCheckData = cctx.getImageData(0, 0, canvasWidth, canvasHeight);
            let hasFinalPixels = false;
            for (let i = 3; i < finalCheckData.data.length; i += 4) {
              if (finalCheckData.data[i] > 0) {
                hasFinalPixels = true;
                break;
              }
            }

            deviceDebugLog.maskApplication = {
              success: hasFinalPixels,
              maskSize: { width: mk.width, height: mk.height },
              feather: `${feather}px`,
              compositeOperation: 'destination-in',
              status: hasFinalPixels ? 'Pixels visible' : 'No pixels detected'
            };

            if (!hasFinalPixels) {
              console.error(`❌ Device ${region.deviceIndex}: No pixels after mask application!`);
            }
          }
        }

        // 最終的な合成結果を確認
        const finalImageData = cctx.getImageData(0, 0, canvasWidth, canvasHeight);
        let hasPixels = false;
        for (let i = 3; i < finalImageData.data.length; i += 4) {
          if (finalImageData.data[i] > 0) {
            hasPixels = true;
            break;
          }
        }

        deviceDebugLog.finalRendering = {
          success: hasPixels,
          status: hasPixels ? 'Image successfully rendered' : 'No visible pixels'
        };

        if (!hasPixels) {
          console.error(`❌ Device ${region.deviceIndex} (${deviceType}): No visible pixels in final canvas!`);
        }

        const compositeUrl = comp.toDataURL('image/png');

        // compositeURL生成確認
        const isValidUrl = compositeUrl && compositeUrl !== 'data:,' && compositeUrl !== 'data:image/png;base64,';
        deviceDebugLog.compositeUrlGeneration = {
          success: isValidUrl,
          base64Length: isValidUrl ? compositeUrl.length - 'data:image/png;base64,'.length : 0,
          status: isValidUrl ? 'URL generated successfully' : 'Failed to generate URL'
        };

        if (!isValidUrl) {
          console.error(`❌ Device ${region.deviceIndex}: Failed to generate composite URL`);
        }

        // デバッグモードの場合、分析を実行
        if (currentDebugMode) {
          // デバッグ分析用に新しいマスクキャンバスを作成（元のCanvasを壊さないため）
          const debugMaskCanvas = document.createElement('canvas');
          debugMaskCanvas.width = canvasWidth;
          debugMaskCanvas.height = canvasHeight;
          const debugMaskCtx = debugMaskCanvas.getContext('2d');

          if (debugMaskCtx) {
            // マスク画像を再度描画（分析用）
            debugMaskCtx.drawImage(mk, 0, 0, mk.width, mk.height, 0, 0, canvasWidth, canvasHeight);

            // 合成済み画像のコピーも作成（分析用）
            const debugCompCanvas = document.createElement('canvas');
            debugCompCanvas.width = canvasWidth;
            debugCompCanvas.height = canvasHeight;
            const debugCompCtx = debugCompCanvas.getContext('2d');

            if (debugCompCtx) {
              // 合成済み画像をコピー
              debugCompCtx.drawImage(comp, 0, 0);

              // 白い余白の検出
              const whiteMarginAnalysis = detectWhiteMargins(
                debugCompCanvas,
                debugMaskCanvas,
                region.deviceIndex,
                deviceType
              );

              // デバイスの向き分析
              const orientationAnalysis = analyzeDeviceOrientation(
                debugMaskCanvas,
                region.deviceIndex,
                deviceType
              );

              // 分析結果をステートに保存（後でまとめて更新）
              setWhiteMarginAnalyses(prev => {
                const updated = [...prev];
                const existingIndex = updated.findIndex(a => a.deviceIndex === region.deviceIndex);
                if (existingIndex >= 0) {
                  updated[existingIndex] = whiteMarginAnalysis;
                } else {
                  updated.push(whiteMarginAnalysis);
                }
                return updated;
              });

              setOrientationAnalyses(prev => {
                const updated = [...prev];
                const existingIndex = updated.findIndex(a => a.deviceIndex === region.deviceIndex);
                if (existingIndex >= 0) {
                  updated[existingIndex] = orientationAnalysis;
                } else {
                  updated.push(orientationAnalysis);
                }
                return updated;
              });

              // デバッグログに分析結果を追加
              deviceDebugLog.whiteMarginAnalysis = {
                hasWhiteMargin: whiteMarginAnalysis.hasWhiteMargin,
                marginLocations: whiteMarginAnalysis.marginLocations,
                whitePixelRatio: `${(whiteMarginAnalysis.whitePixelRatio * 100).toFixed(2)}%`,
                requiredBleed: `${whiteMarginAnalysis.requiredBleedPercentage}%`,
                recommendations: whiteMarginAnalysis.recommendations
              };

              deviceDebugLog.deviceOrientationAnalysis = {
                deviceRotation: `${orientationAnalysis.deviceRotation}°`,
                notchPosition: orientationAnalysis.notchPosition,
                recommendedImageRotation: `${orientationAnalysis.recommendedImageRotation}°`,
                majorAxisAngle: `${orientationAnalysis.majorAxisAngle.toFixed(2)}°`,
                analysisDetails: orientationAnalysis.analysisDetails
              };
            }
          }
        }

        // 表示位置情報を計算
        let displayPosition = { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
        if (frameNatural && region.rect) {
          const scale = Math.min(
            containerSize.w / frameNatural.w,
            containerSize.h / frameNatural.h
          );
          const displayWidth = frameNatural.w * scale;
          const displayHeight = frameNatural.h * scale;
          const offsetX = (containerSize.w - displayWidth) / 2;
          const offsetY = (containerSize.h - displayHeight) / 2;

          displayPosition = {
            x: Math.round(offsetX + region.rect.xPct * displayWidth),
            y: Math.round(offsetY + region.rect.yPct * displayHeight),
            width: canvasWidth,
            height: canvasHeight
          };
        }

        if (!isCancelled) {
          console.log(`🎯 Device ${region.deviceIndex}: Setting composite URL`, {
            compositeUrl: compositeUrl ? compositeUrl.substring(0, 50) + '...' : null,
            displayPosition
          });
          setDeviceRegions(prev => {
            const updated = prev.map((r, idx) =>
              idx === deviceIndex ? { ...r, compositeUrl, displayPosition } : r
            );
            console.log(`✅ Device ${region.deviceIndex}: State updated`, updated[deviceIndex]);
            return updated;
          });
        }

        // 統合デバッグログを1回だけ出力
        if (currentDebugMode && !isCancelled) {
          console.log(`📊 ===== Device ${region.deviceIndex} Complete Processing Report =====`);
          console.log(deviceDebugLog);
          console.log(`===== End of Device ${region.deviceIndex} Report =====`);
        }
      })();
    });

    return () => {
      isCancelled = true;
    };
  }, [deviceRegions, selectedFrame?.id, containerSize.w, containerSize.h, frameNatural?.w, frameNatural?.h, feather]);

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <h2 className="text-xl font-semibold mb-3">複数デバイス対応モックアップエディタ</h2>

      {/* Frame selector */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {frames.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setSelectedFrame(f);
              setAspect(f.aspectSupport[0] ?? '1:1');
              setFrameNatural(null);
              clearOverlay();
              debugLogRef.current.push(`frame-selected: ${f.id}`);
            }}
            className={`border rounded-md p-2 bg-white hover:bg-gray-50 transition shadow-sm min-w-[140px] ${
              selectedFrame?.id === f.id ? 'ring-2 ring-black' : ''
            }`}
            title={f.name}
          >
            <img
              src={f.frameImage}
              alt={f.name}
              className="w-32 h-24 object-contain pointer-events-none select-none"
              loading="lazy"
            />
            <div className="text-xs mt-1 text-gray-700 truncate">{f.name}</div>
          </button>
        ))}
      </div>

      {/* Debug Mode Toggle */}
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => setDebugMode(prev => !prev)}
          className={`px-3 py-1 rounded text-sm font-medium ${
            debugMode
              ? 'bg-red-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          デバッグモード: {debugMode ? 'ON' : 'OFF'}
        </button>
        <span className="text-xs text-gray-500">
          {debugMode ? 'コンソールにデバッグ情報を出力中' : 'クリックしてデバッグ情報を表示'}
        </span>
      </div>

      {/* Aspect & FitMode selector */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-600">アスペクト比:</span>
        {(['9:16', '16:9', '1:1', '4:5'] as AspectRatio[]).map((a) => (
          <button
            key={a}
            onClick={() => {
              setAspect(a);
              debugLogRef.current.push(`aspect-changed: ${a}`);
            }}
            className={`px-2 py-1 text-sm border rounded ${aspect === a ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}`}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Control buttons */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-600">白塗りモード:</span>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={fillEnabled} onChange={(e)=> setFillEnabled(e.target.checked)} />
          クリックで白領域塗り
        </label>
        <span className="ml-4 text-sm text-gray-600">エッジの滑らかさ:</span>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={feather}
          onChange={(e)=> setFeather(parseInt(e.target.value))}
          title={`現在の値: ${feather}px`}
        />
        <span className="ml-2 text-xs text-gray-500">{feather}px</span>
        <button onClick={clearOverlay} className="ml-2 px-2 py-1 text-sm border rounded bg-white hover:bg-gray-50">全クリア</button>

        {/* Debug mode toggle */}
        <label className="ml-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} />
          <span className="text-orange-600 font-medium">🔍 デバッグモード</span>
        </label>
      </div>

      {/* Multiple image uploaders */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {deviceRegions.map((region, idx) => (
          <div
            key={idx}
            className={`border rounded-lg p-3 cursor-pointer transition-all ${
              selectedDeviceIndex === idx ? 'ring-2 ring-blue-500 bg-blue-50' : ''
            }`}
            style={{ borderColor: region.fillColor }}
            onClick={() => {
              console.log(`🖱️ Device ${idx + 1} clicked - BEFORE state update`);
              console.log(`  Current debugMode: ${debugMode}`);
              console.log(`  Current selectedDeviceIndex: ${selectedDeviceIndex}`);
              console.log(`  Current orientationAnalyses length: ${orientationAnalyses.length}`);
              console.log(`  Current whiteMarginAnalyses length: ${whiteMarginAnalyses.length}`);

              setSelectedDeviceIndex(idx as DeviceIndex);
              setActiveDeviceIndex(idx as DeviceIndex);
              console.log(`✅ Device ${idx + 1} selected - state updated`);

              // デバッグモード時は詳細情報を表示
              if (debugMode) {
                console.log(`📊 Device ${idx + 1} detailed info:`, {
                  rect: region.rect,
                  fillColor: region.fillColor,
                  isActive: region.isActive,
                  hasImage: !!region.imageUrl,
                  hardMaskUrl: !!region.hardMaskUrl,
                  fullRegion: region
                });

                // 詳細なデバイス分析を実行
                if (region.rect) {
                  // デバイスタイプ分析器を使用して詳細な分析を実行（corners情報も渡す）
                  const analysisResult = analyzeDeviceType(
                    region.rect,
                    undefined,
                    undefined,
                    { corners: region.corners }
                  );

                  console.log(`\n🔍 Device ${idx + 1} Detection Analysis:`);
                  console.log(`════════════════════════════════════════════`);
                  analysisResult.detectionSteps.forEach(step => {
                    console.log(step);
                  });
                  console.log(`════════════════════════════════════════════`);
                  console.log(`✅ Final Result: ${analysisResult.deviceType.toUpperCase()}`);
                  console.log(`✅ Confidence: ${(analysisResult.confidence * 100).toFixed(0)}%`);
                  console.log(`✅ Reasoning: ${analysisResult.reasoning.primary}`);
                  console.log(`✅ Shape Pattern: ${analysisResult.shapePattern || 'N/A'}\n`);

                  // deviceRegionsにデバイスタイプ情報を更新
                  setDeviceRegions(prev => prev.map((r, i) =>
                    i === idx ? {
                      ...r,
                      deviceType: analysisResult.deviceType,
                      deviceTypeConfidence: analysisResult.confidence,
                      detectionReasoning: analysisResult.reasoning.primary,
                      shapePattern: analysisResult.shapePattern
                    } : r
                  ));

                  // 詳細分析データをorientationAnalysesに追加
                  const detailedAnalysis: DeviceOrientationAnalysis = {
                    deviceIndex: idx,
                    deviceType: analysisResult.deviceType as 'laptop' | 'smartphone' | 'tablet',
                    deviceRotation: 0,
                    majorAxisAngle: 0,
                    notchPosition: { x: 0, y: 0, angle: 0 },
                    recommendedImageRotation: 0,
                    analysisDetails: {
                      aspectRatio: analysisResult.aspectRatio,
                      isPortrait: analysisResult.orientation === 'portrait',
                      isLandscape: analysisResult.orientation === 'landscape',
                      isDiagonal: false,
                      // 詳細な分析結果を追加
                      deviceAnalysis: analysisResult
                    },
                    confidence: analysisResult.confidence
                  };

                  // 既存の分析があればそれを更新、なければ新規追加
                  console.log(`🔬 Creating orientation analysis for device ${idx + 1}`);
                  setOrientationAnalyses(prev => {
                    const existing = prev.filter(a => a.deviceIndex !== idx);
                    const newAnalyses = [...existing, detailedAnalysis];
                    console.log(`  ➡️ Updated orientationAnalyses: ${newAnalyses.length} items`);
                    return newAnalyses;
                  });

                  // 白い余白の簡易分析も追加
                  console.log(`🔬 Creating margin analysis for device ${idx + 1}`);
                  const marginAnalysis: WhiteMarginAnalysis = {
                    deviceIndex: idx,
                    hasWhiteMargin: false,
                    marginLocations: { top: 0, bottom: 0, left: 0, right: 0 },
                    whitePixelRatio: 0,
                    totalEdgePixels: 0,
                    detectedWhitePixels: 0,
                    requiredBleedPercentage: 0,
                    recommendations: ['画像をアップロードしてから詳細な分析が行われます']
                  };

                  setWhiteMarginAnalyses(prev => {
                    const existing = prev.filter(a => a.deviceIndex !== idx);
                    const newAnalyses = [...existing, marginAnalysis];
                    console.log(`  ➡️ Updated whiteMarginAnalyses: ${newAnalyses.length} items`);
                    return newAnalyses;
                  });
                } else {
                  console.log(`⚠️ Device ${idx + 1} has no rect data - cannot create analysis`);
                }
              } else {
                console.log(`📌 Device ${idx + 1} clicked - debugMode is OFF`);
              }
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium flex items-center gap-2 pointer-events-none">
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: region.fillColor }}></span>
                デバイス {idx + 1}
              </label>
              {region.isActive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearDevice(idx as DeviceIndex);
                  }}
                  className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                >
                  クリア
                </button>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onFileChange(e, idx as DeviceIndex)}
              onClick={(e) => e.stopPropagation()}
              className="block text-sm"
            />
            {imageUrls[idx] && (
              <div className="mt-2 text-xs text-gray-600">
                画像アップロード済み {region.imageNatural && `(${region.imageNatural.w}x${region.imageNatural.h})`}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Preview */}
      <div className="mt-6">
        <div
          ref={containerRef}
          className="relative bg-gray-200 rounded-lg overflow-hidden mx-auto"
          style={{
            aspectRatio: aspectCss as any,
            width: 'min(90vw, 800px)',
          }}
        >
          {/* Frame image */}
          {selectedFrame ? (
            (() => {
              const style: React.CSSProperties = (() => {
                if (!frameNatural) return { position: 'absolute', inset: 0, zIndex: 1 } as React.CSSProperties;
                const c = containSize(containerSize.w, containerSize.h, frameNatural.w, frameNatural.h);
                return {
                  position: 'absolute',
                  left: `${c.left}px`,
                  top: `${c.top}px`,
                  width: `${c.w}px`,
                  height: `${c.h}px`,
                  objectFit: 'contain',
                  pointerEvents: 'none',
                  zIndex: 1,
                } as React.CSSProperties;
              })();
              return (
                <img
                  src={frameUrl ?? ''}
                  alt={selectedFrame.name}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setFrameNatural({ w: img.naturalWidth, h: img.naturalHeight });
                    debugLogRef.current.push(`frame-loaded: natural=${img.naturalWidth}x${img.naturalHeight}`);
                  }}
                  style={style}
                />
              );
            })()
          ) : (
            <div className="absolute bottom-2 left-2 text-xs bg-white/70 px-2 py-1 rounded">フレーム未選択</div>
          )}

          {/* Overlay canvas */}
          {selectedFrame && frameNatural && (
            (() => {
              const c = containSize(containerSize.w, containerSize.h, frameNatural.w, frameNatural.h);
              const style: React.CSSProperties = {
                position: 'absolute',
                left: `${c.left}px`,
                top: `${c.top}px`,
                width: `${c.w}px`,
                height: `${c.h}px`,
                zIndex: 5,
                cursor: fillEnabled ? 'crosshair' : 'default',
                pointerEvents: fillEnabled ? 'auto' as const : 'none' as const,
              };
              return (
                <canvas
                  ref={overlayCanvasRef}
                  onClick={fillEnabled ? onOverlayClick : undefined}
                  style={style}
                />
              );
            })()
          )}

          {/* Composite results for each device */}
          {selectedFrame && frameNatural && (() => {
            // デバイスの奥行き順序を計算（デバイスタイプとY座標に基づく）
            const sortedRegions = deviceRegions
              .map((region, idx) => ({ region, idx }))
              .filter(item => item.region.compositeUrl && item.region.rect)
              .sort((a, b) => {
                // デバイスタイプを判定（アスペクト比ベース）
                const getDeviceType = (rect: ScreenRectPct) => {
                  const aspectRatio = rect.wPct / rect.hPct;
                  if (aspectRatio < 0.65) return 'smartphone'; // 縦長
                  if (aspectRatio > 1.4) return 'laptop'; // 横長
                  return 'tablet'; // その他
                };

                const typeA = getDeviceType(a.region.rect!);
                const typeB = getDeviceType(b.region.rect!);

                // ラップトップ/タブレットを後ろに（先に描画）、スマートフォンを前に（後に描画）
                const priorityMap: Record<string, number> = {
                  'laptop': 0,
                  'tablet': 1,
                  'smartphone': 2
                };

                const priorityDiff = priorityMap[typeA] - priorityMap[typeB];
                if (priorityDiff !== 0) return priorityDiff;

                // 同じタイプの場合はY座標で判定（上にあるものを後ろに）
                const yDiff = (a.region.rect!.yPct - b.region.rect!.yPct) * 100;
                if (Math.abs(yDiff) > 5) return yDiff;

                // Y座標も近い場合は面積が大きいものを後ろに
                const areaA = a.region.rect!.wPct * a.region.rect!.hPct;
                const areaB = b.region.rect!.wPct * b.region.rect!.hPct;
                return areaB - areaA;
              });

            console.log(`🖼️ Rendering ${sortedRegions.length} device images`);
            return sortedRegions.map(({ region, idx }, sortIndex) => {
              // displayPositionが存在する場合はそれを使用、なければ従来の計算方法を使用
              let sx, sy, sw, sh;
              if (region.displayPosition) {
                console.log(`📍 Device ${region.deviceIndex}: Using displayPosition`, region.displayPosition);
                sx = region.displayPosition.x;
                sy = region.displayPosition.y;
                sw = region.displayPosition.width;
                sh = region.displayPosition.height;
              } else {
                const contain = containSize(containerSize.w, containerSize.h, frameNatural.w, frameNatural.h);
                sx = region.rect!.xPct * contain.w + contain.left;
                sy = region.rect!.yPct * contain.h + contain.top;
                sw = region.rect!.wPct * contain.w;
                sh = region.rect!.hPct * contain.h;
              }

              return (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: `${sx}px`,
                    top: `${sy}px`,
                    width: `${sw}px`,
                    height: `${sh}px`,
                    zIndex: 50 + sortIndex,  // ソート順でz-indexを設定
                    backgroundColor: 'transparent',
                    pointerEvents: fillEnabled ? 'none' : 'auto',
                  }}
              >
                <img
                  key={imageKeys[idx]}
                  src={region.compositeUrl}
                  alt={`composite-${idx}`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: fillEnabled ? 'none' : 'auto' }}
                />
                {region.darkOverlayUrl && (
                  <img
                    src={region.darkOverlayUrl}
                    alt="frame-details"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  />
                )}
              </div>
            );
            });
          })()}

          {/* No image hint */}
          {!imageUrls.some(Boolean) && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-600">
              画像未選択
            </div>
          )}
        </div>
      </div>

      {/* Debug information display */}
      {debugMode && (
        <div className="mt-4 p-4 bg-orange-50 border border-orange-300 rounded-lg">
          <h3 className="font-bold text-orange-800 mb-2">🔍 デバッグ情報</h3>
          <div className="space-y-2 text-sm font-mono">
            <div>Frame Natural: {frameNatural ? `${frameNatural.w}x${frameNatural.h}` : 'N/A'}</div>
            <div>Container: {containerSize.w}x{containerSize.h}</div>
            <div className="space-y-1">
              {deviceRegions.map((region, idx) => region.rect && (
                <div key={idx} className="pl-4 border-l-2 border-orange-300">
                  <div className="font-semibold" style={{ color: region.fillColor }}>Device {idx}:</div>
                  <div>Position: ({(region.rect.xPct * 100).toFixed(1)}%, {(region.rect.yPct * 100).toFixed(1)}%)</div>
                  <div>Size: {(region.rect.wPct * 100).toFixed(1)}% × {(region.rect.hPct * 100).toFixed(1)}%</div>
                  {region.imageNatural && (
                    <div>Image: {region.imageNatural.w}x{region.imageNatural.h}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="text-orange-600 text-xs mt-2">
              ⚠️ コンソールで詳細なデバッグ情報を確認してください
            </div>
          </div>
        </div>
      )}

      {/* Debug button */}
      <DebugButton
        label="デバッグレポート生成"
        generateReport={() => {
          const data = {
            time: new Date().toISOString(),
            aspect,
            fitMode: 'cover' as const,
            container: containerSize,
            frame: selectedFrame ? {
              id: selectedFrame.id,
              name: selectedFrame.name,
              category: selectedFrame.category,
            } : null,
            frameNatural,
            deviceRegions: deviceRegions.map((r, idx) => ({
              deviceIndex: r.deviceIndex,
              rect: r.rect,
              corners: r.corners,
              isActive: r.isActive,
              hasImage: !!r.imageUrl,
              fillColor: r.fillColor,
              imageNatural: r.imageNatural,
              debugInfo: deviceDebugInfoRef.current[idx] || null,
            })),
            activeDeviceIndex,
            logs: debugLogRef.current,
          };
          return JSON.stringify(data, null, 2);
        }}
      />

      {/* デバッグパネル */}
      <DebugPanel
        whiteMarginAnalyses={whiteMarginAnalyses}
        orientationAnalyses={orientationAnalyses}
        isVisible={debugMode}
        selectedDeviceIndex={selectedDeviceIndex}
        deviceRegions={deviceRegions}
      />

      {/* 詳細デバッグパネル - 常に表示（debugModeで内容変化） */}
      <EnhancedDebugPanel
        isVisible={true}
        debugMode={debugMode}
        selectedDeviceIndex={selectedDeviceIndex}
        deviceRegions={deviceRegions}
        whiteMarginAnalyses={whiteMarginAnalyses}
        orientationAnalyses={orientationAnalyses}
        onDebugEvent={(event) => {
          console.log(`[EnhancedDebug] ${event.type}:${event.action}`, event.details);
        }}
      />
    </div>
  );
}