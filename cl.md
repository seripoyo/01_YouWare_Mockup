# 💻MockUp Generator App📱

この「MockUp Generator App」というアプリは、YouWareプラットフォーム上で動作する、モバイルファーストのReactアプリケーションです。

デバイスフレーム検出とローカル画像合成機能を備えた、モックアップエディタを提供します。iOS Safari、Android Chrome、およびネイティブWebView環境で動作します。
なお、本プロジェクトでは必ずターミナルの返答は日本語を使ってください。必要な場合以外は原則として日本語利用を徹底すること。

使用できる主な機能は以下の通りです。

- **既に用意された数百種類のテンプレートの中から任意に1つのテンプレートを選べます。**
    - ノートパソコン・タブレット・スマートフォン各単体はもちろん、ノートパソコンとスマートフォンの組み合わせのようなテンプレートも用意。
- **各テンプレート内のデバイスに埋め込みたい画像をアップロードすれば、モックアップ画像を生成可能です。**
    - 生成したモックアップ画像データはPNGファイルで、以下の比率から選んでダウンロードできます。各アスペクト比は最低でも以下を満たすこと。
        - 1:1→ 1,080 x 1,080px
        - 4:5→ 1,080 x 1,350px
        - 3:4→ 1,080 x 1,440px
        - 9:16→1080×1920px
        - 8:9→1200×1350px
        - 16:9→1200×675px
            
            
            | アスペクト比 | 主な用途 |
            | --- | --- |
            | 1:1 | X、Instagram、Threads、プロフィール画像 |
            | 3:4 | Pinterest、ポートレート |
            | 4:5 | Instagram、Threadsの縦長投稿 |
            | 8:9 | Xでの2枚投稿、3枚投稿1枚目 |
            | 16:9 | YouTube サムネイル、Xにおける3枚投稿2-3枚目、4枚投稿 |
            | 9:16 | Instagram/Threads/TikTok ストーリーズ |
    - テンプレート画像はpublic/assets/mockup内の1:1であれば1x1のように記載した4つのディレクトリ内に格納されている。
        - ファイル命名規則： {DeviceType}_*{AspectRatio}_*{SerialNumber}_{Color}.webp

### プロジェクトの目的

- figmaやPhotoshop、Canvaなどを使用しなくとも、画像を追加するだけでイメージ通りのモックアップを生成できるアプリを作り、WEBエンジニアやデザイナーのポートフォリオ充実化をサポートする。

### 主要機能

- **デバイスモックアップ合成**: 白抜きのデバイス画像（ノートPC・スマートフォン等）にユーザー提供画像を合成
- **Canvas APIベースの画像処理**: テキストの明瞭性を保持するためのローカル合成
- **複数デバイス対応**: 1枚の画像内で最大3台のデバイスを個別に合成可能
- **柔軟な出力設定**: 6種類のアスペクト比から選択可能
- **インタラクティブドロップゾーン**: 検出された各画面領域に直接ドラッグ＆ドロップでスクリーンショットをアップロード

## ユーザーが行うアクション手順

1. 希望するデバイス、アスペクト比、カラーなどのフィルターをかけ、1つ気に入ったテンプレートを選択する。
2. テンプレート内のデバイスに埋め込みたい画像をアップロードボタン、またはドラッグで入れ込む。
3. もしデバイスと画像の位置がずれている場合は微調整を行う。
4. 問題ない状態になったら、自分がダウンロードしたいアスペクト比を選択する。
    - 1:1
    - 4:5
    - 3:4
    - 9:16
    - 8:9
    - 16:9
5. アスペクト比を選択したらその比率で固定されたトリミング枠をドラッグできるようになる。ユーザーは選択したアスペクト比を維持しながら好みの位置で合成画像をトリミングできる。
6. ユーザーが納得いくトリミング配置に成功したら、「PNGでダウンロード」ボタンを押してpng拡張子でトリミングした状態の画像をダウンロードする。画像ファイル名は{ユーザーが選択したアスペクト比}_{1ダウンロードした年月日}_{24時間表記の時間}_

## YouWare環境の制約

### プラットフォーム仕様

YouWareでは以下の構成が標準です：

- **フロントエンド**: JavaScript/TypeScript ベース
- **バックエンド**: 画像や設定はすべてクライアント側メモリのみで保持し、React の状態とブラウザメモリのみ。ページ遷移・リロードで完全に破棄する。

### 禁止事項

```tsx
// ❌ Pythonバックエンド（OpenCV/Pillow）は使用不可
// YouWareでは専用のPythonランタイムを立てることができません

// ❌ サーバーサイドでの画像処理
// 画像処理はすべてフロントエンド（Canvas API）で実行

```

## 開発コマンド

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動 (<http://127.0.0.1:5173>)
npm run dev

# プロダクションビルド
npm run build

# ビルドプレビュー
npm run preview

```

### 禁止事項

```tsx
// ❌ Pythonバックエンド（OpenCV/Pillow）は使用不可
// YouWareでは専用のPythonランタイムを立てることができません

// ❌ サーバーサイドでの画像処理
// 画像処理はすべてフロントエンド（Canvas API）で実行

```

## 複数デバイス対応

### デバイス識別カラー

1枚のモックアップ画像内に複数のデバイス（最大3台）が存在する場合、それぞれを識別するために異なるフィル色を使用します：

| デバイス | フィル色 | 用途例 |
| --- | --- | --- |
| 1台目 | `#e5c4be` | メインデバイス（ピンクベージュ） |
| 2台目 | `#accbde` | サブデバイス（ライトブルー） |
| 3台目 | `#ffe2c6` | 第3デバイス（ピーチ） |

```tsx
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

## テンプレート画像ギャラリー

### ギャラリーフィルタリング機能

テンプレート画像は以下の3つのフィルタでギャラリー表示を行います：

### 1. アスペクト比フィルタ

テンプレート画像のアスペクト比に基づいてフィルタリング。

```tsx
type PresetAspectRatio = '1:1' | '4:5' | '16:9' | '9:16';

```

### 2. カラートーンフィルタ

画像ファイル名に記載されたカラートーンに基づいてフィルタリング。

```tsx
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

### テンプレート画像の命名規則

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

## 黒フレーム囲み画面領域検出アルゴリズム

### 背景との混在問題

添付画像のように、背景も明るい色（ピンクベージュ、クリーム色など）の場合、単純な輝度閾値だけでは背景と画面を区別できません。

**問題例:**

- `2sp_9x16_123_pink_beige.webp`: ピンクベージュ背景 + 白い画面 → 背景も検出されてしまう
- `SpAndLaptop_9x16_035_green.webp`: 緑背景 → 問題なし（背景が暗い）

### 解決策: 黒フレーム（ベゼル）検出

デバイスの画面は必ず**黒いベゼル（フレーム）に囲まれている**という特性を利用します。
フレームに囲まれた白エリアの検出方法の詳細は、white-area.mdを参照。

## インタラクティブドロップゾーンUI

### 機能概要

検出された各画面領域を、ユーザーがスクリーンショットをドラッグ＆ドロップまたはクリックでアップロードできるインタラクティブなエリアとして表示します。

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

## 必須モバイル要件

### 1. モバイルデバイスAPI - 必須使用

**必ず `src/utils/mobileFeatures.ts` を使用:**

- 画像ダウンロード: `saveImageToDevice()`
- デバイスフィードバック: `vibrate()`, `hapticFeedback()`
- WebView通信: `callNative()`, `isInWebView()`

**禁止 - モバイルで失敗するコード:**

```tsx
// ❌ 直接的なdownload link.click() - iOS Safari/WebViewで失敗
const link = document.createElement('a');
link.href = imageData;
link.download = 'file.png';
link.click();

// ❌ 直接的なnavigator.vibrate() - iOS非対応、WebView連携なし
navigator.vibrate(200);

```

**必須 - ラッパー関数を常に使用:**

```tsx
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

### アセットパス

すべてのアセットは絶対パスを使用（dev/build両方で動作）：

- テンプレートフレーム: `/mockup/{aspectRatio}/{deviceType}_{aspectRatio}_{serial}_{colorTone}.webp`

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

## モバイル開発ガイドライン

**タッチインタラクション:**

- 44px最小タッチターゲット
- ホバー状態ではなくアクティブ状態を使用
- すべてのインタラクションで明確な視覚フィードバック
- ジェスチャーネイティブパターン（スワイプ、タップ、長押し）

## プロジェクトエントリーポイント

- **HTMLエントリー:** `index.html` - scriptタグを変更禁止: `<script type="module" src="/src/main.tsx"></script>`
- **Reactエントリー:** `src/main.tsx` - React 18ルートレンダー
- **メインコンポーネント:** `src/App.tsx` - ImageMockupEditor付きセーフエリア構造

## 現在の実装（画像モックアップエディタ）

アプリは完全な画像モックアップ編集ワークフローを実装：

1. ユーザーがテンプレートギャラリーからフレームを選択（フィルタ機能付き）
    - または、テンプレートをベースにAIで新フレームを生成（nano-banana×2 + Seedream4×2）
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
| --- | --- | --- |
| `src/utils/screenDetection.ts` | `detectDeviceScreens` | 黒フレーム囲み画面領域検出 |
| `src/utils/screenDetection.ts` | `calculateBezelScore` | ベゼルスコア計算 |
| `src/utils/screenDetection.ts` | `checkBezelEdges` | 4辺ベゼル存在チェック |
| `src/components/DropZoneOverlay.tsx` | `DropZoneOverlay` | インタラクティブドロップゾーンUI |
| `src/components/ImageMockupEditor.tsx` | `handleLocalCompose` | Canvas APIベースローカル合成 |
| `src/components/ImageMockupEditor.tsx` | `handleGenerateTemplate` | AIテンプレート生成 |
| `src/utils/perspectiveTransform.ts` | `drawPerspectiveImage` | 透視変換描画 |

## 品質チェックリスト

### 画面領域検出品質

- [ ]  黒フレームに囲まれた画面のみが検出されているか
- [ ]  明るい背景（ピンク、ベージュ等）が誤検出されていないか
- [ ]  複数デバイスが正しく識別・番号付けされているか
- [ ]  ベゼルスコアが適切に計算されているか

### インタラクティブUI

- [ ]  ドロップゾーンがタップ/クリックで反応するか
- [ ]  ドラッグ＆ドロップが正常に動作するか
- [ ]  画像アップロード後にプレビューが表示されるか
- [ ]  削除ボタンで画像をクリアできるか

### 画像合成品質

- [ ]  テキストが一字一句明瞭に表示されているか
- [ ]  UIの直線が歪んでいないか
- [ ]  ロゴ・アイコンが正確に表示されているか
- [ ]  透視変換の角度が自然か

### モバイル対応

- [ ]  セーフエリアが正しく適用されているか
- [ ]  タッチターゲットが44px以上か
- [ ]  iOS Safari/Android Chrome/WebViewで動作するか
- [ ]  `saveImageToDevice()` でダウンロードできるか

### パフォーマンス

- [ ]  大きな画像でもスムーズに動作するか
- [ ]  メモリリークがないか
- [ ]  Canvas操作が最適化されているか
- [ ]  画面領域検出が1秒以内に完了するか

### テンプレートギャラリー

- [ ]  フィルタが正しく動作するか（アスペクト比、カラートーン、デバイス種類）
- [ ]  テンプレート画像の命名規則が統一されているか
- [ ]  サムネイルが正しく表示されるか