import type { FrameMeta } from '../types/frame';

export const frames: FrameMeta[] = [
  {
    id: 'laptop-editable',
    name: 'Laptop Editable Screen',
    category: 'laptop',
    frameImage: '/assets/frames/laptop-editable-screen.webp',
    aspectSupport: ['16:9', '1:1', '9:16'],
    screenRect: { xPct: 0.12, yPct: 0.22, wPct: 0.76, hPct: 0.50 },
  },
  {
    id: 'laptop-smartphone-front',
    name: 'Laptop + Smartphone Front',
    category: 'laptop',
    frameImage: '/assets/frames/laptop-smartphone-front.webp',
    aspectSupport: ['16:9', '1:1'],
    // Multi-screen: approximate regions (tune via overlay)
    screenRects: [
      { id: 'laptop', name: 'Laptop', rect: { xPct: 0.14, yPct: 0.26, wPct: 0.72, hPct: 0.46 } },
      { id: 'phone', name: 'Smartphone', rect: { xPct: 0.83, yPct: 0.35, wPct: 0.12, hPct: 0.22 } }
    ],
  },
  {
    id: 'iphone15-gray',
    name: 'Smartphone iPhone15 Gray',
    category: 'smartphone',
    frameImage: '/assets/frames/smartphone-iphone15-gray.webp',
    aspectSupport: ['9:16', '1:1', '16:9'],
    screenRect: { xPct: 0.08, yPct: 0.11, wPct: 0.84, hPct: 0.78 },
  },
  // User uploaded samples
  {
    id: 'sample1',
    name: 'Sample Frame 1',
    category: 'smartphone',
    frameImage: '/assets/frames/sample1.png',
    aspectSupport: ['9:16', '16:9', '1:1'],
    // No precise screenRect provided; use default fallback (0.1,0.1,0.8,0.8)
  },
  {
    id: 'sample2',
    name: 'Sample Frame 2',
    category: 'laptop',
    frameImage: '/assets/frames/sample2.png',
    aspectSupport: ['16:9', '1:1', '9:16'],
    // No precise screenRect provided; use default fallback (0.1,0.1,0.8,0.8)
  },
  // 複数デバイステスト用のサンプル
  {
    id: 'sp-and-laptop-9x16',
    name: 'スマホ + ノートPC (9:16)',
    category: 'laptop',
    frameImage: '/assets/mockup/9x16/SpAndLaptop_9x16_028_brown.webp',
    aspectSupport: ['9:16'],
  },
  {
    id: '2sp-and-laptop-16x9',
    name: '2スマホ + ノートPC (16:9)',
    category: 'laptop',
    frameImage: '/assets/mockup/16x9/2SpAndLaptop_16x9_037_blue.webp',
    aspectSupport: ['16:9'],
  },
];
