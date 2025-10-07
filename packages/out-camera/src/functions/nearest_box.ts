import type { Point, OCRResult, Box } from "../types/type";
import { boxDistance } from "./box_distance";

/** OCR結果からボックス情報を事前計算 */
function preprocessOCRBoxes(ocrResults: OCRResult[]) {
  return ocrResults.map(([box], i) => {
    const xs = box.map(([x]) => x);
    const ys = box.map(([y]) => y);
    const centroid: Point = [
      xs.reduce((a, b) => a + b) / xs.length,
      ys.reduce((a, b) => a + b) / ys.length,
    ];
    const bbox = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
    return { index: i, centroid, bbox };
  });
}

/**
 * タップ位置に最も近いOCRボックスを返す（前処理付き高速版）
 */
export function findNearestOCRBox(
  tapPoint: Point,
  ocrResults: OCRResult[]
): {
  index: number;
  box: Box;
  text: string;
  confidence: number;
  distance: number;
} | null {
  if (!ocrResults || ocrResults.length === 0) return null;

  const preprocessed = preprocessOCRBoxes(ocrResults);
  const [px, py] = tapPoint;

  let nearestIndex = -1;
  let nearestDist = Infinity;

  for (const { index, bbox } of preprocessed) {
    const dx = Math.max(bbox.minX - px, 0, px - bbox.maxX);
    const dy = Math.max(bbox.minY - py, 0, py - bbox.maxY);
    const approxDist = Math.hypot(dx, dy);

    if (approxDist < Math.abs(nearestDist)) {
      const [box] = ocrResults[index]!;
      const dist = boxDistance(tapPoint, box);

      // 内側（負の距離）は最優先
      if (dist < 0) {
        // より深く内側にあるボックスを優先（絶対値が大きいほど中心側）
        if (nearestDist >= 0 || dist > nearestDist) {
          nearestDist = dist;
          nearestIndex = index;
        }
      } else {
        // 外側の場合は距離が小さいものを優先
        if (nearestDist >= 0 && dist < nearestDist) {
          nearestDist = dist;
          nearestIndex = index;
        }
      }
    }
  }

  if (nearestIndex === -1) return null;

  const [box, [text, confidence]] = ocrResults[nearestIndex]!;
  return { index: nearestIndex, box, text, confidence, distance: nearestDist };
}
