import { useEffect, useState, useRef, useCallback } from "react";
import type { MockupGalleryItem } from "../types";
import type { DeviceCategory } from "../../types/frame";
import { detectDeviceScreensWithLog, fillWhiteAreasWithColors, formatDetectionLogForCopy, DEVICE_FILL_COLORS } from "../../../../utils/whiteAreaExtractor";
import type { ScreenRegion as ExtractorScreenRegion, DetectionLog } from "../../../../utils/whiteAreaExtractor";
import { drawPerspectiveImage, type Point as PerspectivePoint } from "../../../../utils/perspectiveTransform";

interface PreviewModalProps {
  item: MockupGalleryItem | null;
  onClose: () => void;
  onSelectFrame: (item: MockupGalleryItem) => void;
  categoryResolver: (item: MockupGalleryItem) => DeviceCategory;
}

interface Point {
  x: number;
  y: number;
}

type DeviceType = 'smartphone' | 'laptop' | 'tablet' | 'unknown';

interface DeviceRegion {
  index: number;
  rect: { x: number; y: number; width: number; height: number };
  originalRect: { x: number; y: number; width: number; height: number }; // Original bounding rect (never changes)
  corners: Point[]; // 4 corners of the actual screen region (top-left, top-right, bottom-right, bottom-left)
  originalCorners: Point[]; // Original corners detected from white region (never changes)
  rotation: number; // rotation angle in radians (for affine transform)
  mask: Uint8Array;
  originalMask: Uint8Array; // Original mask from white region detection (never changes)
  userImage: string | null;
  userImageNatural: { w: number; h: number } | null;
  fitMode: 'cover' | 'contain'; // Image fit mode
  isPartialRegion: boolean; // True if device screen is cut off at image boundary (non-quadrilateral)
  deviceType: DeviceType; // Detected or inferred device type
  isLandscape: boolean; // True if this region is landscape orientation (e.g., laptop screen)
}

// Parse template filename to extract device composition hints
function parseTemplateDeviceHints(filename: string): { hasSmartphone: boolean; hasLaptop: boolean; hasTablet: boolean; deviceCount: number } {
  const lowerName = filename.toLowerCase();
  
  // Common patterns: "2sp" = 2 smartphones, "SpAndLaptop" = smartphone + laptop
  const hasSmartphone = lowerName.includes('sp') || lowerName.includes('smartphone') || lowerName.includes('phone');
  const hasLaptop = lowerName.includes('laptop') || lowerName.includes('macbook') || lowerName.includes('notebook');
  const hasTablet = lowerName.includes('tablet') || lowerName.includes('ipad');
  
  // Count devices from patterns like "2sp", "3sp"
  const spCountMatch = lowerName.match(/(\d+)sp/);
  let deviceCount = 1;
  if (spCountMatch) {
    deviceCount = parseInt(spCountMatch[1], 10);
  } else if (hasSmartphone && hasLaptop) {
    deviceCount = 2;
  }
  
  return { hasSmartphone, hasLaptop, hasTablet, deviceCount };
}

// Determine device type based on region properties and template hints
function inferDeviceType(
  region: { width: number; height: number; area: number },
  allRegions: { width: number; height: number; area: number }[],
  templateHints: { hasSmartphone: boolean; hasLaptop: boolean; hasTablet: boolean }
): { deviceType: DeviceType; isLandscape: boolean } {
  const aspectRatio = region.width / region.height;
  const isWide = aspectRatio > 1.2; // Landscape if width > height * 1.2
  
  // If template has laptop hint and this region is landscape/wide, it's likely a laptop
  if (templateHints.hasLaptop && isWide) {
    return { deviceType: 'laptop', isLandscape: true };
  }
  
  // If template has laptop hint and multiple regions exist, the larger one might be laptop
  if (templateHints.hasLaptop && allRegions.length >= 2) {
    const maxArea = Math.max(...allRegions.map(r => r.area));
    if (region.area === maxArea && region.area > allRegions.filter(r => r !== region)[0]?.area * 1.5) {
      return { deviceType: 'laptop', isLandscape: true };
    }
  }
  
  // Default to smartphone (portrait)
  if (templateHints.hasSmartphone || !templateHints.hasLaptop) {
    return { deviceType: 'smartphone', isLandscape: false };
  }
  
  return { deviceType: 'unknown', isLandscape: isWide };
}

// Parse attributes from colors or filename
function extractAttributes(item: MockupGalleryItem): string[] {
  const attrs: string[] = [];
  const filename = item.originalFilename.toLowerCase();
  
  if (filename.includes("floating")) attrs.push("Floating");
  if (filename.includes("glass")) attrs.push("Glass");
  if (filename.includes("shadow")) attrs.push("Shadow");
  if (filename.includes("minimal")) attrs.push("Minimal");
  if (filename.includes("dark")) attrs.push("Dark");
  if (filename.includes("light")) attrs.push("Light");
  if (filename.includes("gradient")) attrs.push("Gradient");
  if (filename.includes("clay")) attrs.push("Clay");
  
  // Add colors as attributes if no specific attributes found
  if (attrs.length === 0 && item.colors.length > 0) {
    return item.colors.slice(0, 3);
  }
  
  return attrs.length > 0 ? attrs : ["Standard"];
}

function isWhitePixel(r: number, g: number, b: number, a: number) {
  const thr = 240;
  return a > 200 && r >= thr && g >= thr && b >= thr;
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

// Extract contour points from a binary mask using marching squares
function extractContourPoints(
  visited: Uint8Array,
  w: number,
  h: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Point[] {
  const contour: Point[] = [];
  
  // Scan edges of the region to find contour points
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = y * w + x;
      if (!visited[idx]) continue;
      
      // Check if this is an edge pixel (has at least one non-white neighbor)
      const isEdge = 
        x === minX || x === maxX || y === minY || y === maxY ||
        !visited[idx - 1] || !visited[idx + 1] ||
        !visited[idx - w] || !visited[idx + w];
      
      if (isEdge) {
        contour.push({ x, y });
      }
    }
  }
  
  return contour;
}

// Find the convex hull of points using Graham scan
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points;
  
  // Find the bottom-most point (or left-most if tie)
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].y > points[start].y || 
        (points[i].y === points[start].y && points[i].x < points[start].x)) {
      start = i;
    }
  }
  
  const pivot = points[start];
  
  // Sort points by polar angle with pivot
  const sorted = points.slice().sort((a, b) => {
    const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
    const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
    if (angleA !== angleB) return angleA - angleB;
    // If angles are the same, sort by distance
    const distA = (a.x - pivot.x) ** 2 + (a.y - pivot.y) ** 2;
    const distB = (b.x - pivot.x) ** 2 + (b.y - pivot.y) ** 2;
    return distA - distB;
  });
  
  // Cross product to determine turn direction
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  
  const hull: Point[] = [];
  for (const p of sorted) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
      hull.pop();
    }
    hull.push(p);
  }
  
  return hull;
}

// Compute minimum area bounding rectangle using rotating calipers
// This returns the 4 corners of the tightest-fitting rotated rectangle
// Also returns the rotation angle for affine transform
function minAreaRect(hull: Point[]): { corners: Point[]; rotation: number } {
  if (hull.length < 3) {
    // Not enough points for a polygon, return bounding box
    const minX = Math.min(...hull.map(p => p.x));
    const maxX = Math.max(...hull.map(p => p.x));
    const minY = Math.min(...hull.map(p => p.y));
    const maxY = Math.max(...hull.map(p => p.y));
    return {
      corners: [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ],
      rotation: 0,
    };
  }

  const n = hull.length;
  let minArea = Infinity;
  let bestRect: Point[] = [];
  let bestRotation = 0;

  // Try each edge of the convex hull as a base
  for (let i = 0; i < n; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % n];

    // Edge vector
    const edgeX = p2.x - p1.x;
    const edgeY = p2.y - p1.y;
    const edgeLen = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
    
    if (edgeLen === 0) continue;

    // Normalize edge vector (this becomes our rotated X axis)
    const ux = edgeX / edgeLen;
    const uy = edgeY / edgeLen;

    // Perpendicular vector (rotated Y axis)
    const vx = -uy;
    const vy = ux;

    // Project all hull points onto the rotated axes
    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    for (const p of hull) {
      const u = (p.x - p1.x) * ux + (p.y - p1.y) * uy;
      const v = (p.x - p1.x) * vx + (p.y - p1.y) * vy;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }

    // Calculate area
    const width = maxU - minU;
    const height = maxV - minV;
    const area = width * height;

    if (area < minArea) {
      minArea = area;

      // Calculate the 4 corners of the rectangle in original coordinates
      // Corner positions in rotated space: (minU, minV), (maxU, minV), (maxU, maxV), (minU, maxV)
      bestRect = [
        {
          x: p1.x + minU * ux + minV * vx,
          y: p1.y + minU * uy + minV * vy,
        },
        {
          x: p1.x + maxU * ux + minV * vx,
          y: p1.y + maxU * uy + minV * vy,
        },
        {
          x: p1.x + maxU * ux + maxV * vx,
          y: p1.y + maxU * uy + maxV * vy,
        },
        {
          x: p1.x + minU * ux + maxV * vx,
          y: p1.y + minU * uy + maxV * vy,
        },
      ];
      
      // Rotation angle: angle of the edge from horizontal
      bestRotation = Math.atan2(uy, ux);
    }
  }

  // Calculate edge lengths to determine orientation (long edge = vertical direction)
  const edge01 = Math.sqrt((bestRect[1].x - bestRect[0].x) ** 2 + (bestRect[1].y - bestRect[0].y) ** 2);
  const edge12 = Math.sqrt((bestRect[2].x - bestRect[1].x) ** 2 + (bestRect[2].y - bestRect[1].y) ** 2);
  
  // Determine aspect ratio: wider means landscape
  const aspectRatio = Math.max(edge01, edge12) / Math.min(edge01, edge12);
  const isLandscapeShape = edge01 > edge12; // edge01 (horizontal-ish) is longer
  
  // For rotation calculation, we need to find the direction of the "up" edge
  // For portrait devices: up is along the shorter edge direction (opposite to the long edge)
  // For landscape devices: up is along the shorter edge direction
  
  let rotationForUpright: number;
  
  if (isLandscapeShape) {
    // edge01 is longer (horizontal), so the "up" direction is perpendicular to it
    const dx = bestRect[1].x - bestRect[0].x;
    const dy = bestRect[1].y - bestRect[0].y;
    rotationForUpright = Math.atan2(dy, dx) - Math.PI / 2;
  } else {
    // edge12 is longer (vertical), so "up" is opposite to edge12 direction
    const dx = bestRect[2].x - bestRect[1].x;
    const dy = bestRect[2].y - bestRect[1].y;
    rotationForUpright = Math.atan2(dy, dx) - Math.PI / 2;
  }
  
  // CRITICAL FIX: Determine the actual "up" direction based on which corner is highest in image
  // The corner with smallest Y coordinate should be at the top after rotation
  const cx = (bestRect[0].x + bestRect[1].x + bestRect[2].x + bestRect[3].x) / 4;
  const cy = (bestRect[0].y + bestRect[1].y + bestRect[2].y + bestRect[3].y) / 4;
  
  // Find the corner that's most "up" (smallest Y in image coordinates = top)
  let topCornerIdx = 0;
  let minY = Infinity;
  for (let i = 0; i < 4; i++) {
    if (bestRect[i].y < minY) {
      minY = bestRect[i].y;
      topCornerIdx = i;
    }
  }
  
  // The vector from center to top corner should point "up" after rotation
  const topCorner = bestRect[topCornerIdx];
  const vecToTopX = topCorner.x - cx;
  const vecToTopY = topCorner.y - cy;
  
  // The desired "up" direction in rotated space is (0, -1) (negative Y = up in image coords)
  // Current rotation should align the device's "up" to point toward the top corner
  // Calculate the angle of the vector to the top corner
  const angleToTop = Math.atan2(vecToTopY, vecToTopX);
  
  // The rotation should make the top of the device point in this direction
  // For a device, "up" after rotation should be -PI/2 (pointing up in screen coords)
  // So we need: rotationForUpright + deviceUp = angleToTop
  // For portrait device, deviceUp is at 0 in device coords (top edge)
  // After applying rotation, device's top should point to angleToTop
  
  // Simplified: Make the rotation such that the corner closest to image top
  // ends up being the "top" of the device
  // This requires checking if we need to flip 180 degrees
  
  const cosR = Math.cos(-rotationForUpright);
  const sinR = Math.sin(-rotationForUpright);
  
  // Transform top corner to rotated space
  const topInRotatedY = (topCorner.x - cx) * sinR + (topCorner.y - cy) * cosR;
  
  // If top corner (smallest Y in image) has positive Y in rotated space, we need to flip 180 degrees
  if (topInRotatedY > 0) {
    rotationForUpright += Math.PI;
  }
  
  // Find corner that's most "top-left" considering the rotation
  // In upright orientation, top-left has smallest y (top) and smallest x (left)
  // We rotate each corner by -rotationForUpright to get upright coordinates
  const cosR2 = Math.cos(-rotationForUpright);
  const sinR2 = Math.sin(-rotationForUpright);
  
  let minTopLeftScore = Infinity;
  let topLeftIdx = 0;
  
  for (let i = 0; i < 4; i++) {
    // Rotate corner around centroid
    const px = bestRect[i].x - cx;
    const py = bestRect[i].y - cy;
    const uprightY = px * sinR2 + py * cosR2;
    const uprightX = px * cosR2 - py * sinR2;
    
    // Top-left has smallest y + x
    const score = uprightY + uprightX;
    if (score < minTopLeftScore) {
      minTopLeftScore = score;
      topLeftIdx = i;
    }
  }

  // Reorder so top-left is first
  const result: Point[] = [];
  for (let i = 0; i < 4; i++) {
    result.push(bestRect[(topLeftIdx + i) % 4]);
  }

  return { corners: result, rotation: rotationForUpright };
}

// Check if a point is inside a polygon using ray casting
function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  const n = polygon.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

// Regenerate mask from corners using point-in-polygon test
function regenerateMaskFromCorners(
  corners: Point[],
  rect: { x: number; y: number; width: number; height: number }
): Uint8Array {
  const { x: rx, y: ry, width, height } = rect;
  const mask = new Uint8Array(width * height);
  
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const point = { x: rx + i, y: ry + j };
      if (pointInPolygon(point, corners)) {
        mask[j * width + i] = 1;
      }
    }
  }
  
  return mask;
}

// Calculate rotation from corners (similar to minAreaRect logic)
function calculateRotationFromCorners(corners: Point[]): number {
  if (corners.length < 4) return 0;
  
  // Calculate edge lengths
  const edge01 = Math.sqrt((corners[1].x - corners[0].x) ** 2 + (corners[1].y - corners[0].y) ** 2);
  const edge12 = Math.sqrt((corners[2].x - corners[1].x) ** 2 + (corners[2].y - corners[1].y) ** 2);
  
  let rotationForUpright: number;
  
  if (edge01 > edge12) {
    const dx = corners[1].x - corners[0].x;
    const dy = corners[1].y - corners[0].y;
    rotationForUpright = Math.atan2(dy, dx) - Math.PI / 2;
  } else {
    const dx = corners[2].x - corners[1].x;
    const dy = corners[2].y - corners[1].y;
    rotationForUpright = Math.atan2(dy, dx) - Math.PI / 2;
  }
  
  return rotationForUpright;
}

// Check if region touches image boundary (partial/cut-off region)
function checkPartialRegion(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  imageW: number,
  imageH: number
): boolean {
  const margin = 3; // Pixels from edge to consider as touching boundary
  return minX <= margin || minY <= margin || maxX >= imageW - margin || maxY >= imageH - margin;
}

// Detect 4 corners of the white region from the visited mask
function detectCorners(
  visited: Uint8Array,
  w: number,
  h: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): { corners: Point[]; rotation: number; isPartial: boolean } {
  // Check if this is a partial region (touches image boundary)
  const isPartial = checkPartialRegion(minX, minY, maxX, maxY, w, h);
  
  // Extract contour points
  const contour = extractContourPoints(visited, w, h, minX, minY, maxX, maxY);
  
  if (contour.length < 4) {
    // Fallback to bounding box corners
    return {
      corners: [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ],
      rotation: 0,
      isPartial,
    };
  }
  
  // Sample contour points for performance (use every Nth point)
  const sampleRate = Math.max(1, Math.floor(contour.length / 500));
  const sampledContour = contour.filter((_, i) => i % sampleRate === 0);
  
  // Get convex hull
  const hull = convexHull(sampledContour);
  
  if (hull.length < 4) {
    return {
      corners: [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ],
      rotation: 0,
      isPartial,
    };
  }
  
  // Use minimum area bounding rectangle for accurate corner detection
  const result = minAreaRect(hull);
  return { ...result, isPartial };
}

export function PreviewModal({ item, onClose, onSelectFrame, categoryResolver }: PreviewModalProps) {
  const [deviceRegions, setDeviceRegions] = useState<DeviceRegion[]>([]);
  const [selectedRegionIndex, setSelectedRegionIndex] = useState<number | null>(null);
  const [frameImageData, setFrameImageData] = useState<ImageData | null>(null);
  const [frameNatural, setFrameNatural] = useState<{ w: number; h: number } | null>(null);
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false); // Start hidden, show only if auto-detection fails
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragOverRegionIndex, setDragOverRegionIndex] = useState<number | null>(null);
  
  // Corner editing mode states
  const [isCornerEditMode, setIsCornerEditMode] = useState(false);
  const [editingCorners, setEditingCorners] = useState<Point[]>([]);
  const [draggingCornerIndex, setDraggingCornerIndex] = useState<number | null>(null);
  const [originalCorners, setOriginalCorners] = useState<Point[]>([]);
  
  // 白エリア塗りつぶしプレビュー用ステート
  const [colorFilledUrl, setColorFilledUrl] = useState<string | null>(null);
  const [showColorFill, setShowColorFill] = useState(false);
  const [detectedScreenRegions, setDetectedScreenRegions] = useState<ExtractorScreenRegion[]>([]);
  const [detectionLog, setDetectionLog] = useState<DetectionLog | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Ref to track deviceRegions for cleanup
  const deviceRegionsRef = useRef<DeviceRegion[]>([]);
  
  // Keep ref in sync with state
  useEffect(() => {
    deviceRegionsRef.current = deviceRegions;
  }, [deviceRegions]);

  // Reset ALL state when item changes (including when item becomes null)
  // This ensures clean state when switching between templates or closing modal
  useEffect(() => {
    // Clean up Blob URLs from previous session to prevent memory leaks
    deviceRegionsRef.current.forEach(region => {
      if (region.userImage) {
        URL.revokeObjectURL(region.userImage);
      }
    });
    
    // Reset all state
    setDeviceRegions([]);
    setSelectedRegionIndex(null);
    setFrameImageData(null);
    setFrameNatural(null);
    setCompositeUrl(null);
    setShowInstructions(false); // Start hidden, auto-detection will show if it fails
    setIsCornerEditMode(false);
    setEditingCorners([]);
    setOriginalCorners([]);
    setDraggingCornerIndex(null);
    setColorFilledUrl(null);
    setShowColorFill(false);
    setDetectedScreenRegions([]);
    setDetectionLog(null);
  }, [item]);

  useEffect(() => {
    if (item) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [item]);

  // Load frame image and prepare canvas
  useEffect(() => {
    if (!item) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      setFrameNatural({ w: img.naturalWidth, h: img.naturalHeight });

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setFrameImageData(imageData);

      // Setup overlay canvas
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        overlay.width = img.naturalWidth;
        overlay.height = img.naturalHeight;
      }
    };
    img.src = item.publicPath;
  }, [item]);

  // Auto-detect white regions when frame image is loaded
  useEffect(() => {
    if (!frameImageData || !frameNatural || !item) return;
    // Skip if regions are already detected
    if (deviceRegions.length > 0) return;

    setIsProcessing(true);

    // Use detectDeviceScreensWithLog for automatic detection
    const { regions } = detectDeviceScreensWithLog(frameImageData, {
      luminanceThreshold: 0.90,
      minAreaRatio: 0.005,
      minRectangularity: 0.35,
      minBezelScore: 0.20,
      bezelWidth: 15,
      minBezelEdges: 1,
    });

    if (regions.length === 0) {
      setIsProcessing(false);
      setShowInstructions(true); // Show manual detection instructions when auto-detection fails
      return;
    }

    // Get template hints from filename
    const templateHints = parseTemplateDeviceHints(item.originalFilename);

    // Convert ScreenRegion to DeviceRegion with precise corner detection
    const imageWidth = frameImageData.width;
    const imageHeight = frameImageData.height;

    const newDeviceRegions: DeviceRegion[] = regions.map((region, idx) => {
      const { bounds, mask } = region;

      // Create full-image-size visited mask from region-local mask
      const visited = new Uint8Array(imageWidth * imageHeight);
      for (let j = 0; j < bounds.height; j++) {
        for (let i = 0; i < bounds.width; i++) {
          if (mask[j * bounds.width + i] === 1) {
            const globalIdx = (bounds.y + j) * imageWidth + (bounds.x + i);
            visited[globalIdx] = 1;
          }
        }
      }

      // Use detectCorners for precise corner detection (follows black frame contours)
      const minX = bounds.x;
      const minY = bounds.y;
      const maxX = bounds.x + bounds.width - 1;
      const maxY = bounds.y + bounds.height - 1;
      const { corners: preciseCorners, rotation, isPartial } = detectCorners(
        visited, imageWidth, imageHeight, minX, minY, maxX, maxY
      );

      // Prepare region info for device type inference
      const regionArea = bounds.width * bounds.height;
      const allRegionsInfo = regions.map(r => ({
        width: r.bounds.width,
        height: r.bounds.height,
        area: r.bounds.width * r.bounds.height
      }));

      // Infer device type
      const { deviceType, isLandscape } = inferDeviceType(
        { width: bounds.width, height: bounds.height, area: regionArea },
        allRegionsInfo,
        templateHints
      );

      return {
        index: idx,
        rect: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        originalRect: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        corners: preciseCorners.map(c => ({ x: c.x, y: c.y })),
        originalCorners: preciseCorners.map(c => ({ x: c.x, y: c.y })),
        rotation,
        mask,
        originalMask: new Uint8Array(mask),
        userImage: null,
        userImageNatural: null,
        fitMode: 'cover' as const,
        isPartialRegion: isPartial,
        deviceType,
        isLandscape,
      };
    });

    setDeviceRegions(newDeviceRegions);
    setSelectedRegionIndex(0);
    setShowInstructions(false);
    setIsProcessing(false);
    // Note: drawOverlay will be called automatically by the useEffect that watches deviceRegions and selectedRegionIndex
  }, [frameImageData, frameNatural, item]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && item) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item, onClose]);

  // Handle canvas click for region detection
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!frameImageData || !frameNatural) return;

    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const sx = frameNatural.w / rect.width;
    const sy = frameNatural.h / rect.height;
    let x = Math.floor((e.clientX - rect.left) * sx);
    let y = Math.floor((e.clientY - rect.top) * sy);

    const w = frameImageData.width;
    const h = frameImageData.height;
    const data = frameImageData.data;

    // Check if clicking on existing region
    for (let i = 0; i < deviceRegions.length; i++) {
      const region = deviceRegions[i];
      if (
        x >= region.rect.x &&
        x <= region.rect.x + region.rect.width &&
        y >= region.rect.y &&
        y <= region.rect.y + region.rect.height
      ) {
        setSelectedRegionIndex(i);
        setShowInstructions(false);
        return;
      }
    }

    // Find nearest white pixel
    const seed = findNearestWhite(x, y, data, w, h, 10);
    if (!seed) return;
    x = seed.x;
    y = seed.y;

    setIsProcessing(true);

    // BFS flood fill to detect white region
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

    // Calculate region bounds
    const regionWidth = maxX - minX + 1;
    const regionHeight = maxY - minY + 1;

    // Skip if region is too small
    if (regionWidth < 20 || regionHeight < 20) {
      setIsProcessing(false);
      return;
    }

    // Create mask for region
    const mask = new Uint8Array(regionWidth * regionHeight);
    for (let j = 0; j < regionHeight; j++) {
      for (let i = 0; i < regionWidth; i++) {
        const srcIdx = (minY + j) * w + (minX + i);
        mask[j * regionWidth + i] = visited[srcIdx];
      }
    }

    // Check for duplicate region
    const isDuplicate = deviceRegions.some(region => {
      const overlapX = Math.max(0, Math.min(region.rect.x + region.rect.width, minX + regionWidth) - Math.max(region.rect.x, minX));
      const overlapY = Math.max(0, Math.min(region.rect.y + region.rect.height, minY + regionHeight) - Math.max(region.rect.y, minY));
      const overlapArea = overlapX * overlapY;
      const thisArea = regionWidth * regionHeight;
      return overlapArea > thisArea * 0.5;
    });

    if (isDuplicate) {
      setIsProcessing(false);
      return;
    }

    // Detect the 4 corners of the white region
    const { corners, rotation, isPartial } = detectCorners(visited, w, h, minX, minY, maxX, maxY);

    // Get template hints from filename
    const templateHints = item ? parseTemplateDeviceHints(item.originalFilename) : { hasSmartphone: true, hasLaptop: false, hasTablet: false, deviceCount: 1 };
    
    // Prepare region info for device type inference
    const regionArea = regionWidth * regionHeight;
    const allRegionsInfo = [...deviceRegions.map(r => ({
      width: r.originalRect.width,
      height: r.originalRect.height,
      area: r.originalRect.width * r.originalRect.height
    })), { width: regionWidth, height: regionHeight, area: regionArea }];
    
    // Infer device type
    const { deviceType, isLandscape } = inferDeviceType(
      { width: regionWidth, height: regionHeight, area: regionArea },
      allRegionsInfo,
      templateHints
    );

    const newRegion: DeviceRegion = {
      index: deviceRegions.length,
      rect: { x: minX, y: minY, width: regionWidth, height: regionHeight },
      originalRect: { x: minX, y: minY, width: regionWidth, height: regionHeight },
      corners,
      originalCorners: corners.map(c => ({ x: c.x, y: c.y })),
      rotation,
      mask,
      originalMask: new Uint8Array(mask), // Copy of original mask
      userImage: null,
      userImageNatural: null,
      fitMode: 'cover',
      isPartialRegion: isPartial,
      deviceType,
      isLandscape,
    };

    setDeviceRegions(prev => [...prev, newRegion]);
    setSelectedRegionIndex(deviceRegions.length);
    setShowInstructions(false);
    setIsProcessing(false);
    // Note: drawOverlay will be called automatically by the useEffect that watches deviceRegions and selectedRegionIndex
  }, [frameImageData, frameNatural, deviceRegions]);

  // Draw overlay with region highlights and corner handles
  const drawOverlay = useCallback((regions: DeviceRegion[], selectedIdx: number | null, editingCornersOverride?: Point[]) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay || !frameNatural) return;

    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // First pass: Draw non-selected regions with dimmed appearance
    regions.forEach((region, idx) => {
      if (idx === selectedIdx) return; // Skip selected region in first pass

      const corners = region.corners;

      // Draw semi-transparent overlay for non-selected regions
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.closePath();
      ctx.fill();

      // Draw region border
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw region number
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(`${idx + 1}`, corners[0].x + 8, corners[0].y + 24);
    });

    // Second pass: Draw selected region with highlight
    if (selectedIdx !== null && selectedIdx < regions.length) {
      const region = regions[selectedIdx];
      const corners = (isCornerEditMode && editingCornersOverride)
        ? editingCornersOverride
        : region.corners;

      // Draw highlight fill for selected region
      ctx.fillStyle = "rgba(99, 102, 241, 0.1)"; // indigo with low opacity
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.closePath();
      ctx.fill();

      // Draw prominent border for selected region
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = 4;
      ctx.stroke();

      // Draw outer glow effect
      ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
      ctx.lineWidth = 8;
      ctx.stroke();

      // Always draw corner handles for selected region (not just in edit mode)
      // Use larger radius to be visible when canvas is scaled down
      const handleRadius = isCornerEditMode ? 28 : 20;

      // Different colors for each corner for better visibility
      const cornerColors = [
        { fill: "#ef4444", stroke: "#dc2626" }, // Red - Top-left
        { fill: "#22c55e", stroke: "#16a34a" }, // Green - Top-right
        { fill: "#3b82f6", stroke: "#2563eb" }, // Blue - Bottom-right
        { fill: "#f59e0b", stroke: "#d97706" }, // Amber - Bottom-left
      ];

      corners.forEach((corner, cornerIdx) => {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, handleRadius, 0, Math.PI * 2);

        if (isCornerEditMode) {
          // Edit mode: larger, more prominent handles
          if (cornerIdx === draggingCornerIndex) {
            ctx.fillStyle = "#f97316"; // orange for dragging
            ctx.strokeStyle = "#ea580c";
          } else {
            const colors = cornerColors[cornerIdx % 4];
            ctx.fillStyle = colors.fill;
            ctx.strokeStyle = colors.stroke;
          }
          ctx.lineWidth = 4;
        } else {
          // Normal mode: different color for each corner
          const colors = cornerColors[cornerIdx % 4];
          ctx.fillStyle = colors.fill;
          ctx.strokeStyle = colors.stroke;
          ctx.lineWidth = 4;
        }
        ctx.fill();
        ctx.stroke();

        // Draw corner number
        ctx.fillStyle = "white";
        ctx.font = `bold ${isCornerEditMode ? 14 : 12}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${cornerIdx + 1}`, corner.x, corner.y);
      });

      // Reset text alignment
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";

      // Draw "selected" label with device number
      const labelText = `デバイス ${selectedIdx + 1}`;
      const labelX = corners[0].x;
      const labelY = corners[0].y - 12;

      // Label background
      ctx.font = "bold 14px sans-serif";
      const textMetrics = ctx.measureText(labelText);
      const padding = 6;
      ctx.fillStyle = "#6366f1";
      ctx.beginPath();
      ctx.roundRect(labelX - padding, labelY - 14, textMetrics.width + padding * 2, 20, 4);
      ctx.fill();

      // Label text
      ctx.fillStyle = "white";
      ctx.fillText(labelText, labelX, labelY);

      // Draw drop zone indicator if no user image is uploaded (area.jsx style - exact reproduction)
      if (!region.userImage && !isCornerEditMode) {
        // Calculate center of the region
        const centerX = (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
        const centerY = (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;

        // Calculate region dimensions
        const edge1 = Math.sqrt(
          Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2)
        );
        const edge2 = Math.sqrt(
          Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2)
        );
        const regionWidth = Math.max(edge1, edge2);
        const regionHeight = Math.min(edge1, edge2);
        const minDimension = regionHeight;

        // Check if this is a narrow region (smartphone portrait)
        const isNarrow = minDimension < 120;

        // Base scale from area.jsx: iconContainer is 100x80px in design
        // We scale based on available height, targeting roughly 180px reference
        const baseScale = Math.max(0.4, Math.min(1.8, minDimension / 200));
        const iconScale = isNarrow ? baseScale * 0.7 : baseScale;

        ctx.save();

        // Colors matching area.jsx but using #4338ca (indigo) instead of white
        const mainColor = "#4338ca";
        const mainColorStroke = "rgba(67, 56, 202, 0.9)";
        const mainColorLight = "rgba(67, 56, 202, 0.7)";
        const mainColorFaint = "rgba(67, 56, 202, 0.6)";
        const mainColorFill = "rgba(67, 56, 202, 0.15)";

        // ============================================
        // area.jsx Layout Reference:
        // iconContainer: 100px x 80px, marginBottom: 24px
        // - cloudIcon: 80x60px at top:0, left:10px (SVG viewBox 0 0 64 48)
        // - arrowContainer: at top:12px, left:32px
        //   - arrowIcon: 28x28px (SVG viewBox 0 0 24 24)
        // - imageIcon: 40x40px at bottom:-5px, right:5px (SVG viewBox 0 0 32 32)
        // ============================================

        // Icon container dimensions (scaled from 100x80)
        const iconContainerW = 100 * iconScale;
        const iconContainerH = 80 * iconScale;
        const iconContainerX = centerX - iconContainerW / 2;
        const iconContainerY = centerY - iconContainerH / 2 - 30 * iconScale; // Shift up for text

        // ============================================
        // CLOUD ICON - area.jsx SVG viewBox 0 0 64 48
        // Position: 80x60px at top:0, left:10px within 100x80 container
        // ============================================
        const cloudW = 80 * iconScale;
        const cloudH = 60 * iconScale;
        const cloudX = iconContainerX + 10 * iconScale;
        const cloudY = iconContainerY;

        // Scale from SVG viewBox (64x48) to our cloud size
        const cloudScaleX = cloudW / 64;
        const cloudScaleY = cloudH / 48;

        // Transform SVG coordinates to canvas
        const cloudToCanvas = (svgX: number, svgY: number) => ({
          x: cloudX + svgX * cloudScaleX,
          y: cloudY + svgY * cloudScaleY
        });

        // Draw cloud path from area.jsx:
        // "M52 28C52 22.4772 47.5228 18 42 18C41.6558 18 41.3145 18.0137 40.9766 18.0407
        //  C38.8924 12.2353 33.4286 8 27 8C18.7157 8 12 14.7157 12 23C12 23.3404 12.0112 23.6782 12.0333 24.0132
        //  C6.46891 25.1396 2 30.0471 2 36C2 42.6274 7.37258 48 14 48H50
        //  C56.6274 48 62 42.6274 62 36C62 31.0543 58.6329 26.8822 54.0489 25.3644
        //  C53.3749 25.1301 52.6862 24.9426 52 24.8048"
        ctx.strokeStyle = mainColorStroke;
        ctx.fillStyle = mainColorFill;
        ctx.lineWidth = Math.max(2, 3 * iconScale);
        ctx.lineCap = "round";

        ctx.beginPath();
        // M52 28
        let p = cloudToCanvas(52, 28);
        ctx.moveTo(p.x, p.y);
        // C52 22.4772 47.5228 18 42 18
        let cp1 = cloudToCanvas(52, 22.4772);
        let cp2 = cloudToCanvas(47.5228, 18);
        let end = cloudToCanvas(42, 18);
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
        // C41.6558 18 41.3145 18.0137 40.9766 18.0407
        cp1 = cloudToCanvas(41.6558, 18);
        cp2 = cloudToCanvas(41.3145, 18.0137);
        end = cloudToCanvas(40.9766, 18.0407);
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
        // C38.8924 12.2353 33.4286 8 27 8
        cp1 = cloudToCanvas(38.8924, 12.2353);
        cp2 = cloudToCanvas(33.4286, 8);
        end = cloudToCanvas(27, 8);
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
        // C18.7157 8 12 14.7157 12 23
        cp1 = cloudToCanvas(18.7157, 8);
        cp2 = cloudToCanvas(12, 14.7157);
        end = cloudToCanvas(12, 23);
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
        // C12 23.3404 12.0112 23.6782 12.0333 24.0132
        cp1 = cloudToCanvas(12, 23.3404);
        cp2 = cloudToCanvas(12.0112, 23.6782);
        end = cloudToCanvas(12.0333, 24.0132);
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
        // C6.46891 25.1396 2 30.0471 2 36
        cp1 = cloudToCanvas(6.46891, 25.1396);
        cp2 = cloudToCanvas(2, 30.0471);
        end = cloudToCanvas(2, 36);
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
        // C2 42.6274 7.37258 48 14 48
        cp1 = cloudToCanvas(2, 42.6274);
        cp2 = cloudToCanvas(7.37258, 48);
        end = cloudToCanvas(14, 48);
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
        // H50 (horizontal line to x=50)
        end = cloudToCanvas(50, 48);
        ctx.lineTo(end.x, end.y);
        // C56.6274 48 62 42.6274 62 36
        cp1 = cloudToCanvas(56.6274, 48);
        cp2 = cloudToCanvas(62, 42.6274);
        end = cloudToCanvas(62, 36);
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
        // C62 31.0543 58.6329 26.8822 54.0489 25.3644
        cp1 = cloudToCanvas(62, 31.0543);
        cp2 = cloudToCanvas(58.6329, 26.8822);
        end = cloudToCanvas(54.0489, 25.3644);
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
        // C53.3749 25.1301 52.6862 24.9426 52 24.8048
        cp1 = cloudToCanvas(53.3749, 25.1301);
        cp2 = cloudToCanvas(52.6862, 24.9426);
        end = cloudToCanvas(52, 24.8048);
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);

        ctx.fill();
        ctx.stroke();

        // ============================================
        // ARROW ICON - area.jsx SVG viewBox 0 0 24 24
        // Position: 28x28px at top:12px, left:32px within 100x80 container
        // Path: "M12 19V5M12 5L5 12M12 5L19 12"
        // ============================================
        const arrowW = 28 * iconScale;
        const arrowH = 28 * iconScale;
        const arrowX = iconContainerX + 32 * iconScale;
        const arrowY = iconContainerY + 12 * iconScale;

        // Scale from SVG viewBox (24x24)
        const arrowScaleX = arrowW / 24;
        const arrowScaleY = arrowH / 24;

        const arrowToCanvas = (svgX: number, svgY: number) => ({
          x: arrowX + svgX * arrowScaleX,
          y: arrowY + svgY * arrowScaleY
        });

        ctx.strokeStyle = mainColorStroke;
        ctx.lineWidth = Math.max(2, 2.5 * iconScale);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // M12 19V5 (vertical line from bottom to top)
        ctx.beginPath();
        p = arrowToCanvas(12, 19);
        ctx.moveTo(p.x, p.y);
        p = arrowToCanvas(12, 5);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // M12 5L5 12 (left arrow head)
        ctx.beginPath();
        p = arrowToCanvas(12, 5);
        ctx.moveTo(p.x, p.y);
        p = arrowToCanvas(5, 12);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // M12 5L19 12 (right arrow head)
        ctx.beginPath();
        p = arrowToCanvas(12, 5);
        ctx.moveTo(p.x, p.y);
        p = arrowToCanvas(19, 12);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // ============================================
        // IMAGE ICON - area.jsx SVG viewBox 0 0 32 32
        // Position: 40x40px at bottom:-5px, right:5px within 100x80 container
        // ============================================
        const imgIconW = 40 * iconScale;
        const imgIconH = 40 * iconScale;
        // bottom:-5px means iconContainerY + iconContainerH + 5 - imgIconH
        // right:5px means iconContainerX + iconContainerW - 5 - imgIconW
        const imgIconX = iconContainerX + iconContainerW - 5 * iconScale - imgIconW;
        const imgIconY = iconContainerY + iconContainerH + 5 * iconScale - imgIconH;

        // Scale from SVG viewBox (32x32)
        const imgScaleX = imgIconW / 32;
        const imgScaleY = imgIconH / 32;

        const imgToCanvas = (svgX: number, svgY: number) => ({
          x: imgIconX + svgX * imgScaleX,
          y: imgIconY + svgY * imgScaleY
        });

        // Rounded rectangle: rect x=2, y=6, width=28, height=20, rx=3
        ctx.strokeStyle = mainColorLight;
        ctx.fillStyle = mainColorFill;
        ctx.lineWidth = Math.max(1.5, 2 * iconScale);

        const rectStart = imgToCanvas(2, 6);
        const rectW = 28 * imgScaleX;
        const rectH = 20 * imgScaleY;
        const rectRx = 3 * imgScaleX;

        ctx.beginPath();
        ctx.moveTo(rectStart.x + rectRx, rectStart.y);
        ctx.lineTo(rectStart.x + rectW - rectRx, rectStart.y);
        ctx.quadraticCurveTo(rectStart.x + rectW, rectStart.y, rectStart.x + rectW, rectStart.y + rectRx);
        ctx.lineTo(rectStart.x + rectW, rectStart.y + rectH - rectRx);
        ctx.quadraticCurveTo(rectStart.x + rectW, rectStart.y + rectH, rectStart.x + rectW - rectRx, rectStart.y + rectH);
        ctx.lineTo(rectStart.x + rectRx, rectStart.y + rectH);
        ctx.quadraticCurveTo(rectStart.x, rectStart.y + rectH, rectStart.x, rectStart.y + rectH - rectRx);
        ctx.lineTo(rectStart.x, rectStart.y + rectRx);
        ctx.quadraticCurveTo(rectStart.x, rectStart.y, rectStart.x + rectRx, rectStart.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Circle (sun): cx=10, cy=13, r=3
        const circleCenter = imgToCanvas(10, 13);
        const circleR = 3 * imgScaleX;
        ctx.fillStyle = mainColorFaint;
        ctx.beginPath();
        ctx.arc(circleCenter.x, circleCenter.y, circleR, 0, Math.PI * 2);
        ctx.fill();

        // Mountain path: "M4 22L10 16L14 20L22 12L28 18"
        ctx.strokeStyle = mainColorFaint;
        ctx.lineWidth = Math.max(1.5, 2 * iconScale);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        p = imgToCanvas(4, 22);
        ctx.moveTo(p.x, p.y);
        p = imgToCanvas(10, 16);
        ctx.lineTo(p.x, p.y);
        p = imgToCanvas(14, 20);
        ctx.lineTo(p.x, p.y);
        p = imgToCanvas(22, 12);
        ctx.lineTo(p.x, p.y);
        p = imgToCanvas(28, 18);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // ============================================
        // TEXT - area.jsx style
        // title: fontSize: 18px, fontWeight: 600, lineHeight: 1.5
        // subtitle: fontSize: 14px, fontWeight: 400
        // ============================================
        const textStartY = iconContainerY + iconContainerH + 24 * iconScale; // marginBottom: 24px
        const titleFontSize = Math.max(11, 18 * iconScale);
        const subtitleFontSize = Math.max(9, 14 * iconScale);

        ctx.fillStyle = mainColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = `600 ${titleFontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;

        if (isNarrow) {
          // Compact text for narrow regions
          ctx.fillText("Drag & drop", centerX, textStartY);
          ctx.fillText("or click", centerX, textStartY + titleFontSize * 1.5);
        } else {
          // Full text as in area.jsx: "Drag & drop an image here, or click to select file"
          ctx.fillText("Drag & drop an image here,", centerX, textStartY);
          ctx.fillText("or click to select file", centerX, textStartY + titleFontSize * 1.5);
        }

        // Subtitle: "JPG, PNG, WebP (最大 5MB)"
        ctx.fillStyle = mainColorLight;
        ctx.font = `400 ${subtitleFontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;
        ctx.fillText("JPG, PNG, WebP", centerX, textStartY + titleFontSize * 3.2);

        ctx.restore();
      }
    }
  }, [frameNatural, isCornerEditMode, draggingCornerIndex]);

  // Redraw overlay when selection changes, editing corners change, or frame is loaded
  useEffect(() => {
    if (!frameNatural) return; // Wait for frame to be loaded
    if (deviceRegions.length === 0) return; // Wait for regions to be detected

    if (isCornerEditMode && editingCorners.length > 0) {
      drawOverlay(deviceRegions, selectedRegionIndex, editingCorners);
    } else {
      drawOverlay(deviceRegions, selectedRegionIndex);
    }
  }, [deviceRegions, selectedRegionIndex, drawOverlay, isCornerEditMode, editingCorners, frameNatural]);

  // Corner editing functions
  const startCornerEditMode = useCallback(() => {
    if (selectedRegionIndex === null) return;
    const region = deviceRegions[selectedRegionIndex];
    if (!region) return;
    
    // Deep copy the corners
    const cornersCopy = region.corners.map(c => ({ x: c.x, y: c.y }));
    setOriginalCorners(cornersCopy);
    setEditingCorners(cornersCopy);
    setIsCornerEditMode(true);
  }, [selectedRegionIndex, deviceRegions]);

  const cancelCornerEditMode = useCallback(() => {
    setIsCornerEditMode(false);
    setEditingCorners([]);
    setOriginalCorners([]);
    setDraggingCornerIndex(null);
  }, []);

  const confirmCornerEdit = useCallback(() => {
    if (selectedRegionIndex === null || editingCorners.length !== 4) return;
    
    const region = deviceRegions[selectedRegionIndex];
    if (!region) return;
    
    // Calculate new bounding rect from corners
    const minX = Math.min(...editingCorners.map(c => c.x));
    const maxX = Math.max(...editingCorners.map(c => c.x));
    const minY = Math.min(...editingCorners.map(c => c.y));
    const maxY = Math.max(...editingCorners.map(c => c.y));
    const newWidth = Math.ceil(maxX - minX) + 1;
    const newHeight = Math.ceil(maxY - minY) + 1;
    const newRect = { x: Math.floor(minX), y: Math.floor(minY), width: newWidth, height: newHeight };
    
    // Regenerate mask from new corners
    const newMask = regenerateMaskFromCorners(editingCorners, newRect);
    
    // Calculate new rotation
    const newRotation = calculateRotationFromCorners(editingCorners);
    
    // Update the region
    setDeviceRegions(prev => prev.map((r, idx) => {
      if (idx === selectedRegionIndex) {
        return {
          ...r,
          corners: editingCorners.map(c => ({ x: c.x, y: c.y })),
          rect: newRect,
          mask: newMask,
          rotation: newRotation,
        };
      }
      return r;
    }));
    
    setIsCornerEditMode(false);
    setEditingCorners([]);
    setOriginalCorners([]);
    setDraggingCornerIndex(null);
  }, [selectedRegionIndex, editingCorners, deviceRegions]);

  // Get canvas coordinates from event
  const getCanvasCoords = useCallback((clientX: number, clientY: number): Point | null => {
    const overlay = overlayCanvasRef.current;
    if (!overlay || !frameNatural) return null;
    
    const rect = overlay.getBoundingClientRect();
    const sx = frameNatural.w / rect.width;
    const sy = frameNatural.h / rect.height;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }, [frameNatural]);

  // Find which corner is near the given point
  const findNearCorner = useCallback((point: Point, corners: Point[]): number | null => {
    const threshold = 20; // pixels in canvas coordinates
    for (let i = 0; i < corners.length; i++) {
      const dx = point.x - corners[i].x;
      const dy = point.y - corners[i].y;
      if (Math.sqrt(dx * dx + dy * dy) <= threshold) {
        return i;
      }
    }
    return null;
  }, []);

  // Mouse/Touch handlers for corner dragging
  const handleCornerDragStart = useCallback((clientX: number, clientY: number) => {
    if (!isCornerEditMode || editingCorners.length !== 4) return;
    
    const point = getCanvasCoords(clientX, clientY);
    if (!point) return;
    
    const cornerIdx = findNearCorner(point, editingCorners);
    if (cornerIdx !== null) {
      setDraggingCornerIndex(cornerIdx);
    }
  }, [isCornerEditMode, editingCorners, getCanvasCoords, findNearCorner]);

  const handleCornerDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isCornerEditMode || draggingCornerIndex === null) return;
    
    const point = getCanvasCoords(clientX, clientY);
    if (!point) return;
    
    // Update the dragging corner position
    setEditingCorners(prev => {
      const updated = [...prev];
      updated[draggingCornerIndex] = { x: point.x, y: point.y };
      return updated;
    });
  }, [isCornerEditMode, draggingCornerIndex, getCanvasCoords]);

  const handleCornerDragEnd = useCallback(() => {
    setDraggingCornerIndex(null);
  }, []);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isCornerEditMode) {
      handleCornerDragStart(e.clientX, e.clientY);
    }
  }, [isCornerEditMode, handleCornerDragStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isCornerEditMode && draggingCornerIndex !== null) {
      handleCornerDragMove(e.clientX, e.clientY);
    }
  }, [isCornerEditMode, draggingCornerIndex, handleCornerDragMove]);

  const handleMouseUp = useCallback(() => {
    if (isCornerEditMode) {
      handleCornerDragEnd();
    }
  }, [isCornerEditMode, handleCornerDragEnd]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isCornerEditMode && e.touches.length === 1) {
      const touch = e.touches[0];
      handleCornerDragStart(touch.clientX, touch.clientY);
    }
  }, [isCornerEditMode, handleCornerDragStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isCornerEditMode && draggingCornerIndex !== null && e.touches.length === 1) {
      e.preventDefault(); // Prevent scrolling
      const touch = e.touches[0];
      handleCornerDragMove(touch.clientX, touch.clientY);
    }
  }, [isCornerEditMode, draggingCornerIndex, handleCornerDragMove]);

  const handleTouchEnd = useCallback(() => {
    if (isCornerEditMode) {
      handleCornerDragEnd();
    }
  }, [isCornerEditMode, handleCornerDragEnd]);

  // Process image file and apply to region
  const processImageForRegion = useCallback((file: File, regionIndex: number) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setDeviceRegions(prev => prev.map((region, idx) => {
        if (idx === regionIndex) {
          // Revoke old URL
          if (region.userImage) {
            URL.revokeObjectURL(region.userImage);
          }
          return {
            ...region,
            userImage: url,
            userImageNatural: { w: img.naturalWidth, h: img.naturalHeight },
          };
        }
        return region;
      }));

      // Regenerate composite
      generateComposite();
    };
    img.src = url;
  }, []);

  // Handle file upload for selected region
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || selectedRegionIndex === null) return;

    processImageForRegion(file, selectedRegionIndex);
    e.target.value = "";
  }, [selectedRegionIndex, processImageForRegion]);

  // Find region at canvas coordinates
  const findRegionAtPosition = useCallback((clientX: number, clientY: number): number | null => {
    const overlay = overlayCanvasRef.current;
    if (!overlay || !frameNatural) return null;

    const rect = overlay.getBoundingClientRect();
    const sx = frameNatural.w / rect.width;
    const sy = frameNatural.h / rect.height;
    const x = Math.floor((clientX - rect.left) * sx);
    const y = Math.floor((clientY - rect.top) * sy);

    for (let i = deviceRegions.length - 1; i >= 0; i--) {
      const region = deviceRegions[i];
      if (
        x >= region.rect.x &&
        x <= region.rect.x + region.rect.width &&
        y >= region.rect.y &&
        y <= region.rect.y + region.rect.height
      ) {
        return i;
      }
    }
    return null;
  }, [frameNatural, deviceRegions]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);

    // Find which region is being dragged over
    const regionIndex = findRegionAtPosition(e.clientX, e.clientY);
    setDragOverRegionIndex(regionIndex);
  }, [findRegionAtPosition]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    setDragOverRegionIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    setDragOverRegionIndex(null);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    // Find which region was dropped on
    const regionIndex = findRegionAtPosition(e.clientX, e.clientY);
    
    if (regionIndex !== null) {
      // Drop on specific region
      processImageForRegion(file, regionIndex);
      setSelectedRegionIndex(regionIndex);
    } else if (selectedRegionIndex !== null) {
      // Drop anywhere but use selected region
      processImageForRegion(file, selectedRegionIndex);
    } else if (deviceRegions.length > 0) {
      // Drop on first available region without image
      const emptyRegionIndex = deviceRegions.findIndex(r => !r.userImage);
      if (emptyRegionIndex !== -1) {
        processImageForRegion(file, emptyRegionIndex);
        setSelectedRegionIndex(emptyRegionIndex);
      } else {
        // All regions have images, use first region
        processImageForRegion(file, 0);
        setSelectedRegionIndex(0);
      }
    }
  }, [findRegionAtPosition, processImageForRegion, selectedRegionIndex, deviceRegions]);

  // Generate composite image with user images embedded
  const generateComposite = useCallback((forDownload: boolean = false): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!item || !frameNatural || !frameImageData) {
        resolve(null);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = frameNatural.w;
      canvas.height = frameNatural.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      const frameImg = new Image();
      frameImg.crossOrigin = "anonymous";
      frameImg.onload = () => {
      // 重要: 最初にフレーム画像全体を描画する
      // これにより背景（テーブル、本、影など）が保持される
      // ユーザー画像は後でクリップ領域内にのみ描画される
      ctx.drawImage(frameImg, 0, 0);

      const regionsWithImages = deviceRegions.filter(r => r.userImage);

      // ========== スクリーン領域内の白ピクセルを黒に変換（ImageData操作） ==========
      // Canvas 2Dのfill()はアンチエイリアシングを無効化できないため、
      // ImageData操作でピクセル単位の正確な変換を行う
      // これにより、フレームの元のアウトラインは完全に保持される
      if (deviceRegions.length > 0) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        const canvasWidth = canvas.width;

        // スクリーン領域の四角形を構築（拡張なし - 元の検出境界を使用）
        const screenQuads: Point[][] = deviceRegions.map(region => {
          const corners = region.corners;
          if (!corners) return [];

          // コーナーを並べ替えて[左上, 右上, 右下, 左下]順にする
          const rcenterX = corners.reduce((sum, c) => sum + c.x, 0) / 4;
          const rcenterY = corners.reduce((sum, c) => sum + c.y, 0) / 4;
          const cornersWithAngle = corners.map((c) => ({
            point: c,
            angle: Math.atan2(c.y - rcenterY, c.x - rcenterX)
          }));
          const topTwo = [...cornersWithAngle].sort((a, b) => a.point.y - b.point.y).slice(0, 2);
          const bottomTwo = [...cornersWithAngle].sort((a, b) => a.point.y - b.point.y).slice(2, 4);
          topTwo.sort((a, b) => a.point.x - b.point.x);
          bottomTwo.sort((a, b) => a.point.x - b.point.x);

          return [
            topTwo[0].point,    // 左上
            topTwo[1].point,    // 右上
            bottomTwo[1].point, // 右下
            bottomTwo[0].point  // 左下
          ];
        }).filter(quad => quad.length === 4);

        // 点が四角形の内部にあるかチェック（クロス積による判定）
        const isPointInScreenQuad = (px: number, py: number, quad: Point[]): boolean => {
          const crossProduct = (p0: Point, p1: Point, p: Point): number => {
            return (p1.x - p0.x) * (p.y - p0.y) - (p1.y - p0.y) * (p.x - p0.x);
          };
          const cross0 = crossProduct(quad[0], quad[1], { x: px, y: py });
          const cross1 = crossProduct(quad[1], quad[2], { x: px, y: py });
          const cross2 = crossProduct(quad[2], quad[3], { x: px, y: py });
          const cross3 = crossProduct(quad[3], quad[0], { x: px, y: py });
          const allPositive = cross0 >= 0 && cross1 >= 0 && cross2 >= 0 && cross3 >= 0;
          const allNegative = cross0 <= 0 && cross1 <= 0 && cross2 <= 0 && cross3 <= 0;
          return allPositive || allNegative;
        };

        // 白ピクセルの判定閾値
        // 境界部分のグレーピクセルも確実に黒に変換するため、
        // 元の白エリア検出（0.90）より低めに設定
        const WHITE_LUMINANCE = 0.80;

        // 各スクリーン領域を処理
        screenQuads.forEach(quad => {
          // バウンディングボックスを計算
          const xs = quad.map(p => p.x);
          const ys = quad.map(p => p.y);
          const minX = Math.max(0, Math.floor(Math.min(...xs)));
          const maxX = Math.min(canvasWidth - 1, Math.ceil(Math.max(...xs)));
          const minY = Math.max(0, Math.floor(Math.min(...ys)));
          const maxY = Math.min(canvas.height - 1, Math.ceil(Math.max(...ys)));

          // バウンディングボックス内のピクセルを処理
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              // スクリーン領域の四角形内部にあるかチェック
              if (!isPointInScreenQuad(x, y, quad)) continue;

              const idx = (y * canvasWidth + x) * 4;
              const r = pixels[idx];
              const g = pixels[idx + 1];
              const b = pixels[idx + 2];
              const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

              // 白ピクセルのみを黒に変換
              if (luminance >= WHITE_LUMINANCE) {
                pixels[idx] = 0;     // R
                pixels[idx + 1] = 0; // G
                pixels[idx + 2] = 0; // B
                // アルファは変更しない
              }
            }
          }
        });

        ctx.putImageData(imageData, 0, 0);
      }

      if (regionsWithImages.length === 0) {
        // No user images, frame already drawn above
        const dataUrl = canvas.toDataURL("image/png");
        if (!forDownload) {
          setCompositeUrl(dataUrl);
        }
        resolve(dataUrl);
        return;
      }

      let loadCount = 0;

      regionsWithImages.forEach(region => {
        if (!region.userImage || !region.userImageNatural) return;

        const userImg = new Image();
        userImg.crossOrigin = "anonymous";
        userImg.onload = () => {
          const { w: imgW, h: imgH } = region.userImageNatural!;
          const fitMode = region.fitMode || 'cover';

          // For partial regions or mask-based clipping, use the bounding rect dimensions
          // For full quadrilateral regions, use corner-based dimensions
          let screenW: number, screenH: number;
          let centerX: number, centerY: number;
          let rotation: number;
          
          if (region.isPartialRegion) {
            // For partial/cut-off regions, use bounding rect and no rotation
            screenW = region.originalRect.width;
            screenH = region.originalRect.height;
            centerX = region.originalRect.x + screenW / 2;
            centerY = region.originalRect.y + screenH / 2;
            rotation = 0; // No rotation for partial regions
          } else {
            // Calculate dimensions from corners
            // corners: [topLeft, topRight, bottomRight, bottomLeft] (時計回り、minAreaRectで並び替え済み)
            const corners = region.corners;

            // ガイドの辺の長さを計算
            const edge01 = Math.sqrt((corners[1].x - corners[0].x) ** 2 + (corners[1].y - corners[0].y) ** 2); // 上辺 (幅)
            const edge12 = Math.sqrt((corners[2].x - corners[1].x) ** 2 + (corners[2].y - corners[1].y) ** 2); // 右辺 (高さ)

            // ガイドの中心を計算
            centerX = (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
            centerY = (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;

            // region.rotationを使用（minAreaRectで計算された「正立」にするための回転角度）
            // これはデバイスの向きに基づいて画像を正しく配置するための角度
            rotation = region.rotation;

            // ガイドの幅と高さ（辺の長さベース）
            // minAreaRectでは top-left から時計回りに並べ替えられるため:
            // - edge01 (corner[0]→corner[1]) は「上辺」= 幅
            // - edge12 (corner[1]→corner[2]) は「右辺」= 高さ
            screenW = edge01;
            screenH = edge12;
          }
          
          // Calculate scale based on fit mode - preserve image aspect ratio
          const imgRatio = imgW / imgH;
          
          let drawW: number, drawH: number;
          
          if (fitMode === 'cover') {
            // Cover: fill the entire screen area, may crop image
            const scaleW = screenW / imgW;
            const scaleH = screenH / imgH;
            const scale = Math.max(scaleW, scaleH);
            drawW = imgW * scale;
            drawH = imgH * scale;
          } else {
            // Contain: show entire image, may have empty space
            // Image should fit within screen while maintaining aspect ratio
            const scaleW = screenW / imgW;
            const scaleH = screenH / imgH;
            const scale = Math.min(scaleW, scaleH);
            drawW = imgW * scale;
            drawH = imgH * scale;
          }

          // Use Canvas clip() for precise clipping
          ctx.save();

          if (region.isPartialRegion) {
            // For partial regions, use pixel mask-based clipping via path from contour
            // Create path from the mask boundary
            const { x: rx, y: ry, width: rw, height: rh } = region.originalRect;
            const mask = region.originalMask;

            // Build clipping path by scanning mask edges
            ctx.beginPath();
            // Use a simpler approach: draw a filled path covering masked area
            for (let j = 0; j < rh; j++) {
              let inMask = false;
              let startX = 0;
              for (let i = 0; i <= rw; i++) {
                const isMasked = i < rw && mask[j * rw + i] === 1;
                if (isMasked && !inMask) {
                  startX = i;
                  inMask = true;
                } else if (!isMasked && inMask) {
                  // Draw horizontal line segment
                  ctx.rect(rx + startX, ry + j, i - startX, 1);
                  inMask = false;
                }
              }
            }
            ctx.clip();

            // Draw user image (no rotation for partial regions)
            ctx.translate(centerX, centerY);
            ctx.drawImage(userImg, 0, 0, imgW, imgH, -drawW / 2, -drawH / 2, drawW, drawH);
          } else {
            // ========== 透視変換による画像描画 ==========
            // 画像の4隅をガイドの4隅に正確にマッピング
            const corners = region.corners;

            // デバッグ情報（ダウンロード時は出力しない）
            if (!forDownload) {
              console.log('=== 透視変換デバッグ ===');
              console.log('ガイドcorners座標:');
              corners.forEach((c, i) => {
                console.log(`  corner[${i}]: (${c.x.toFixed(1)}, ${c.y.toFixed(1)})`);
              });
            }

            // ステップ1: cornersの順序を [左上, 右上, 右下, 左下] に並べ替え
            // 現在のcornersは検出順なので、座標に基づいて並べ替える必要がある

            // 中心座標を計算
            const centerX = corners.reduce((sum, c) => sum + c.x, 0) / 4;
            const centerY = corners.reduce((sum, c) => sum + c.y, 0) / 4;

            // 各コーナーを中心からの角度でソート
            // 左上 = 角度が -180° ~ -90° の範囲（第3象限寄り）
            // 右上 = 角度が -90° ~ 0° の範囲（第4象限）
            // 右下 = 角度が 0° ~ 90° の範囲（第1象限）
            // 左下 = 角度が 90° ~ 180° の範囲（第2象限）
            const cornersWithAngle = corners.map((c, i) => ({
              point: c,
              index: i,
              angle: Math.atan2(c.y - centerY, c.x - centerX)
            }));

            // 角度でソート（-PI から PI）
            cornersWithAngle.sort((a, b) => a.angle - b.angle);

            // ソート後の順序: [左, 左下, 右下, 右上] または [左上, 左下, 右下, 右上]
            // 実際には角度の開始点によって変わるので、Y座標が小さい2点を「上」とする
            const topTwo = [...cornersWithAngle].sort((a, b) => a.point.y - b.point.y).slice(0, 2);
            const bottomTwo = [...cornersWithAngle].sort((a, b) => a.point.y - b.point.y).slice(2, 4);

            // 上の2点のうちX座標が小さい方が左上
            topTwo.sort((a, b) => a.point.x - b.point.x);
            const topLeft = topTwo[0].point;
            const topRight = topTwo[1].point;

            // 下の2点のうちX座標が大きい方が右下
            bottomTwo.sort((a, b) => a.point.x - b.point.x);
            const bottomLeft = bottomTwo[0].point;
            const bottomRight = bottomTwo[1].point;

            // drawPerspectiveImage が期待する順序: [左上, 右上, 右下, 左下]
            // 白エリア検出のboundsは実際のベゼル境界より1-2px内側になることがあるため、
            // 各頂点を外側に拡張して白い隙間を防止する
            // 黒塗り下地（EXPAND = 5）と同じか少し大きくして、ユーザー画像が黒塗りをカバー
            const EXPAND_PIXELS = 5; // 拡張ピクセル数

            // 単純な方法: 各頂点をその位置に応じて外側に移動
            // 左上 → 左上方向に拡張 (-X, -Y)
            // 右上 → 右上方向に拡張 (+X, -Y)
            // 右下 → 右下方向に拡張 (+X, +Y)
            // 左下 → 左下方向に拡張 (-X, +Y)
            const expandedTopLeft: PerspectivePoint = {
              x: topLeft.x - EXPAND_PIXELS,
              y: topLeft.y - EXPAND_PIXELS
            };
            const expandedTopRight: PerspectivePoint = {
              x: topRight.x + EXPAND_PIXELS,
              y: topRight.y - EXPAND_PIXELS
            };
            const expandedBottomRight: PerspectivePoint = {
              x: bottomRight.x + EXPAND_PIXELS,
              y: bottomRight.y + EXPAND_PIXELS
            };
            const expandedBottomLeft: PerspectivePoint = {
              x: bottomLeft.x - EXPAND_PIXELS,
              y: bottomLeft.y + EXPAND_PIXELS
            };

            const dstCorners: [PerspectivePoint, PerspectivePoint, PerspectivePoint, PerspectivePoint] = [
              expandedTopLeft,
              expandedTopRight,
              expandedBottomRight,
              expandedBottomLeft
            ];

            // クリッピングパスも拡張された頂点で設定
            ctx.beginPath();
            ctx.moveTo(expandedTopLeft.x, expandedTopLeft.y);
            ctx.lineTo(expandedTopRight.x, expandedTopRight.y);
            ctx.lineTo(expandedBottomRight.x, expandedBottomRight.y);
            ctx.lineTo(expandedBottomLeft.x, expandedBottomLeft.y);
            ctx.closePath();
            ctx.clip();

            if (!forDownload) {
              console.log('並べ替え後のdstCorners:');
              console.log(`  左上: (${topLeft.x.toFixed(1)}, ${topLeft.y.toFixed(1)})`);
              console.log(`  右上: (${topRight.x.toFixed(1)}, ${topRight.y.toFixed(1)})`);
              console.log(`  右下: (${bottomRight.x.toFixed(1)}, ${bottomRight.y.toFixed(1)})`);
              console.log(`  左下: (${bottomLeft.x.toFixed(1)}, ${bottomLeft.y.toFixed(1)})`);
            }

            // ステップ2: ガイドのサイズを計算（上辺と左辺の長さ）
            const guideTopWidth = Math.sqrt(
              Math.pow(topRight.x - topLeft.x, 2) +
              Math.pow(topRight.y - topLeft.y, 2)
            );
            const guideLeftHeight = Math.sqrt(
              Math.pow(bottomLeft.x - topLeft.x, 2) +
              Math.pow(bottomLeft.y - topLeft.y, 2)
            );
            const guideAspectRatio = guideTopWidth / guideLeftHeight;
            const imgAspectRatio = imgW / imgH;

            if (!forDownload) {
              console.log('サイズ情報:');
              console.log(`  ガイド上辺: ${guideTopWidth.toFixed(1)}, ガイド左辺: ${guideLeftHeight.toFixed(1)}`);
              console.log(`  ガイドアスペクト比: ${guideAspectRatio.toFixed(3)}`);
              console.log(`  画像サイズ: ${imgW}x${imgH}, アスペクト比: ${imgAspectRatio.toFixed(3)}`);
              console.log(`  fitMode: ${fitMode}`);
            }

            // ステップ3: ソース画像の4隅を計算（contain/coverに応じて）
            let srcCorners: [PerspectivePoint, PerspectivePoint, PerspectivePoint, PerspectivePoint];

            if (fitMode === 'cover') {
              // cover: ガイドを完全に覆う（画像の一部がクリップされる）
              // 画像のアスペクト比をガイドに合わせてクロップ
              let cropW = imgW;
              let cropH = imgH;
              let cropX = 0;
              let cropY = 0;

              if (imgAspectRatio > guideAspectRatio) {
                // 画像の方が横長 → 左右をクロップ
                cropW = imgH * guideAspectRatio;
                cropX = (imgW - cropW) / 2;
              } else {
                // 画像の方が縦長 → 上下をクロップ
                cropH = imgW / guideAspectRatio;
                cropY = (imgH - cropH) / 2;
              }

              srcCorners = [
                { x: cropX, y: cropY },                    // 左上
                { x: cropX + cropW, y: cropY },            // 右上
                { x: cropX + cropW, y: cropY + cropH },    // 右下
                { x: cropX, y: cropY + cropH }             // 左下
              ];

              if (!forDownload) {
                console.log(`  cover: クロップ領域 (${cropX.toFixed(1)}, ${cropY.toFixed(1)}) - ${cropW.toFixed(1)}x${cropH.toFixed(1)}`);
              }
            } else {
              // contain: 画像全体がガイド内に収まる
              // 画像全体を使用し、ガイド内で余白ができる場合は中央配置
              //
              // ただし透視変換では「ガイドの形に画像を変形」するので、
              // containの場合は画像のアスペクト比を維持しながら
              // ガイド内に収まる最大サイズで描画する

              // 画像全体を変形してガイドにマッピング
              // これにより画像がガイドの形に変形される
              srcCorners = [
                { x: 0, y: 0 },           // 左上
                { x: imgW, y: 0 },        // 右上
                { x: imgW, y: imgH },     // 右下
                { x: 0, y: imgH }         // 左下
              ];

              if (!forDownload) {
                console.log(`  contain: 画像全体を使用 (0, 0) - ${imgW}x${imgH}`);
              }
            }

            if (!forDownload) {
              console.log('srcCorners:');
              srcCorners.forEach((c, i) => {
                console.log(`  src[${i}]: (${c.x.toFixed(1)}, ${c.y.toFixed(1)})`);
              });
              console.log('=== 透視変換デバッグ終了 ===');
            }

            // ステップ4: 透視変換で画像を描画
            // meshSize を調整してパフォーマンスと品質のバランスを取る
            // ダウンロード時は高品質 (64分割 = 4096セル × 2三角形 = 8192回の描画)
            // プレビュー時は高速 (16分割 = 256セル × 2三角形 = 512回の描画)
            const meshSize = forDownload ? 64 : 16;

            // 透視変換で画像を描画
            // perspectiveTransform内で四角形内部を黒で初期化してから画像を描画するため、
            // 境界付近の白い隙間は発生しない
            drawPerspectiveImage(ctx, userImg, srcCorners, dstCorners, meshSize);
          }

          ctx.restore();

          loadCount++;
          if (loadCount === regionsWithImages.length) {
            // All user images drawn and clipped
            // Now overlay the frame's non-white, non-transparent pixels (bezel) on top
            // This ensures bezels are never covered by user images
            const compositeData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = compositeData.data;
            const frameData = frameImageData.data;

            // 白判定閾値を白領域検出と統一（ITU-R BT.601輝度 >= 0.90）
            // これにより白いスキマ（境界のグレーピクセル露出）を防止
            const WHITE_LUMINANCE_THRESHOLD = 0.90;

            // 点が四角形の内部にあるかチェックする関数
            const isPointInQuad = (px: number, py: number, quad: Point[]): boolean => {
              // クロス積の符号で判定
              const crossProduct = (p0: Point, p1: Point, p: Point): number => {
                return (p1.x - p0.x) * (p.y - p0.y) - (p1.y - p0.y) * (p.x - p0.x);
              };
              const cross0 = crossProduct(quad[0], quad[1], { x: px, y: py });
              const cross1 = crossProduct(quad[1], quad[2], { x: px, y: py });
              const cross2 = crossProduct(quad[2], quad[3], { x: px, y: py });
              const cross3 = crossProduct(quad[3], quad[0], { x: px, y: py });
              const allPositive = cross0 >= 0 && cross1 >= 0 && cross2 >= 0 && cross3 >= 0;
              const allNegative = cross0 <= 0 && cross1 <= 0 && cross2 <= 0 && cross3 <= 0;
              return allPositive || allNegative;
            };

            // 各リージョンのコーナーを並べ替えて拡張して保存
            // 透視変換と同じ拡張を適用して、はみ出し判定の整合性を保つ
            const REGION_EXPAND_PIXELS = 2;
            const sortedRegionCorners: Point[][] = regionsWithImages.map((region) => {
              const corners = region.corners;
              const rcenterX = corners.reduce((sum, c) => sum + c.x, 0) / 4;
              const rcenterY = corners.reduce((sum, c) => sum + c.y, 0) / 4;
              const cornersWithAngle = corners.map((c) => ({
                point: c,
                angle: Math.atan2(c.y - rcenterY, c.x - rcenterX)
              }));
              const topTwo = [...cornersWithAngle].sort((a, b) => a.point.y - b.point.y).slice(0, 2);
              const bottomTwo = [...cornersWithAngle].sort((a, b) => a.point.y - b.point.y).slice(2, 4);
              topTwo.sort((a, b) => a.point.x - b.point.x);
              bottomTwo.sort((a, b) => a.point.x - b.point.x);

              // 並べ替え後: [左上, 右上, 右下, 左下]
              const tl = topTwo[0].point;
              const tr = topTwo[1].point;
              const br = bottomTwo[1].point;
              const bl = bottomTwo[0].point;

              // 単純な方法で各頂点を外側に拡張
              return [
                { x: tl.x - REGION_EXPAND_PIXELS, y: tl.y - REGION_EXPAND_PIXELS }, // 左上
                { x: tr.x + REGION_EXPAND_PIXELS, y: tr.y - REGION_EXPAND_PIXELS }, // 右上
                { x: br.x + REGION_EXPAND_PIXELS, y: br.y + REGION_EXPAND_PIXELS }, // 右下
                { x: bl.x - REGION_EXPAND_PIXELS, y: bl.y + REGION_EXPAND_PIXELS }  // 左下
              ];
            });

            const canvasWidth = canvas.width;
            for (let i = 0; i < pixels.length; i += 4) {
              const pixelIndex = i / 4;
              const px = pixelIndex % canvasWidth;
              const py = Math.floor(pixelIndex / canvasWidth);

              const frameR = frameData[i];
              const frameG = frameData[i + 1];
              const frameB = frameData[i + 2];
              const frameA = frameData[i + 3];

              // ITU-R BT.601輝度計算（白領域検出と同じ計算式）
              const luminance = (0.299 * frameR + 0.587 * frameG + 0.114 * frameB) / 255;

              // Frame pixel is opaque and not white -> it's part of the bezel/frame
              const isOpaque = frameA > 200;
              const isWhite = luminance >= WHITE_LUMINANCE_THRESHOLD;

              if (isOpaque && !isWhite) {
                // Overwrite with frame pixel to preserve bezel
                pixels[i] = frameR;
                pixels[i + 1] = frameG;
                pixels[i + 2] = frameB;
                pixels[i + 3] = frameA;
              } else if (isOpaque && isWhite) {
                // 白エリアの場合: このピクセルがいずれかのスクリーン領域内にあるかチェック
                const isInsideAnyRegion = sortedRegionCorners.some((corners) =>
                  isPointInQuad(px, py, corners)
                );
                if (!isInsideAnyRegion) {
                  // スクリーン領域の外側 → 元のフレームに戻す（はみ出し防止）
                  pixels[i] = frameR;
                  pixels[i + 1] = frameG;
                  pixels[i + 2] = frameB;
                  pixels[i + 3] = frameA;
                }
              }
            }

            ctx.putImageData(compositeData, 0, 0);

            // ========== デバッグ可視化（ベゼル復元後に描画） ==========
            // ダウンロード時はデバッグ可視化を無効化
            const debugMode = !forDownload; // プレビュー時のみデバッグ表示
            if (debugMode) {
              regionsWithImages.forEach((region) => {
                const corners = region.corners;
                if (!corners) return;

                // 透視変換と同じロジックでコーナーを並べ替え
                const centerX = corners.reduce((sum, c) => sum + c.x, 0) / 4;
                const centerY = corners.reduce((sum, c) => sum + c.y, 0) / 4;

                const cornersWithAngle = corners.map((c, i) => ({
                  point: c,
                  index: i,
                  angle: Math.atan2(c.y - centerY, c.x - centerX)
                }));

                const topTwo = [...cornersWithAngle].sort((a, b) => a.point.y - b.point.y).slice(0, 2);
                const bottomTwo = [...cornersWithAngle].sort((a, b) => a.point.y - b.point.y).slice(2, 4);

                topTwo.sort((a, b) => a.point.x - b.point.x);
                const topLeft = topTwo[0].point;
                const topRight = topTwo[1].point;

                bottomTwo.sort((a, b) => a.point.x - b.point.x);
                const bottomLeft = bottomTwo[0].point;
                const bottomRight = bottomTwo[1].point;

                // 並べ替え後のコーナーを表示
                // TL=赤, TR=緑, BR=青, BL=黄
                const sortedCorners = [topLeft, topRight, bottomRight, bottomLeft];
                const debugColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
                const debugLabels = ['TL', 'TR', 'BR', 'BL'];

                sortedCorners.forEach((c, i) => {
                  ctx.beginPath();
                  ctx.arc(c.x, c.y, 25, 0, Math.PI * 2);
                  ctx.fillStyle = debugColors[i];
                  ctx.fill();
                  ctx.strokeStyle = '#000';
                  ctx.lineWidth = 4;
                  ctx.stroke();

                  ctx.font = 'bold 16px sans-serif';
                  ctx.fillStyle = '#FFF';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(debugLabels[i], c.x, c.y);
                });

                // 4辺を描画（透視変換の順序で）
                // 上辺: TL→TR（マゼンタ）
                ctx.beginPath();
                ctx.moveTo(topLeft.x, topLeft.y);
                ctx.lineTo(topRight.x, topRight.y);
                ctx.strokeStyle = '#FF00FF';
                ctx.lineWidth = 6;
                ctx.stroke();

                // 右辺: TR→BR（オレンジ）
                ctx.beginPath();
                ctx.moveTo(topRight.x, topRight.y);
                ctx.lineTo(bottomRight.x, bottomRight.y);
                ctx.strokeStyle = '#FF8800';
                ctx.lineWidth = 6;
                ctx.stroke();

                // 下辺: BR→BL（シアン）
                ctx.beginPath();
                ctx.moveTo(bottomRight.x, bottomRight.y);
                ctx.lineTo(bottomLeft.x, bottomLeft.y);
                ctx.strokeStyle = '#00FFFF';
                ctx.lineWidth = 6;
                ctx.stroke();

                // 左辺: BL→TL（ライム）
                ctx.beginPath();
                ctx.moveTo(bottomLeft.x, bottomLeft.y);
                ctx.lineTo(topLeft.x, topLeft.y);
                ctx.strokeStyle = '#88FF00';
                ctx.lineWidth = 6;
                ctx.stroke();
              });
              console.log('デバッグ可視化完了: TL=赤, TR=緑, BR=青, BL=黄');
              console.log('辺の色: 上辺=マゼンタ, 右辺=オレンジ, 下辺=シアン, 左辺=ライム');
            }
            // ========== デバッグ可視化終了 ==========

            const dataUrl = canvas.toDataURL("image/png");
            if (!forDownload) {
              setCompositeUrl(dataUrl);
            }
            resolve(dataUrl);
          }
        };
        userImg.src = region.userImage;
      });
    };
    frameImg.src = item.publicPath;
    });
  }, [item, frameNatural, deviceRegions, frameImageData]);

  // Regenerate composite when device regions change
  useEffect(() => {
    if (deviceRegions.some(r => r.userImage)) {
      generateComposite();
    }
  }, [deviceRegions, generateComposite]);

  // 白エリア検出＆塗りつぶしプレビュー機能 (Hooks must be before early return)
  const handleColorFillPreview = useCallback(() => {
    if (!frameImageData || !frameNatural) return;

    // 白エリアを検出（ログ付き）
    // DEFAULT_OPTIONSを使用し、段階的輝度閾値と純白モードを適用
    const { regions, log } = detectDeviceScreensWithLog(frameImageData);

    setDetectedScreenRegions(regions);
    setDetectionLog(log);

    if (regions.length === 0) {
      console.log('白エリアが検出されませんでした');
      setShowColorFill(true); // ログは表示
      return;
    }

    // 塗りつぶしを適用
    const filledData = fillWhiteAreasWithColors(frameImageData, regions);

    // Canvasに描画してデータURLを取得
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = frameNatural.w;
    tempCanvas.height = frameNatural.h;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    ctx.putImageData(filledData, 0, 0);
    setColorFilledUrl(tempCanvas.toDataURL('image/png'));
    setShowColorFill(true);
  }, [frameImageData, frameNatural]);

  // 通常表示に戻す
  const handleResetColorFill = useCallback(() => {
    setShowColorFill(false);
    setColorFilledUrl(null);
    setDetectedScreenRegions([]);
    setDetectionLog(null);
  }, []);

  // Early return after all hooks
  if (!item) return null;

  const attributes = extractAttributes(item);
  const displayTitle = `${item.deviceType} Mockup`;
  const selectedRegion = selectedRegionIndex !== null ? deviceRegions[selectedRegionIndex] : null;

  const handleDownload = async () => {
    let url: string;
    const baseName = item.originalFilename.replace(/\.[^/.]+$/, '');

    // ユーザー画像がある場合は高画質コンポジットを生成
    if (deviceRegions.some(r => r.userImage)) {
      // forDownload=true で高画質・デバッグなしのコンポジットを生成
      const downloadUrl = await generateComposite(true);
      if (downloadUrl) {
        url = downloadUrl;
      } else {
        url = compositeUrl || item.publicPath;
      }
    } else {
      url = item.publicPath;
    }

    const link = document.createElement("a");
    link.href = url;
    // compositeUrlはPNG形式なので、拡張子を.pngに変更
    if (url.startsWith('data:')) {
      link.download = `edited_${baseName}.png`;
    } else {
      link.download = item.originalFilename;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = async () => {
    try {
      // 編集済み画像がある場合は画像をクリップボードにコピー
      if (compositeUrl) {
        const response = await fetch(compositeUrl);
        const blob = await response.blob();
        // PNG形式でコピー
        const pngBlob = new Blob([blob], { type: 'image/png' });
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob })
        ]);
        console.log('編集済み画像をクリップボードにコピーしました');
      } else {
        // 編集済み画像がない場合はURLをコピー
        await navigator.clipboard.writeText(window.location.origin + item.publicPath);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
      // フォールバック：URLをコピー
      try {
        await navigator.clipboard.writeText(window.location.origin + item.publicPath);
      } catch (fallbackErr) {
        console.error("Fallback copy also failed:", fallbackErr);
      }
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: displayTitle,
          text: `Check out this ${item.deviceType} mockup template`,
          url: window.location.origin + item.publicPath,
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      handleCopy();
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const clearRegion = (index: number) => {
    setDeviceRegions(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Reindex remaining regions
      return updated.map((region, i) => ({ ...region, index: i }));
    });
    if (selectedRegionIndex === index) {
      setSelectedRegionIndex(null);
    } else if (selectedRegionIndex !== null && selectedRegionIndex > index) {
      setSelectedRegionIndex(selectedRegionIndex - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="relative z-10 flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:flex-row">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Left: Interactive Canvas Area */}
        <div className="flex-1 bg-gradient-to-br from-slate-100 to-slate-200 p-4 md:p-6 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
          {/* Instructions */}
          {showInstructions && deviceRegions.length === 0 && !isCornerEditMode && (
            <div className="absolute top-4 left-4 right-4 bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-20 flex items-center gap-3">
              <span className="material-icons text-xl">touch_app</span>
              <span>画面の白い部分をクリックしてマスク領域を検出してください</span>
            </div>
          )}

          {/* Canvas Container */}
          <div 
            className={`relative w-full max-w-lg cursor-crosshair transition-all duration-200 ${
              isDraggingOver ? 'scale-[1.02]' : ''
            }`}
            style={{ aspectRatio: item.aspectRatio.replace(":", "/") }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Hidden canvas for image data */}
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Display image or composite (or color fill preview) */}
            <img
              src={showColorFill && colorFilledUrl ? colorFilledUrl : (compositeUrl || item.publicPath)}
              alt={item.originalFilename}
              className="absolute inset-0 h-full w-full object-contain rounded-xl shadow-lg"
            />
            
            {/* Interactive overlay */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 h-full w-full object-contain rounded-xl z-10"
              onClick={isCornerEditMode ? undefined : handleCanvasClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                cursor: isCornerEditMode
                  ? (draggingCornerIndex !== null ? "grabbing" : "grab")
                  : (isProcessing ? "wait" : "crosshair"),
                touchAction: isCornerEditMode ? "none" : "auto"
              }}
            />

            {/* Drag overlay indicator */}
            {isDraggingOver && (
              <div className="absolute inset-0 bg-indigo-500/20 backdrop-blur-sm rounded-xl border-2 border-dashed border-indigo-500 flex items-center justify-center z-30 pointer-events-none">
                <div className="bg-white rounded-xl px-6 py-4 shadow-lg flex items-center gap-3">
                  <span className="material-icons text-3xl text-indigo-600">add_photo_alternate</span>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {dragOverRegionIndex !== null 
                        ? `デバイス ${dragOverRegionIndex + 1} にドロップ`
                        : deviceRegions.length > 0 
                          ? '画像をドロップ'
                          : '先にマスクを検出してください'
                      }
                    </p>
                    <p className="text-xs text-slate-500">画像をここにドロップして追加</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 白エリア塗りつぶしプレビューボタン */}
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {!showColorFill ? (
              <button
                onClick={handleColorFillPreview}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-pink-400 to-blue-400 text-white shadow-md hover:shadow-lg"
              >
                <span className="material-icons text-base">palette</span>
                白エリアを検出＆塗りつぶし
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleResetColorFill}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-slate-500 text-white shadow-md hover:bg-slate-600"
                  >
                    <span className="material-icons text-base">visibility_off</span>
                    元に戻す
                  </button>
                </div>
                {/* 検出された領域の情報表示 */}
                {detectedScreenRegions.length > 0 && (
                  <div className="text-xs text-slate-600 bg-white/80 rounded-lg px-3 py-2 shadow">
                    {detectedScreenRegions.map((region, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span 
                          className="inline-block w-4 h-4 rounded-full border border-slate-300"
                          style={{ backgroundColor: region.fillColor }}
                        />
                        <span>デバイス {idx + 1}: {region.bounds.width}x{region.bounds.height}px</span>
                        <span className="text-slate-400">(スコア: {region.overallScore.toFixed(2)})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detected Regions List */}
          {deviceRegions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {deviceRegions.map((region, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedRegionIndex(idx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverRegionIndex(idx);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingOver(false);
                    setDragOverRegionIndex(null);
                    const files = e.dataTransfer.files;
                    if (files.length > 0 && files[0].type.startsWith('image/')) {
                      processImageForRegion(files[0], idx);
                      setSelectedRegionIndex(idx);
                    }
                  }}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${selectedRegionIndex === idx 
                      ? "bg-indigo-600 text-white shadow-md" 
                      : dragOverRegionIndex === idx
                        ? "bg-indigo-100 text-indigo-700 border-2 border-dashed border-indigo-400"
                        : "bg-white text-slate-700 border border-slate-200 hover:border-indigo-300"}
                  `}
                >
                  <span className="material-icons text-base">
                    {region.userImage ? "check_circle" : "crop_free"}
                  </span>
                  デバイス {idx + 1}
                  <button
                    onClick={(e) => { e.stopPropagation(); clearRegion(idx); }}
                    className="ml-1 text-current opacity-60 hover:opacity-100"
                  >
                    <span className="material-icons text-base">close</span>
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Info Panel */}
        <div className="w-full md:w-80 flex flex-col bg-white border-t md:border-t-0 md:border-l border-slate-200 max-h-[50vh] md:max-h-none overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4 sticky top-0 bg-white z-10">
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">
              {displayTitle}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 -mr-1 -mt-1"
            >
              <span className="material-icons text-xl">close</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 px-6 space-y-5">
            {/* Selected Region Actions */}
            {selectedRegion !== null && (
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-indigo-900">
                    デバイス {selectedRegionIndex! + 1} を選択中
                  </p>
                  {selectedRegion.userImage && (
                    <span className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                      <span className="material-icons text-sm">check</span>
                      画像設定済み
                    </span>
                  )}
                </div>
                
                {/* Corner Edit Mode Controls */}
                {isCornerEditMode ? (
                  <div className="space-y-2">
                    <div className="bg-orange-500 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center gap-3">
                      <span className="material-icons text-xl">touch_app</span>
                      <span>頂点をドラッグして位置を微調整できます</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={confirmCornerEdit}
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors"
                      >
                        <span className="material-icons text-base">check</span>
                        確定
                      </button>
                      <button
                        onClick={cancelCornerEditMode}
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-semibold text-sm transition-colors"
                      >
                        <span className="material-icons text-base">close</span>
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={triggerFileInput}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors"
                    >
                      <span className="material-icons text-lg">add_photo_alternate</span>
                      {selectedRegion.userImage ? "画像を変更" : "画像をアップロード"}
                    </button>
                    
                    {/* Fit Mode Selector */}
                    {selectedRegion.userImage && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setDeviceRegions(prev => prev.map((r, idx) => 
                              idx === selectedRegionIndex ? { ...r, fitMode: 'cover' } : r
                            ));
                          }}
                          className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                            selectedRegion.fitMode === 'cover'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300'
                          }`}
                        >
                          <span className="material-icons text-base">crop</span>
                          Cover
                        </button>
                        <button
                          onClick={() => {
                            setDeviceRegions(prev => prev.map((r, idx) => 
                              idx === selectedRegionIndex ? { ...r, fitMode: 'contain' } : r
                            ));
                          }}
                          className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                            selectedRegion.fitMode === 'contain'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300'
                          }`}
                        >
                          <span className="material-icons text-base">fit_screen</span>
                          Contain
                        </button>
                      </div>
                    )}
                    
                    <button
                      onClick={startCornerEditMode}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 rounded-xl font-medium text-sm transition-colors"
                    >
                      <span className="material-icons text-lg">edit</span>
                      頂点を調整
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Filename */}
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                FILENAME
              </p>
              <p className="text-sm text-slate-700 font-medium break-all leading-relaxed">
                {item.originalFilename}
              </p>
            </div>

            {/* Aspect Ratio & Device */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  ASPECT RATIO
                </p>
                <p className="text-lg font-bold text-slate-900">{item.aspectRatio}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  DEVICE
                </p>
                <p className="text-lg font-bold text-slate-900">{item.deviceType}</p>
              </div>
            </div>

            {/* Attributes */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                ATTRIBUTES
              </p>
              <div className="flex flex-wrap gap-2">
                {attributes.map((attr) => (
                  <span
                    key={attr}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium"
                  >
                    <span className="material-icons text-sm text-slate-400">local_offer</span>
                    {attr}
                  </span>
                ))}
              </div>
            </div>

            {/* 検出ログ表示 */}
            {detectionLog && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    検出ログ
                  </p>
                  <button
                    onClick={() => {
                      const logText = formatDetectionLogForCopy(detectionLog);
                      navigator.clipboard.writeText(logText).then(() => {
                        alert('ログをクリップボードにコピーしました');
                      }).catch(err => {
                        console.error('コピー失敗:', err);
                      });
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                  >
                    <span className="material-icons text-sm">content_copy</span>
                    コピー
                  </button>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <div className={`text-xs font-semibold mb-2 ${detectionLog.summary.success ? 'text-green-600' : 'text-red-600'}`}>
                    {detectionLog.summary.success ? '✓ 検出成功' : '✗ 検出失敗'}
                    {' '}- {detectionLog.summary.detectedCount}個検出
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>画像: {detectionLog.imageDimensions.width}x{detectionLog.imageDimensions.height}</div>
                    <div>白ピクセル: {detectionLog.stages.whitePixelCount} ({(detectionLog.stages.whitePixelRatio * 100).toFixed(2)}%)</div>
                    <div>候補領域: {detectionLog.stages.rawRegionsCount}</div>
                    <div className="text-slate-400 text-[10px]">
                      面積→{detectionLog.stages.afterAreaFilter} 
                      矩形度→{detectionLog.stages.afterRectangularityFilter} 
                      ベゼル→{detectionLog.stages.afterBezelScoreFilter} 
                      辺数→{detectionLog.stages.afterBezelEdgesFilter}
                    </div>
                    {detectionLog.finalRegions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        {detectionLog.finalRegions.map((r) => (
                          <div key={r.deviceIndex} className="flex items-center gap-2 py-1">
                            <span 
                              className="inline-block w-3 h-3 rounded-full border border-slate-300"
                              style={{ backgroundColor: r.fillColor }}
                            />
                            <span>
                              #{r.deviceIndex + 1}: {r.bounds.width}x{r.bounds.height} 
                              <span className="text-slate-400 ml-1">(スコア:{r.overallScore.toFixed(2)})</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {detectionLog.filteredOutReasons.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-400">
                        <div className="font-semibold mb-1">除外理由 (上位{Math.min(5, detectionLog.filteredOutReasons.length)}件):</div>
                        {detectionLog.filteredOutReasons.slice(0, 5).map((r, i) => (
                          <div key={i} className="truncate">
                            [{r.regionIndex}] {r.reason}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="p-6 pt-4 space-y-3 sticky bottom-0 bg-white">
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors"
            >
              <span className="material-icons text-lg">download</span>
              {compositeUrl ? "編集済み画像をダウンロード" : "テンプレートをダウンロード"}
            </button>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl font-medium text-sm transition-colors"
              >
                <span className="material-icons text-lg">content_copy</span>
                {compositeUrl ? "画像コピー" : "URLコピー"}
              </button>
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl font-medium text-sm transition-colors"
              >
                <span className="material-icons text-lg">share</span>
                共有
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
