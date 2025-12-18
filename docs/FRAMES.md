# フレーム運用ガイド

このドキュメントは、ユーザー提供の端末フレーム画像を YouWare プロジェクトに組み込むための運用ルールとメタデータ仕様をまとめたものです。

## 目的
- ユーザーがアップロードしたアプリやWebのスクリーンショットを、選択した端末フレームに「ぴったり」合わせて合成する
- 複数端末（例: スマートフォン + パソコン）を同一キャンバスにまとめたモックアップ画像も生成できる
- 出力アスペクト比は 9:16 / 16:9 / 1:1 を切り替え可能

## ディレクトリと命名
- フレーム画像の格納先: `public/assets/frames/`
- 例:
  - `public/assets/frames/iphone-15-pro.png`（透過PNG、スクリーン部分が透過されていること）
  - `public/assets/frames/macbook-pro-14.png`
  - 任意でスクリーン領域専用マスクを用意する場合は `*-mask.png` を採用: 例 `iphone-15-pro-mask.png`

注意: YouWare の本番ビルドでは、フロントエンドからの参照は必ず絶対パス `/assets/...` を使用します（例: `/assets/frames/iphone-15-pro.png`）。

## メタデータ（推奨）
フレーム画像に対応するスクリーン領域（ユーザー画像をはめ込む領域）を JSON で定義します。配置場所は任意ですが、以下のいずれかを推奨します。
- `src/features/mockup/data/frames.json`（アプリに同梱）
- もしくは `public/assets/frames/frames.json`（CDN から取得する場合）

### JSON スキーマ
```jsonc
{
  "frames": [
    {
      "id": "iphone-15-pro",
      "name": "iPhone 15 Pro",
      "category": "smartphone",
      "frameImage": "/assets/frames/iphone-15-pro.png",
      "maskImage": "/assets/frames/iphone-15-pro-mask.png", // 任意
      "pixelSize": { "width": 3000, "height": 3000 },
      "screen": {
        "kind": "rect", // or "quad"
        "rect": { "x": 420, "y": 320, "width": 2160, "height": 1350, "rotation": 0 }
        // "quad": { "tl": {"x":...,"y":...}, "tr": {...}, "bl": {...}, "br": {...} }
      },
      "aspectSupport": ["9:16", "1:1", "16:9"]
    }
  ]
}
```

- `kind: "rect"` は長方形のスクリーンを指定します。
- `kind: "quad"` は遠近（台形・透視投影）など四隅指定をしたい場合に使用します。
- `pixelSize` はフレームPNG自体のピクセル寸法です（等倍配置や高解像度合成時の基準）。
- `aspectSupport` は、そのフレームで想定している出力アスペクト比の候補です。

## 画像仕様の推奨
- フレームPNG: 背景は透明、スクリーン領域は「完全に透過」すること
- 解像度目安:
  - スマートフォン: 2500〜3500px 辺長
  - タブレット: 3000〜4000px 辺長
  - ラップトップ/デスクトップ: 3500〜5000px 辺長
- カラープロファイル: sRGB
- 余白: 端末影等を含める場合はスクリーンとの干渉が起きないよう十分な余白を確保

## はめ込みロジックの概要
- `rect` の場合: スクリーン領域の `width/height` を基準に、ユーザー画像を cover（はみ出し可）または contain（はみ出し不可）のいずれかでスケール。

本リポジトリには、以下のユーティリティ・型定義を用意しています。
- `src/features/mockup/utils/aspect.ts` — 9:16 / 16:9 / 1:1 の計算ヘルパー
- `src/features/mockup/hooks/useFitToFrame.ts` — 画像のフィット計算（cover/contain）
- `src/features/mockup/types/frame.ts` — 型定義（Frame/Region/Aspect 等）

## 複数端末をまとめたモックアップ
- レイアウトプリセット例: `grid-2`, `grid-3`, `staggered`（段違い配置）
- 余白・影・重なり順のルールを決めて一貫性を保つ
- 出力アスペクト比は 9:16 / 16:9 / 1:1 から選択
- 背景は `/assets/backgrounds/` に任意の画像を配置可能（任意）

## 追加手順（新しいフレームの登録）
1. 透過PNG を `public/assets/frames/` に配置
2. `frames.json` にエントリを追加（`id` はユニークに）
3. `screen` の `rect`（もしくは `quad`）を正確に計測して記述
4. 必要なら `maskImage` を用意（反射や丸角など高度な合成で使用）

## 品質チェックリスト
- [ ] スクリーン部分が完全に透過されている
- [ ] 解像度が十分（エクスポート想定に対して 1.5〜2.0x 程度）
- [ ] ファイル名・ID が一貫した命名規則
- [ ] `/assets/` から参照可能（相対パスや `src/assets` を使わない）
- [ ] `frames.json` の数値（px）が実画素と一致
