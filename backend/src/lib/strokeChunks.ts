export const MAX_STROKE_POINTS = 256;
export const MAX_STROKE_REQUEST_POINTS = 5000;

export type StrokePoint = { x: number; y: number };

export function strokeChunkId(baseId: string, chunkIndex: number) {
  return chunkIndex === 0 ? baseId : `${baseId}:${chunkIndex}`;
}

export function splitStrokePoints(
  points: StrokePoint[],
  maxPoints = MAX_STROKE_POINTS
): StrokePoint[][] {
  if (points.length <= maxPoints) return [points];

  const chunks: StrokePoint[][] = [];
  let start = 0;
  while (start < points.length) {
    const end = Math.min(start + maxPoints, points.length);
    chunks.push(points.slice(start, end));
    if (end >= points.length) break;
    start = end - 1;
  }
  return chunks;
}

export function splitInkElement<T extends { id: string; points?: StrokePoint[]; x?: number; y?: number }>(
  element: T,
  maxPoints = MAX_STROKE_POINTS
): T[] {
  const points = element.points;
  if (!points || points.length <= maxPoints) return [element];

  return splitStrokePoints(points, maxPoints).map((chunk, index) => ({
    ...element,
    id: strokeChunkId(element.id, index),
    x: chunk[0]?.x ?? element.x,
    y: chunk[0]?.y ?? element.y,
    points: chunk,
  }));
}
