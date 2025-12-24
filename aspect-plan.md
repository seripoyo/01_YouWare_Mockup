# アスペクト比切り抜きダウンロード機能 - 実装計画

## 概要

「画像サイズを変えてダウンロード」ボタンを押すと、ユーザーが任意のアスペクト比で画像を切り抜いてダウンロードできる機能を実装する。

---

## 機能要件

### 1. ユーザーフロー

```
[画像サイズを変えてダウンロード] クリック
    ↓
ガイドラインを非表示にする
    ↓
切り抜きモードに入る
    ↓
アスペクト比選択UI表示（楕円形ラジオボタン）
    ↓
選択したアスペクト比の白いドット線四角形を画像上に表示
    ↓
四角形の移動・リサイズ操作
    ↓
[この画像サイズでダウンロード] クリック
    ↓
切り抜いた画像をダウンロード
```

### 2. 対応アスペクト比一覧

| アスペクト比 | 必要最低サイズ | プラットフォーム | 比率値 |
|-------------|---------------|-----------------|--------|
| 1:1（正方形） | 1200×1200px | Instagram, X, TikTok, Threads, Facebook, LinkedIn | 1.0 |
| 4:5（縦長） | 1080×1350px | Instagram, Threads, Facebook, LinkedIn | 0.8 |
| 3:4（縦長） | 1080×1440px | Instagram, X | 0.75 |
| 9:16（縦長） | 1080×1920px | Instagram, TikTok | 0.5625 |
| 16:9（横長） | 1200×675px | X, TikTok | 1.778 |
| 8:9（縦長） | 1200×1350px | X | 0.889 |
| 5:4（横長） | 800×640px | Facebook, LinkedIn | 1.25 |
| 4:3（横長） | 1080×810px | Threads | 1.333 |
| 1:2（縦長） | 720×1440px | Facebook, LinkedIn | 0.5 |
| 2:1（横長） | 1440×720px | Facebook, LinkedIn | 2.0 |
| 3:2（横長） | 1280×853px | Facebook, LinkedIn | 1.5 |
| 2:3（縦長） | 853×1280px | Facebook, LinkedIn | 0.667 |

---

## 技術設計

### 1. 新規ステート

```typescript
// PreviewModal.tsx に追加するステート
const [isCropMode, setIsCropMode] = useState(false);           // 切り抜きモード中かどうか
const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioOption | null>(null); // 選択されたアスペクト比
const [cropRect, setCropRect] = useState<CropRect | null>(null); // 切り抜き四角形の位置とサイズ

// 型定義
interface AspectRatioOption {
  label: string;           // "1:1", "4:5" など
  ratio: number;           // 幅/高さの比率
  minWidth: number;        // 必要最低幅
  minHeight: number;       // 必要最低高さ
  platforms: string[];     // 対応プラットフォーム
}

interface CropRect {
  x: number;      // 画像座標系でのX位置
  y: number;      // 画像座標系でのY位置
  width: number;  // 画像座標系での幅
  height: number; // 画像座標系での高さ
}
```

### 2. 定数定義

```typescript
// src/constants/aspectRatios.ts に新規作成
export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { label: "1:1", ratio: 1, minWidth: 1200, minHeight: 1200, platforms: ["Instagram", "X", "TikTok", "Threads", "Facebook", "LinkedIn"] },
  { label: "4:5", ratio: 0.8, minWidth: 1080, minHeight: 1350, platforms: ["Instagram", "Threads", "Facebook", "LinkedIn"] },
  { label: "3:4", ratio: 0.75, minWidth: 1080, minHeight: 1440, platforms: ["Instagram", "X"] },
  { label: "9:16", ratio: 0.5625, minWidth: 1080, minHeight: 1920, platforms: ["Instagram", "TikTok"] },
  { label: "16:9", ratio: 1.778, minWidth: 1200, minHeight: 675, platforms: ["X", "TikTok"] },
  { label: "8:9", ratio: 0.889, minWidth: 1200, minHeight: 1350, platforms: ["X"] },
  { label: "5:4", ratio: 1.25, minWidth: 800, minHeight: 640, platforms: ["Facebook", "LinkedIn"] },
  { label: "4:3", ratio: 1.333, minWidth: 1080, minHeight: 810, platforms: ["Threads"] },
  { label: "1:2", ratio: 0.5, minWidth: 720, minHeight: 1440, platforms: ["Facebook", "LinkedIn"] },
  { label: "2:1", ratio: 2, minWidth: 1440, minHeight: 720, platforms: ["Facebook", "LinkedIn"] },
  { label: "3:2", ratio: 1.5, minWidth: 1280, minHeight: 853, platforms: ["Facebook", "LinkedIn"] },
  { label: "2:3", ratio: 0.667, minWidth: 853, minHeight: 1280, platforms: ["Facebook", "LinkedIn"] },
];
```

### 3. コンポーネント構造

```
PreviewModal.tsx
├── 既存のcanvas/overlay構造
│
├── [新規] CropOverlay（切り抜きモード時のみ表示）
│   ├── 暗いオーバーレイ（#000 opacity 0.6）
│   ├── 切り抜き領域（透明な穴）
│   └── 白いドット線の枠
│
└── [新規] AspectRatioSelector（切り抜きモード時のみ表示）
    └── 楕円形ラジオボタン群
```

### 4. 切り抜きオーバーレイの描画ロジック

```typescript
// 切り抜きオーバーレイ用の新しいcanvas（または既存overlayCanvasを拡張）
const drawCropOverlay = useCallback((cropRect: CropRect) => {
  const canvas = cropOverlayCanvasRef.current;
  if (!canvas || !frameNatural) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { w, h } = frameNatural;

  // キャンバス全体をクリア
  ctx.clearRect(0, 0, w, h);

  // 1. 暗いオーバーレイを全体に描画
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, w, h);

  // 2. 切り抜き領域を透明にする（穴を開ける）
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "white";
  ctx.fillRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);

  // 3. 白いドット線の枠を描画
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]); // ドット線
  ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
  ctx.setLineDash([]); // リセット

  // 4. 四隅のリサイズハンドルを描画
  drawResizeHandles(ctx, cropRect);
}, [frameNatural]);
```

### 5. 切り抜き四角形の操作

#### 5.1 初期配置

```typescript
const initializeCropRect = (aspectRatio: AspectRatioOption) => {
  if (!frameNatural) return null;

  const { w: imgW, h: imgH } = frameNatural;
  const ratio = aspectRatio.ratio;

  // 画像内に収まる最大サイズを計算
  let cropWidth: number, cropHeight: number;

  if (imgW / imgH > ratio) {
    // 画像が横長 → 高さを基準にする
    cropHeight = imgH * 0.8; // 80%のマージン
    cropWidth = cropHeight * ratio;
  } else {
    // 画像が縦長 → 幅を基準にする
    cropWidth = imgW * 0.8;
    cropHeight = cropWidth / ratio;
  }

  // 中央に配置
  const x = (imgW - cropWidth) / 2;
  const y = (imgH - cropHeight) / 2;

  return { x, y, width: cropWidth, height: cropHeight };
};
```

#### 5.2 ドラッグ移動

```typescript
// マウス/タッチイベントで四角形を移動
const handleCropDragMove = (dx: number, dy: number) => {
  if (!cropRect || !frameNatural) return;

  const newX = Math.max(0, Math.min(frameNatural.w - cropRect.width, cropRect.x + dx));
  const newY = Math.max(0, Math.min(frameNatural.h - cropRect.height, cropRect.y + dy));

  setCropRect({ ...cropRect, x: newX, y: newY });
};
```

#### 5.3 リサイズ

```typescript
// 四隅または辺のドラッグでリサイズ（アスペクト比を維持）
const handleCropResize = (corner: 'tl' | 'tr' | 'bl' | 'br', dx: number, dy: number) => {
  if (!cropRect || !selectedAspectRatio || !frameNatural) return;

  const ratio = selectedAspectRatio.ratio;
  let newWidth = cropRect.width;
  let newHeight = cropRect.height;
  let newX = cropRect.x;
  let newY = cropRect.y;

  // コーナーに応じてリサイズ（アスペクト比維持）
  switch (corner) {
    case 'br': // 右下
      newWidth = Math.max(100, cropRect.width + dx);
      newHeight = newWidth / ratio;
      break;
    case 'bl': // 左下
      newWidth = Math.max(100, cropRect.width - dx);
      newHeight = newWidth / ratio;
      newX = cropRect.x + (cropRect.width - newWidth);
      break;
    case 'tr': // 右上
      newWidth = Math.max(100, cropRect.width + dx);
      newHeight = newWidth / ratio;
      newY = cropRect.y + (cropRect.height - newHeight);
      break;
    case 'tl': // 左上
      newWidth = Math.max(100, cropRect.width - dx);
      newHeight = newWidth / ratio;
      newX = cropRect.x + (cropRect.width - newWidth);
      newY = cropRect.y + (cropRect.height - newHeight);
      break;
  }

  // 画像境界内に制限
  newX = Math.max(0, newX);
  newY = Math.max(0, newY);
  if (newX + newWidth > frameNatural.w) newWidth = frameNatural.w - newX;
  if (newY + newHeight > frameNatural.h) newHeight = frameNatural.h - newY;

  // アスペクト比を再調整
  newHeight = newWidth / ratio;

  setCropRect({ x: newX, y: newY, width: newWidth, height: newHeight });
};
```

### 6. 切り抜きダウンロード処理

```typescript
const handleCropDownload = async () => {
  if (!cropRect || !selectedAspectRatio || !frameNatural) return;

  // 1. 元画像（または合成画像）を取得
  const sourceUrl = compositeUrl || item.publicPath;

  // 2. 新しいキャンバスを作成（出力サイズ）
  const outputWidth = Math.max(selectedAspectRatio.minWidth, Math.round(cropRect.width));
  const outputHeight = Math.max(selectedAspectRatio.minHeight, Math.round(cropRect.height));

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 3. 元画像を読み込み
  const img = new Image();
  img.crossOrigin = "anonymous";

  await new Promise<void>((resolve) => {
    img.onload = () => {
      // 4. 切り抜き領域を描画
      ctx.drawImage(
        img,
        cropRect.x, cropRect.y, cropRect.width, cropRect.height, // ソース
        0, 0, outputWidth, outputHeight // デスティネーション
      );
      resolve();
    };
    img.src = sourceUrl;
  });

  // 5. ダウンロード
  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `cropped_${selectedAspectRatio.label.replace(":", "x")}_${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 6. 切り抜きモードを終了
  setIsCropMode(false);
  setCropRect(null);
  setSelectedAspectRatio(null);
};
```

---

## UI設計

### 1. アスペクト比セレクター

```tsx
// 楕円形ラジオボタンのUI
<div className="flex flex-wrap gap-2 justify-center p-4">
  {ASPECT_RATIO_OPTIONS.map((option) => (
    <button
      key={option.label}
      onClick={() => handleAspectRatioSelect(option)}
      className={`
        px-4 py-2 rounded-full text-sm font-medium
        transition-all duration-200
        ${selectedAspectRatio?.label === option.label
          ? "bg-blue-500 text-white shadow-lg scale-105"
          : "bg-white border border-slate-300 text-slate-700 hover:border-blue-400"
        }
      `}
    >
      {option.label}
    </button>
  ))}
</div>
```

### 2. ボタンのテキスト切り替え

```tsx
<button
  onClick={isCropMode ? handleCropDownload : handleEnterCropMode}
  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#da3700] hover:bg-[#c53200] text-white rounded-xl font-medium text-sm transition-colors"
>
  <span className="material-icons text-lg">
    {isCropMode ? "download" : "aspect_ratio"}
  </span>
  {isCropMode ? "この画像サイズでダウンロード" : "画像サイズを変えてダウンロード"}
</button>
```

### 3. 切り抜きモード終了ボタン

```tsx
{isCropMode && (
  <button
    onClick={handleExitCropMode}
    className="absolute top-4 right-4 z-50 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2"
  >
    <span className="material-icons text-lg">close</span>
    キャンセル
  </button>
)}
```

---

## 実装ステップ

### Phase 1: 基盤整備
1. [ ] `src/constants/aspectRatios.ts` 作成 - アスペクト比定数
2. [ ] 型定義追加（AspectRatioOption, CropRect）
3. [ ] 新規ステート追加（isCropMode, selectedAspectRatio, cropRect）

### Phase 2: UI実装
4. [ ] アスペクト比セレクターコンポーネント実装
5. [ ] ボタンテキスト切り替え実装
6. [ ] 切り抜きモード開始/終了ロジック

### Phase 3: 切り抜きオーバーレイ
7. [ ] 切り抜きオーバーレイcanvas追加
8. [ ] 暗いオーバーレイ + 透明な穴の描画
9. [ ] 白いドット線枠の描画
10. [ ] リサイズハンドルの描画

### Phase 4: インタラクション
11. [ ] 切り抜き四角形の初期配置ロジック
12. [ ] ドラッグ移動の実装
13. [ ] リサイズの実装（アスペクト比維持）
14. [ ] タッチ対応

### Phase 5: ダウンロード処理
15. [ ] 切り抜きダウンロード関数実装
16. [ ] 最小サイズ保証ロジック
17. [ ] ファイル名生成

### Phase 6: 仕上げ
18. [ ] エッジケース処理
19. [ ] パフォーマンス最適化
20. [ ] モバイル対応確認

---

## 注意事項

### 画像座標系とCanvas座標系の変換

プレビュー画像は`object-contain`で表示されているため、マウス座標を画像座標に変換する必要がある：

```typescript
const convertToImageCoords = (clientX: number, clientY: number) => {
  const rect = canvasContainer.getBoundingClientRect();
  const scaleX = frameNatural.w / rect.width;
  const scaleY = frameNatural.h / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
};
```

### 既存機能との共存

- 切り抜きモード中はガイドライン（`showGuidelines`）を自動的にfalseにする
- 切り抜きモード中はコーナー編集モード（`isCornerEditMode`）を無効化
- 切り抜きモード終了時に元の状態に戻す

### モバイル対応

- タッチイベント対応（passive: false で preventDefault()可能に）
- ピンチズームでのリサイズ対応（オプション）
- 十分なタッチターゲットサイズ（最小44px）

---

## 参考：既存コードとの統合ポイント

### 変更が必要なファイル

1. **PreviewModal.tsx** - メイン実装場所
   - ステート追加
   - 切り抜きオーバーレイ追加
   - イベントハンドラ追加
   - UI変更

2. **src/constants/aspectRatios.ts** - 新規作成
   - アスペクト比定数

### 既存の類似実装（参考）

- `drawOverlay` 関数 - オーバーレイ描画のパターン
- `handleCornerDragMove` - ドラッグ操作のパターン
- `generateComposite` - Canvas画像処理のパターン
- `handleDownload` - ダウンロード処理のパターン
