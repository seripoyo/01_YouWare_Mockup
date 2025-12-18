# モックアップ生成アプリ - YOUWARE 開発ガイド

このリポジトリは、ユーザーがアップロードしたスクリーンショットを端末フレーム（スマートフォン/タブレット/PC 等）にぴったり合わせ、単体/複数端末のモックアップ画像を作成できる Web アプリの土台です。出力アスペクト比は 9:16 / 16:9 / 1:1 を選択可能です。フレーム画像はユーザー提供前提で、YouWare のビルド要件に沿ったディレクトリ構成を整備済みです。

## 目的と現状
- 目的: YouWare 上で動作する React + Vite + TypeScript の初期構成を用意し、フレーム運用と将来の機能実装をスムーズにする
- 現状: 初期ディレクトリを作成し、フレーム運用ガイドと元仕様の参照を docs に配置済み（実装は最小限）

参照ドキュメント:
- 仕様原本: `docs/mockup-app-specification.md`（ユーザー提供仕様を保管）
- フレーム運用: `docs/FRAMES.md`（フレーム登録・メタデータ・品質ルール）

## ディレクトリ構成（本プロジェクト特有）

- `public/assets/frames/` … 端末フレーム画像（透過PNG）。本番参照は絶対パス `/assets/frames/...`
- `public/assets/backgrounds/` … 背景画像（任意）
- `src/features/mockup/` … モックアップ機能のコード領域
  - `components/` … UI コンポーネント（今後追加）
  - `hooks/` … カスタムフック（今後追加）
  - `utils/` … アスペクト比やフィット計算等のユーティリティ（今後追加）
  - `types/` … 型定義（Frame/Aspect など、今後追加）
  - `data/frames.sample.json` … フレームメタデータのサンプル（ユーザー提供画像に合わせて `frames.json` を用意する想定）
- `docs/` … 仕様・運用資料
  - `mockup-app-specification.md` … 添付仕様の保管
  - `FRAMES.md` … フレーム運用ガイド

補足: 本番コードでは静的アセットは必ず絶対パス `/assets/...` で参照し、`src/assets/` は使用しません（Vite 本番ビルドでのパス解決のため）。

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
- 本番参照は絶対パス: 例 `src` からは `"/assets/frames/iphone-15-pro.png"`
- `src/assets/` の相対参照（例: `./src/assets/...`）は禁止
- フレーム PNG はスクリーン領域を完全透過させること
- 推奨解像度や登録手順は `docs/FRAMES.md` を参照

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
