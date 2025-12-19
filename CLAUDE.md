# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**重要**: 本プロジェクトでは必ず日本語で応答してください。

## プロジェクト概要

モックアップ画像生成Webアプリ。テンプレート画像からデバイス画面領域を自動検出し、ユーザー画像をCanvas APIで合成する。YouWareプラットフォーム上で動作するモバイルファーストのReactアプリ。

**目的**: FigmaやPhotoshopを使わずに、画像をドラッグ＆ドロップするだけでデバイスモックアップを生成し、ポートフォリオ作成を支援する。

## 開発コマンド

```bash
npm install          # 依存関係インストール
npm run dev          # 開発サーバー起動 (http://127.0.0.1:5173)
npm run build        # プロダクションビルド
npm run preview      # ビルドプレビュー
```

**ゼロトレランス方針**: 変更後は必ず `npm run build` を実行し、エラーを解消してから先に進めること。

## アーキテクチャ

### アプリケーションフロー

```
App.tsx (view state: "gallery" | "editor")
    ├── MockupGallery (テンプレート選択画面)
    │   ├── FilterSidebar (デバイス/アスペクト比/カラーフィルター)
    │   └── MockupGrid → MockupCard (テンプレートグリッド表示)
    │
    └── MultiDeviceMockup (メインエディター)
        ├── 画面領域検出 (whiteAreaExtractor.ts)
        ├── デバイスタイプ判定 (deviceTypeDetection.ts)
        ├── ドロップゾーンUI (各デバイス領域への画像アップロード)
        ├── 透視変換合成 (perspectiveTransform.ts)
        └── 画像ダウンロード (Canvas → PNG)
```

### 画面領域検出パイプライン

1. **白ピクセル検出**: 輝度閾値0.90（ITU-R BT.601）で白領域を特定
2. **連結成分抽出**: BFS 4方向接続でグループ化
3. **黒ベゼル検出**: 領域外側15pxをサンプリング、暗いピクセル割合でスコアリング
4. **フィルタリング**: 面積0.5%以上、矩形度0.40以上、ベゼルスコア0.25以上
5. **デバイス判定**: アスペクト比・キーボード検出・ノッチ検出から laptop/smartphone/tablet を自動判定

詳細: `white-area.md`, `DEVICE_DETECTION_SPEC.md`

### 複数デバイス識別色

```typescript
// src/constants/deviceColors.ts
DEVICE_FILL_COLORS = {
  primary: '#e5c4be',    // 1台目: ピンクベージュ
  secondary: '#accbde',  // 2台目: ライトブルー
  tertiary: '#ffe2c6',   // 3台目: ピーチ
}
```

## YouWare環境の制約

### 禁止事項
- Pythonバックエンド（OpenCV/Pillow）の使用
- サーバーサイドでの画像処理
- ファイルシステムへの永続保存
- `index.html`の`<script type="module" src="/src/main.tsx"></script>`を変更

### 必須事項
- 画像処理はCanvas APIでクライアントサイドのみ
- 静的アセットは絶対パス `/assets/...` で参照（`src/assets/`の相対参照禁止）
- データはReact状態とブラウザメモリで保持（リロードで破棄）

## モバイル対応要件

### モバイルデバイスAPI - 必須使用

**必ず `src/utils/mobileFeatures.ts` のラッパー関数を使用:**

```tsx
// ✅ 正しい実装
import { saveImageToDevice, vibrate, hapticFeedback } from './utils/mobileFeatures';
await saveImageToDevice(imageData, 'mockup.png');
vibrate(100);
hapticFeedback('medium');

// ❌ 禁止 - iOS Safari/WebViewで失敗
const link = document.createElement('a');
link.href = imageData;
link.download = 'file.png';
link.click();  // iOS Safari/WebViewで動作しない

navigator.vibrate(200);  // iOS非対応
```

### セーフエリア実装（ノッチ対応）

```tsx
<div className="w-full h-dvh">
  <div style={{
    paddingTop: "env(safe-area-inset-top)",
    paddingBottom: "env(safe-area-inset-bottom)",
    paddingLeft: "env(safe-area-inset-left)",
    paddingRight: "env(safe-area-inset-right)",
  }}>
    {/* コンテンツ */}
  </div>
</div>
```

### タッチ最適化
- 最小タッチターゲット: 44px (`min-h-touch`)
- ホバー状態禁止 → アクティブ状態を使用
- 利用可能なTailwind: `h-dvh`, `h-screen-safe`, `safe-top`, `safe-bottom`

## テンプレート画像

### 命名規則
```
/public/assets/mockup/{AspectRatio}/{DeviceType}_{AspectRatio}_{SerialNumber}_{ColorTone}.webp

例: laptop_4x5_047_beige.webp, 2sp_16x9_014_pink.webp
```

### 出力アスペクト比と最小サイズ
| 比率 | 最小サイズ | 用途 |
|-----|-----------|-----|
| 1:1 | 1080×1080 | Instagram, X, プロフィール画像 |
| 3:4 | 1080×1440 | Pinterest, ポートレート |
| 4:5 | 1080×1350 | Instagram/Threads縦長投稿 |
| 8:9 | 1200×1350 | X 2枚投稿, 3枚投稿1枚目 |
| 9:16 | 1080×1920 | Stories, TikTok |
| 16:9 | 1200×675 | YouTubeサムネイル, X複数投稿 |

### ダウンロードファイル命名規則
```
{アスペクト比}_{年月日}_{24時間表記時間}.png
例: 16x9_20241219_143052.png
```

## 主要ファイル

| ファイル | 役割 |
|---------|------|
| `src/features/mockup/components/MultiDeviceMockup.tsx` | メインエディター（検出・合成・ダウンロード統合） |
| `src/features/mockup/gallery/MockupGallery.tsx` | テンプレートギャラリー |
| `src/utils/whiteAreaExtractor.ts` | 画面領域検出アルゴリズム |
| `src/utils/perspectiveTransform.ts` | 4点透視変換 |
| `src/features/mockup/utils/deviceTypeDetection.ts` | デバイスタイプ自動判定 |
| `src/features/mockup/data/mockupGalleryData.ts` | テンプレートメタデータ（大規模） |

## 関連ドキュメント

- `white-area.md`: 白領域検出アルゴリズム詳細
- `DEVICE_DETECTION_SPEC.md`: デバイス検出仕様
- `YOUWARE.md`: YouWareプラットフォーム仕様
- `docs/FRAMES.md`: フレーム仕様
- `docs/mockup-app-specification.md`: アプリ仕様書
