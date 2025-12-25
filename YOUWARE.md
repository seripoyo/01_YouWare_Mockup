# モックアップ生成アプリ - YOUWARE 開発ガイド

このリポジトリは、ユーザーがアップロードしたスクリーンショットを端末フレーム（スマートフォン/タブレット/PC 等）にぴったり合わせ、単体/複数端末のモックアップ画像を作成できる Web アプリの土台です。出力アスペクト比は 9:16 / 16:9 / 1:1 を選択可能です。フレーム画像はユーザー提供前提で、YouWare のビルド要件に沿ったディレクトリ構成を整備済みです。

## 目的と現状
- 目的: YouWare 上で動作する React + Vite + TypeScript の初期構成を用意し、フレーム運用と将来の機能実装をスムーズにする
- 現状: 初期ディレクトリを作成し、フレーム運用ガイドと元仕様の参照を docs に配置済み（実装は最小限）

参照ドキュメント:
- 仕様原本: `docs/mockup-app-specification.md`（ユーザー提供仕様を保管）
- フレーム運用: `docs/FRAMES.md`（フレーム登録・メタデータ・品質ルール）

## ディレクトリ構成（本プロジェクト特有）

### 静的アセット (`public/assets/`)
- `public/assets/fonts/` … カスタムフォント（New Atten Round, GenJyuuGothicX）
- `public/assets/frames/` … 端末フレーム画像（透過PNG）

**重要**: `public/` 配下のファイルは Vite によって `/assets/...` としてアクセス可能。ビルド時に `dist/assets/` へ自動コピーされる。

### モックアップ機能 (`src/features/mockup/`)
  - `components/` … UI コンポーネント（MultiDeviceMockup, MockupGallery など実装済み）
  - `hooks/` … カスタムフック（useGalleryFilters など実装済み）
  - `gallery/` … ギャラリー機能（シーン選択）
  - `utils/` … アスペクト比やフィット計算等のユーティリティ
  - `types/` … 型定義（Frame/Aspect など）
  - `data/` … フレームメタデータ格納予定

### ドキュメント (`docs/`)
  - `mockup-app-specification.md` … ユーザー提供仕様の保管
  - `FRAMES.md` … フレーム運用ガイド（登録手順・品質基準）

補足: 本番コードでは静的アセットは必ず絶対パス `/assets/...` で参照し、`src/assets/` は使用しません（Vite 本番ビルドでのパス解決のため）。

## GitHubからのインポート要件

### インポート概要
- インポートするリポジトリは"https://github.com/seripoyo/01_YouWare_Mockup"
- インポートする際は、リポジトリ直下にあるものはこのプロジェクト直下にそのままインポートする。勝手にディレクトリ構造を変えてはならない。
- GitHubと接続した時に「リポジトリ内でインポート不要なディレクトリ」に記載したディレクトリ及びその中のファイル以外で、現在のYouWareのファイルとGitHubの同じ名前のファイルが異なる場合は、GitHubのファイルを最新版としてインポートする。

### 01_YouWare_Mockupリポジトリ内でインポート不要なディレクトリ

以下はインポートする際に対象外とし、読み込み・確認自体もスキップするものとする。

- node_modulesディレクトリ
- publicディレクトリ
- docsディレクトリ
- distディレクトリ


## 実装方針（MVP）
- ユーザー画像を選択したフレームのスクリーン領域にフィット（cover/contain 切替は今後）
- 複数端末を 1 枚に合成できるレイアウト土台（grid, staggered 等のプリセットは今後）
- 出力アスペクト比: 9:16 / 16:9 / 1:1 をプリセット選択
- 背景は `/assets/backgrounds/` から選択（任意）

技術メモ:
- スクリーン領域が矩形の場合は単純スケール/トリムで対応（`rect`）
- 詳細仕様は `docs/FRAMES.md` を参照

## コマンド
- 依存関係インストール: `npm install`
- 本番ビルド: `npm run build`

YouWare のゼロトレランス方針: 変更後は必ず `npm run build` を実行し、エラーを解消してから先に進めてください。

## アセット運用規約（重要）

### 静的アセット配置ルール
- **配置場所**: `public/assets/` 配下に配置
- **参照パス**: コード内では必ず絶対パス `/assets/...` で参照
- **ビルド動作**: Vite が自動的に `public/` を `dist/` にコピー
- **禁止事項**: `src/assets/` からの相対参照（例: `./src/assets/...`）は使用禁止

### アセットの種類と要件

#### フォントファイル (`public/assets/fonts/`)
- New Atten Round: regular, Bold, ExtraBold (woff2/woff)
- GenJyuuGothicX: Regular, Medium, Bold, Heavy (woff2/woff)
- **現状**: ディレクトリのみ作成済み。フォント未配置の場合はシステムフォントにフォールバック

#### デバイスフレーム (`public/assets/frames/`)
- **形式**: 透過PNG
- **スクリーン領域**: 完全透過させること
- **推奨解像度**: 2500-5000px（高品質出力用）
- **命名規則**: 小文字ハイフン区切り（例: `iphone-15-pro.png`）
- **メタデータ**: `src/features/mockup/data/frames.json` に登録
- **詳細**: `docs/FRAMES.md` を参照

#### 背景画像 (`public/assets/backgrounds/`)
- **用途**: 複数端末合成時の背景（任意）
- **形式**: PNG, JPG, WebP
- **推奨解像度**: 1920x1080 以上

### アセット追加手順
1. ファイルを `public/assets/` 配下の適切なディレクトリに配置
2. コード内で `/assets/...` として参照
3. `npm run build` でビルド検証
4. フレーム画像の場合は `src/features/mockup/data/frames.json` にメタデータ登録

### トラブルシューティング
- **ビルド警告**: フォントファイル未配置時の警告は無視可（runtime 解決）
- **404 エラー**: パス参照が `/assets/` で始まっているか確認
- **フレーム表示されない**: `frames.json` の登録と PNG 配置を確認

## 高レベル構成と今後の配置
- UI/編集: `src/features/mockup/components` にドラッグ&ドロップやキャンバス、エクスポートパネル等を配置予定
- ロジック: `src/features/mockup/utils` にアスペクト比計算、フィット、合成ヘルパーを配置予定
- データ: `src/features/mockup/data/frames.json`（実データ）を用意し、`frames.sample.json` を参照に整備
- 型: `src/features/mockup/types` に `Frame`, `ScreenRect`, `ScreenQuad`, `Aspect` などを定義

## ビルド・検証の要点
- Vite + React（TypeScript）を採用
- index.html のエントリ `<script type="module" src="/src/main.tsx"></script>` は変更不可
- 画像や CSS のビルド後パスを前提に、静的参照は `/assets/` で統一

## データベース／バックエンド
- 現時点では未実装。エクスポート履歴やユーザープロジェクト保存が必要になった段階で、Youware Backend（D1/R2/認証）を採用します。
- 導入時は `/backend/` 以下に Worker 構成・`schema.sql` を設置し、R2 は「プリサインURL経由の直PUT/GET」ポリシーに従います。

## フレームの登録フロー（運用）
1. 透過 PNG を `public/assets/frames/` に配置
2. `src/features/mockup/data/frames.json` を作成し、`id`/`name`/`category`/`frameImage`/`screen` などを追記（`frames.sample.json` を参照）
3. アプリ側で `frames.json` を読み込み、ギャラリーに表示・選択できるようにする（今後の実装範囲）

## 参考
- ユーザー提供仕様: `docs/mockup-app-specification.md`
- フレーム運用ガイド: `docs/FRAMES.md`

## 白エリア抽出システム

### 概要
デバイスモックアップ画像から白いスクリーン領域を自動検出し、識別色で塗りつぶす機能を実装。

### 主要ファイル
- `src/utils/whiteAreaExtractor.ts` - 白エリア抽出のコアロジック
- `src/constants/deviceColors.ts` - デバイス識別色の定義

### 検出アルゴリズム
1. **輝度閾値による白ピクセル判定** (ITU-R BT.601標準、閾値: 0.90)
2. **BFS連結成分抽出** (4方向接続でグループ化)
3. **黒ベゼル検出** (領域外側15pxをサンプリング、暗いピクセル割合でスコアリング)
4. **多段階フィルタリング**:
   - 面積: 0.5%以上
   - 矩形度: 0.40以上（傾いたデバイスや角丸画面に対応）
   - ベゼルスコア: 0.25以上（画像端のデバイスに対応）
   - ベゼル辺数: 2辺以上（片側配置のデバイスに対応）
   - ベゼル辺有効判定: 0.15以上
5. **総合スコアリング** (上位3領域を選択、デバイス番号と識別色を付与)

### 識別色
```typescript
DEVICE_FILL_COLORS = {
  primary: '#e5c4be',    // 1台目: ピンクベージュ
  secondary: '#accbde',  // 2台目: ライトブルー
  tertiary: '#ffe2c6',   // 3台目: ピーチ
}
```

### 使用方法
PreviewModalで「白エリアを検出＆塗りつぶし」ボタンをクリックすると、検出された各デバイスの画面領域が上記の色で塗りつぶされたプレビューが表示される。

## モバイル画像保存機能

### 概要
モバイルデバイス（iOS/Android）とデスクトップで画像ダウンロードを正しく動作させるためのクロスプラットフォーム対応実装。

### 主要ファイル
- `src/utils/mobileFeatures.ts` - モバイル機能のユーティリティ（画像保存、WebView連携など）

### 実装戦略
1. **WebView環境**: ネイティブブリッジ経由で写真ギャラリーに保存
2. **iOS Safari**: Web Share API → 失敗時は新規タブで画像表示（長押し保存の案内付き）
3. **Android**: Web Share API → 失敗時はanchor download
4. **デスクトップ**: blob URLを使用したanchor download

### iOS Safariの制限事項
- anchor要素の`download`属性が無視される
- data URLへのリンクは画像として新規タブで開かれる
- Web Share APIでのファイル共有はiOS 15+で対応

### 使用例
```typescript
import { saveImageToDevice } from '../../../../utils/mobileFeatures';

const handleDownload = async () => {
  const success = await saveImageToDevice(imageDataUrl, 'filename.png');
  if (!success) {
    alert('保存に失敗しました');
  }
};
```
