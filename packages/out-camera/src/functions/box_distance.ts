import type { Point, Box, OCRResult } from "../types/type";

/**
 * 点と矩形（4頂点ボックス）の符号付き最短距離を計算
 * - 内側にある場合：負の値（内部までの最短距離）
 * - 辺上にある場合：0
 * - 外側にある場合：正の値
 *
 * @param point [x, y]
 * @param box [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
 * @returns 距離（符号付き）
 */
export function boxDistance(point: Point, box: Box): number {
  const [px, py] = point;

  // 射影法で内外判定
  let inside = false;
  for (let i = 0, j = box.length - 1; i < box.length; j = i++) {
    const [xi, yi] = box[i]!;
    const [xj, yj] = box[j]!;
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }

  // 各辺との距離を計算
  let minDist = Infinity;
  for (let i = 0; i < box.length; i++) {
    const p1 = box[i]!;
    const p2 = box[(i + 1) % box.length]!;
    const d = pointToSegmentDistance(point, p1, p2);
    if (d < minDist) minDist = d;
  }

  // 符号付け
  // 内部なら負の距離、辺上は0、外側は正
  if (minDist < 1e-6) return 0; // 辺上
  if (inside) return -minDist; // 内部
  return minDist; // 外部
}

/** 点と線分の最短距離 */
function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const [px, py] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;

  const dx = x2 - x1;
  const dy = y2 - y1;

  // 線分が1点の場合
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  // 射影係数 t
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);

  if (t <= 0) return Math.hypot(px - x1, py - y1);
  if (t >= 1) return Math.hypot(px - x2, py - y2);

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * タップ位置に最も近いOCRボックスを返す
 * @param tapPoint ユーザーがタップした座標 [x, y]
 * @param ocrResults OCR結果の配列 ([Box, [text, confidence]][])
 * @returns 最も近いボックス情報 or null
 */
export function findNearestOCRBox(
  tapPoint: Point,
  ocrResults: OCRResult[]
): { box: Box; text: string; confidence: number; distance: number } | null {
  if (!ocrResults || ocrResults.length === 0) return null;

  let nearest: {
    box: Box;
    text: string;
    confidence: number;
    distance: number;
  } | null = null;

  for (const [box, [text, confidence]] of ocrResults) {
    const dist = boxDistance(tapPoint, box);

    // 内側または線上 → 即採用（最も近いとみなす）
    if (dist <= 0) {
      return { box, text, confidence, distance: dist };
    }

    // より近いものを更新
    if (!nearest || dist < nearest.distance) {
      nearest = { box, text, confidence, distance: dist };
    }
  }

  return nearest;
}
