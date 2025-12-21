# 白エリア検出問題 修正計画書

## 1. 問題の全体像

### 1.1 報告された症状

| 症状 | 詳細 | 影響範囲 |
|-----|------|---------|
| **検出失敗** | 一部テンプレートで白エリアが自動検出されない | 16件のテンプレート |
| **背景の黒化** | デバイス背景の白い部分が黒くなる | 検出成功テンプレートの一部 |
| **手の黒化** | 画面上の手が黒くなる | 手がデバイスに触れているテンプレート |

### 1.2 検出失敗テンプレートの分類

```
【グループA: 白背景/白デスク問題】
├── sp_16x9_111_blue_white.webp  (白デスク + 白背景)
├── sp_16x9_112_blue_white.webp  (白デスク + ノート類)
├── sp_16x9_115_blue_white.webp  (白デスク)
├── sp_16x9_116_blue_white.webp  (複数の白ノート)
├── sp_16x9_127_blue_white.webp  (白デスク + 白紙)
└── sp_16x9_132_blue.webp        (白デスク)

【グループB: 極端な透視変形問題】
├── sp_4x5_012_pink.webp         (平置き斜め)
└── sp_1x1_052_pink.webp         (平置き斜め + 手重なり)

【グループC: 光のグラデーション問題】
└── sp_1x1_004_orange.webp       (右上に白いグラデーション光)

【グループD: その他/複合要因】
├── sp_1x1_067_blue.webp         (背景明るめ)
├── sp_1x1_002_pink.webp         (平置き + グレーベゼル)
├── sp_1x1_031_pink.webp         (平置き + グレーベゼル)
├── sp_1x1_032_pink.webp         (類似)
├── 1sp_9x16_012_gray_white.webp (白背景 + 細いベゼル)
└── 1sp_9x16_101_beige_brown_orange.webp (複合要因)
```

---

## 2. 根本原因の分析

### 2.1 現在のアルゴリズムの流れ

```
[画像入力]
    ↓
[1. 白ピクセル検出] ← luminance >= 0.90 で白判定
    ↓
[2. 連結成分抽出] ← BFS 4方向で隣接白ピクセルをグループ化
    ↓
[3. 面積フィルタ] ← 全体の0.5%以上
    ↓
[4. 矩形度フィルタ] ← rectangularity >= 0.35
    ↓
[5. ベゼルスコアフィルタ] ← bezelScore >= 0.20
    ↓
[6. ベゼル辺数フィルタ] ← 1辺以上がベゼルスコア > 0.15
    ↓
[検出完了]
```

### 2.2 問題発生メカニズム

#### 問題A: 白領域の融合

```
【正常ケース】               【問題ケース】
┌─────────────────┐         ┌─────────────────┐
│  ピンク背景     │         │  白い背景       │
│  ┌───────┐     │         │                 │
│  │ 白画面 │     │         │  ┌───────┐     │
│  │███████│     │         │  │ 白画面 │     │
│  └───────┘     │         │  │       │     │
│  ピンクデスク   │         │  白デスク       │
└─────────────────┘         └─────────────────┘

白画面が独立した            白画面 + 白デスク + 白背景が
連結成分として検出           一つの巨大な連結成分になる
```

**影響:**
- 連結成分の「外周」が画面のベゼルではなくデスクの端になる
- ベゼル検出が正しく機能しない
- 最終的に検出失敗

#### 問題B: 背景/手の黒化

```
【合成処理の流れ】

1. マスク領域検出: luminance >= 0.90 の領域
   → 画面だけでなく、白い背景や明るい肌もマスクに含まれる

2. ユーザー画像を透視変換して合成
   → マスク領域全体に画像が配置される

3. ベゼル復元処理:
   → マスク領域のうち「白だった場所」をフレーム画像で上書き
   → 白い背景や手もフレーム画像で上書きされる
   → フレーム画像の該当位置が暗いと「黒くなる」
```

---

## 3. 修正方針

### 3.1 段階的アプローチ

```
【Phase 1】検出精度の向上
  └─ 白領域分離アルゴリズムの改善

【Phase 2】マスク品質の向上
  └─ マスク収縮処理の追加

【Phase 3】合成処理の改善
  └─ ベゼル復元ロジックの最適化
```

### 3.2 各フェーズの優先度と依存関係

```
Phase 1 ─────→ Phase 2 ─────→ Phase 3
  │              │              │
  │              │              └─ 背景/手の黒化を完全解決
  │              └─ 境界のぼやけを解決
  └─ 検出失敗を解決
```

---

## 4. Phase 1: 検出精度の向上

### 4.1 変更対象ファイル

```
src/utils/whiteAreaExtractor.ts
```

### 4.2 実装ステップ

#### Step 1.1: アスペクト比フィルタの追加

**目的:** スマートフォン画面らしいアスペクト比の領域を優先

**実装内容:**
```typescript
// 新しいフィルタ関数を追加
function calculateAspectRatioScore(bounds: { width: number; height: number }): number {
  const aspectRatio = bounds.height / bounds.width;

  // スマートフォン画面のアスペクト比: 約1.8〜2.2 (9:16〜9:20相当)
  // タブレット: 約1.3〜1.5
  // ラップトップ: 約0.56〜0.67 (16:9〜3:2相当)

  const smartphoneScore = 1 - Math.min(1, Math.abs(aspectRatio - 2.0) / 0.5);
  const tabletScore = 1 - Math.min(1, Math.abs(aspectRatio - 1.4) / 0.3);
  const laptopScore = 1 - Math.min(1, Math.abs(aspectRatio - 0.6) / 0.2);

  // 最も高いスコアを採用（いずれかのデバイスタイプに近ければOK）
  return Math.max(smartphoneScore, tabletScore, laptopScore);
}
```

**変更箇所:** `detectDeviceScreens` 関数内のスコアリング

```typescript
// 総合スコア計算を改善
const aspectScore = calculateAspectRatioScore(regionBounds);
const overallScore = bezelScore * areaRatio * rectangularity * aspectScore * 1000;
```

#### Step 1.2: 輝度閾値の段階的適用

**目的:** 純粋な白画面を優先的に検出

**実装内容:**
```typescript
// detectDeviceScreens を拡張
export function detectDeviceScreens(
  imageData: ImageData,
  options: DetectionOptions = {}
): ScreenRegion[] {
  // Step 1: まず高い閾値(0.97)で検出を試みる
  const strictOpts = { ...options, luminanceThreshold: 0.97 };
  let regions = detectDeviceScreensInternal(imageData, strictOpts);

  // Step 2: 検出できなければ標準閾値(0.90)で再試行
  if (regions.length === 0) {
    const normalOpts = { ...options, luminanceThreshold: 0.90 };
    regions = detectDeviceScreensInternal(imageData, normalOpts);
  }

  return regions;
}
```

#### Step 1.3: ベゼル連続性スコアの導入

**目的:** 「途切れのない黒い帯」を持つ領域を高く評価

**実装内容:**
```typescript
function checkBezelContinuity(
  imageData: ImageData,
  bounds: { x: number; y: number; width: number; height: number },
  bezelWidth: number,
  darkThreshold: number
): number {
  // 各辺を複数のセグメントに分割してチェック
  const segments = 5; // 各辺を5分割

  const checkEdgeSegments = (
    isHorizontal: boolean,
    start: number,
    end: number,
    fixedCoord: number,
    direction: 'before' | 'after'
  ): number => {
    const segmentSize = Math.floor((end - start) / segments);
    let continuousCount = 0;

    for (let i = 0; i < segments; i++) {
      const segStart = start + i * segmentSize;
      const segEnd = Math.min(segStart + segmentSize, end);

      // セグメント内の暗いピクセル比率を計算
      let darkCount = 0;
      let totalCount = 0;

      for (let pos = segStart; pos < segEnd; pos++) {
        for (let offset = 1; offset <= bezelWidth; offset++) {
          const x = isHorizontal ? pos : (direction === 'before' ? fixedCoord - offset : fixedCoord + offset);
          const y = isHorizontal ? (direction === 'before' ? fixedCoord - offset : fixedCoord + offset) : pos;

          if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
            const idx = (y * imageData.width + x) * 4;
            const lum = getLuminance(imageData.data[idx], imageData.data[idx+1], imageData.data[idx+2]);
            if (lum < darkThreshold) darkCount++;
            totalCount++;
          }
        }
      }

      if (totalCount > 0 && darkCount / totalCount > 0.3) {
        continuousCount++;
      }
    }

    return continuousCount / segments;
  };

  const topContinuity = checkEdgeSegments(true, bounds.x, bounds.x + bounds.width, bounds.y, 'before');
  const bottomContinuity = checkEdgeSegments(true, bounds.x, bounds.x + bounds.width, bounds.y + bounds.height, 'after');
  const leftContinuity = checkEdgeSegments(false, bounds.y, bounds.y + bounds.height, bounds.x, 'before');
  const rightContinuity = checkEdgeSegments(false, bounds.y, bounds.y + bounds.height, bounds.x + bounds.width, 'after');

  // 連続性スコア（全辺の平均）
  return (topContinuity + bottomContinuity + leftContinuity + rightContinuity) / 4;
}
```

#### Step 1.4: 白領域分割ロジック

**目的:** 融合した白領域を分割して個別に評価

**実装内容:**
```typescript
function findInternalBezels(
  imageData: ImageData,
  regionPixels: number[],
  bounds: { x: number; y: number; width: number; height: number },
  darkThreshold: number
): { x: number; y: number; width: number; height: number }[] {
  const { width: imgW, data } = imageData;
  const subRegions: { x: number; y: number; width: number; height: number }[] = [];

  // 領域内で「暗いピクセルの線」を探す
  // これがベゼルの可能性がある

  // 水平方向のスキャン（垂直な暗い線を探す）
  for (let x = bounds.x + 10; x < bounds.x + bounds.width - 10; x++) {
    let darkLineCount = 0;
    for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
      const idx = (y * imgW + x) * 4;
      const lum = getLuminance(data[idx], data[idx+1], data[idx+2]);
      if (lum < darkThreshold) darkLineCount++;
    }

    // 高さの80%以上が暗ければ、ここにベゼルがある可能性
    if (darkLineCount / bounds.height > 0.8) {
      // この位置で領域を分割する候補としてマーク
      // ...分割ロジック
    }
  }

  return subRegions;
}
```

---

## 5. Phase 2: マスク品質の向上

### 5.1 変更対象ファイル

```
src/utils/whiteAreaExtractor.ts
```

### 5.2 実装ステップ

#### Step 2.1: モルフォロジー収縮（Erosion）の実装

**目的:** マスクの境界を数ピクセル内側に収縮し、曖昧な白ピクセルを除外

**実装内容:**
```typescript
/**
 * マスクの収縮処理（モルフォロジー演算）
 * @param mask 元のマスク（0 or 1）
 * @param width マスクの幅
 * @param height マスクの高さ
 * @param iterations 収縮回数（デフォルト: 2）
 */
function erodeMask(
  mask: Uint8Array,
  width: number,
  height: number,
  iterations: number = 2
): Uint8Array {
  let currentMask = new Uint8Array(mask);

  for (let iter = 0; iter < iterations; iter++) {
    const newMask = new Uint8Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        // 3x3カーネルで収縮
        // 周囲8ピクセルすべてが1の場合のみ1を維持
        const neighbors = [
          currentMask[(y-1) * width + (x-1)],
          currentMask[(y-1) * width + x],
          currentMask[(y-1) * width + (x+1)],
          currentMask[y * width + (x-1)],
          currentMask[y * width + x],
          currentMask[y * width + (x+1)],
          currentMask[(y+1) * width + (x-1)],
          currentMask[(y+1) * width + x],
          currentMask[(y+1) * width + (x+1)],
        ];

        // すべての隣接ピクセルが1ならば1（収縮）
        newMask[idx] = neighbors.every(v => v === 1) ? 1 : 0;
      }
    }

    currentMask = newMask;
  }

  return currentMask;
}
```

#### Step 2.2: 検出後のマスク収縮適用

**変更箇所:** `detectDeviceScreens` 関数の最終処理

```typescript
// マスク作成後に収縮を適用
const regionMask = createRegionMask(pixels, regionBounds, width);
const erodedMask = erodeMask(regionMask, regionBounds.width, regionBounds.height, 2);

screenRegions.push({
  bounds: regionBounds,
  pixels,
  mask: erodedMask,  // 収縮後のマスクを使用
  // ...
});
```

---

## 6. Phase 3: 合成処理の改善

### 6.1 変更対象ファイル

```
src/features/mockup/gallery/components/PreviewModal.tsx
```

### 6.2 実装ステップ

#### Step 3.1: ベゼル復元の対象領域を制限

**目的:** 画面境界付近のみを復元対象とし、背景や手を保護

**現在のコード（問題あり）:**
```typescript
// マスク領域全体をチェック
for (let dy = 0; dy < maskHeight; dy++) {
  for (let dx = 0; dx < maskWidth; dx++) {
    if (erodedMask[dy * maskWidth + dx] === 1) {
      // 白だった場所をフレームで上書き
      if (isWhite) {
        // フレーム画像のピクセルを使用
      }
    }
  }
}
```

**修正後のコード:**
```typescript
// マスク境界からの距離を考慮
function createBoundaryMask(
  mask: Uint8Array,
  width: number,
  height: number,
  boundaryWidth: number = 5
): Uint8Array {
  const boundaryMask = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      if (mask[idx] === 0) continue;

      // この点がマスク境界から boundaryWidth 以内かチェック
      let isNearBoundary = false;

      for (let dy = -boundaryWidth; dy <= boundaryWidth && !isNearBoundary; dy++) {
        for (let dx = -boundaryWidth; dx <= boundaryWidth && !isNearBoundary; dx++) {
          const ny = y + dy;
          const nx = x + dx;

          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            // 画像の外側 = 境界に近い
            isNearBoundary = true;
          } else if (mask[ny * width + nx] === 0) {
            // マスク外のピクセルが近くにある = 境界に近い
            isNearBoundary = true;
          }
        }
      }

      boundaryMask[idx] = isNearBoundary ? 1 : 0;
    }
  }

  return boundaryMask;
}

// ベゼル復元は境界マスク領域のみに適用
const boundaryMask = createBoundaryMask(erodedMask, maskWidth, maskHeight, 5);

for (let dy = 0; dy < maskHeight; dy++) {
  for (let dx = 0; dx < maskWidth; dx++) {
    const maskIdx = dy * maskWidth + dx;

    // 境界付近のみ復元処理を実行
    if (boundaryMask[maskIdx] === 1) {
      if (isWhite) {
        // フレーム画像のピクセルを使用
      }
    }
  }
}
```

#### Step 3.2: 色差による復元判定

**目的:** 「明らかに異なる色」の場合のみ復元

**実装内容:**
```typescript
function shouldRestorePixel(
  frameR: number, frameG: number, frameB: number,
  compositeR: number, compositeG: number, compositeB: number,
  originalR: number, originalG: number, originalB: number
): boolean {
  // 元画像が白で、フレームが暗い場合のみ復元
  const originalLuminance = getLuminance(originalR, originalG, originalB);
  const frameLuminance = getLuminance(frameR, frameG, frameB);

  // 元画像が白（輝度 >= 0.90）の場合
  if (originalLuminance >= 0.90) {
    // フレームとの色差を計算
    const colorDiff = Math.sqrt(
      Math.pow(frameR - originalR, 2) +
      Math.pow(frameG - originalG, 2) +
      Math.pow(frameB - originalB, 2)
    );

    // 色差が大きい場合（ベゼルの黒など）は復元
    // 色差が小さい場合（白い背景など）は復元しない
    return colorDiff > 50 && frameLuminance < 0.5;
  }

  return false;
}
```

---

## 7. 実装順序とテスト計画

### 7.1 実装順序

```
Day 1: Phase 1 - Step 1.1, 1.2
       - アスペクト比フィルタの追加
       - 輝度閾値の段階的適用
       - テスト: グループA（白背景問題）のテンプレートで検出確認

Day 2: Phase 1 - Step 1.3, 1.4
       - ベゼル連続性スコアの導入
       - 白領域分割ロジック（必要に応じて）
       - テスト: 全失敗テンプレートで検出確認

Day 3: Phase 2 - Step 2.1, 2.2
       - マスク収縮処理の実装
       - テスト: マスク品質の視覚的確認

Day 4: Phase 3 - Step 3.1, 3.2
       - ベゼル復元の対象領域制限
       - 色差による復元判定
       - テスト: 背景/手の黒化が解消されるか確認

Day 5: 統合テスト
       - 全テンプレートでの回帰テスト
       - エッジケースの確認
       - パフォーマンス確認
```

### 7.2 テストケース

| テストID | テンプレート | 期待結果 |
|---------|------------|---------|
| TC-001 | sp_16x9_111_blue_white | 白デスクと分離して画面を検出 |
| TC-002 | sp_4x5_012_pink | 平置きでも検出成功 |
| TC-003 | sp_1x1_004_orange | グラデーション光と分離して検出 |
| TC-004 | sp_1x1_042_pink | 検出成功、手が黒くならない |
| TC-005 | sp_1x1_073_blue | 検出成功、背景が黒くならない |

### 7.3 回帰テスト

既存の正常動作テンプレートが引き続き動作することを確認:
- sp_1x1_073_blue.webp
- sp_4x5_016_pink.webp
- sp_1x1_042_pink.webp
- sp_16x9_131_blue_white.webp

---

## 8. リスクと対策

### 8.1 想定されるリスク

| リスク | 影響度 | 対策 |
|-------|-------|------|
| 過度な閾値調整で既存テンプレートが検出失敗 | 高 | 段階的閾値適用で回避 |
| マスク収縮で画面端が欠ける | 中 | 収縮量を調整可能に |
| パフォーマンス低下 | 低 | 必要に応じて最適化 |

### 8.2 フォールバック戦略

1. 各Phaseを独立してデプロイ可能にする
2. 問題発生時は前のバージョンに即座にロールバック
3. 検出ログ機能を活用して問題を迅速に特定

---

## 9. 成功指標

- [ ] 16件の失敗テンプレートすべてで自動検出が成功
- [ ] 既存の成功テンプレートで回帰が発生しない
- [ ] 背景/手の黒化問題が解消
- [ ] 検出処理時間が現在の2倍以内に収まる

---

## 10. 備考

### 10.1 今後の検討事項

- 機械学習ベースの画面検出（将来的な改善案）
- ユーザーによる手動調整機能の追加
- 検出パラメータのプリセット機能

### 10.2 参考資料

- `white-area.md`: 現在の検出アルゴリズム仕様
- `DEVICE_DETECTION_SPEC.md`: デバイス検出仕様
- `src/utils/whiteAreaExtractor.ts`: 現在の実装

---

**作成日:** 2025-12-22
**作成者:** Claude Code
**バージョン:** 1.0
