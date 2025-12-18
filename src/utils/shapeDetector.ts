/**
 * 形状パターン検出ユーティリティ
 * 平行四辺形・台形・長方形を検出
 */

export interface Point {
  x: number;
  y: number;
}

export type ShapePattern = 'rectangle' | 'parallelogram' | 'trapezoid' | 'irregular';

/**
 * 2点間の距離を計算
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 3点から角度を計算（度数法）
 * @param p1 前の点
 * @param vertex 頂点（角度を測る点）
 * @param p2 次の点
 * @returns 内角（度）
 */
function calculateAngle(p1: Point, vertex: Point, p2: Point): number {
  // ベクトルを計算
  const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y };
  const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y };

  // ベクトルの大きさ
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (mag1 === 0 || mag2 === 0) return 0;

  // 内積
  const dot = v1.x * v2.x + v1.y * v2.y;

  // cosθ
  const cosTheta = dot / (mag1 * mag2);

  // ラジアンから度に変換
  const angleRad = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
  const angleDeg = (angleRad * 180) / Math.PI;

  return angleDeg;
}

/**
 * 4隅の座標から形状パターンを検出
 * @param corners 時計回りの4隅座標 [左上, 右上, 右下, 左下]
 * @returns 検出された形状パターン
 */
export function detectShapePattern(
  corners: [Point, Point, Point, Point]
): ShapePattern {
  // 4辺の長さを計算
  const side1 = distance(corners[0], corners[1]); // 上辺
  const side2 = distance(corners[1], corners[2]); // 右辺
  const side3 = distance(corners[2], corners[3]); // 下辺
  const side4 = distance(corners[3], corners[0]); // 左辺

  // 4つの角度を計算（内角）
  const angle1 = calculateAngle(corners[3], corners[0], corners[1]); // 左上
  const angle2 = calculateAngle(corners[0], corners[1], corners[2]); // 右上
  const angle3 = calculateAngle(corners[1], corners[2], corners[3]); // 右下
  const angle4 = calculateAngle(corners[2], corners[3], corners[0]); // 左下

  // 対辺の長さ比較（差分の割合）
  const oppositeSide1Diff = Math.abs(side1 - side3) / Math.max(side1, side3);
  const oppositeSide2Diff = Math.abs(side2 - side4) / Math.max(side2, side4);

  // 角度のチェック
  const allAnglesNearRight = [angle1, angle2, angle3, angle4]
    .every(a => a >= 85 && a <= 95);

  // 1. 長方形チェック
  if (
    allAnglesNearRight &&
    oppositeSide1Diff < 0.05 &&
    oppositeSide2Diff < 0.05
  ) {
    return 'rectangle';
  }

  // 2. 平行四辺形チェック
  const parallelCheck =
    oppositeSide1Diff < 0.1 &&
    oppositeSide2Diff < 0.1;

  const hasNonRightAngles = [angle1, angle2, angle3, angle4]
    .some(a => (a >= 75 && a < 85) || (a > 95 && a <= 105));

  if (parallelCheck && hasNonRightAngles) {
    return 'parallelogram';
  }

  // 3. 台形チェック
  if (oppositeSide1Diff > 0.1 || oppositeSide2Diff > 0.1) {
    return 'trapezoid';
  }

  return 'irregular';
}

/**
 * 形状パターンの詳細情報を取得
 */
export interface ShapeAnalysis {
  pattern: ShapePattern;
  sides: [number, number, number, number]; // 4辺の長さ
  angles: [number, number, number, number]; // 4つの内角（度）
  oppositeSideDiffs: [number, number]; // 対辺の長さ差分（割合）
  description: string; // 人間が読める説明
}

/**
 * 形状パターンの詳細分析
 */
export function analyzeShape(
  corners: [Point, Point, Point, Point]
): ShapeAnalysis {
  const pattern = detectShapePattern(corners);

  // 4辺の長さ
  const sides: [number, number, number, number] = [
    distance(corners[0], corners[1]), // 上辺
    distance(corners[1], corners[2]), // 右辺
    distance(corners[2], corners[3]), // 下辺
    distance(corners[3], corners[0]), // 左辺
  ];

  // 4つの角度
  const angles: [number, number, number, number] = [
    calculateAngle(corners[3], corners[0], corners[1]), // 左上
    calculateAngle(corners[0], corners[1], corners[2]), // 右上
    calculateAngle(corners[1], corners[2], corners[3]), // 右下
    calculateAngle(corners[2], corners[3], corners[0]), // 左下
  ];

  // 対辺の長さ差分
  const oppositeSideDiffs: [number, number] = [
    Math.abs(sides[0] - sides[2]) / Math.max(sides[0], sides[2]),
    Math.abs(sides[1] - sides[3]) / Math.max(sides[1], sides[3]),
  ];

  // 説明文を生成
  let description = '';
  switch (pattern) {
    case 'rectangle':
      description = '長方形（正面ビュー）- 4つの角度がすべて直角に近い';
      break;
    case 'parallelogram':
      description = '平行四辺形（斜め3Dビュー）- 対辺が平行だが角度が直角でない';
      break;
    case 'trapezoid':
      description = '台形（遠近法ビュー）- 1組の辺が平行で、もう1組の辺が平行でない';
      break;
    case 'irregular':
      description = '不規則な四角形 - 明確なパターンに当てはまらない';
      break;
  }

  return {
    pattern,
    sides,
    angles,
    oppositeSideDiffs,
    description,
  };
}

/**
 * 形状パターンに基づくデバイスタイプのスコア調整係数を取得
 */
export function getShapeScoreModifiers(pattern: ShapePattern): {
  laptopModifier: number;
  smartphoneModifier: number;
  tabletModifier: number;
} {
  switch (pattern) {
    case 'rectangle':
      // 長方形（正面ビュー）- すべてのデバイスタイプの可能性あり
      return {
        laptopModifier: 1.0,
        smartphoneModifier: 1.0,
        tabletModifier: 1.0,
      };

    case 'parallelogram':
    case 'trapezoid':
      // 平行四辺形・台形（3D角度）- ラップトップ/タブレットの可能性が高い
      return {
        laptopModifier: 1.2,
        smartphoneModifier: 0.5, // スマホは薄いため3D形状になりにくい
        tabletModifier: 1.2,
      };

    case 'irregular':
      // 不規則 - スコア調整なし
      return {
        laptopModifier: 1.0,
        smartphoneModifier: 1.0,
        tabletModifier: 1.0,
      };
  }
}
