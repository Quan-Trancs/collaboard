export const MAX_STROKE_POINTS = 256;

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

export function expandInkElements<T extends { id: string; type?: string; points?: StrokePoint[]; x?: number; y?: number }>(
  elements: T[],
  maxPoints = MAX_STROKE_POINTS
): T[] {
  return elements.flatMap((element) => {
    if (element.type && element.type !== "pen" && element.type !== "drawing") {
      return [element];
    }
    return splitInkElement(element, maxPoints);
  });
}

export function appendStrokePoint<T extends { id: string; points?: StrokePoint[]; x: number; y: number }>(
  element: T,
  point: StrokePoint,
  nextId: string,
  maxPoints = MAX_STROKE_POINTS
): { current: T; next: T | null } {
  const points = [...(element.points || []), point];
  if (points.length <= maxPoints) {
    return { current: { ...element, points }, next: null };
  }

  const sealed = points.slice(0, maxPoints);
  const remainder = points.slice(maxPoints - 1);
  return {
    current: { ...element, points: sealed },
    next: {
      ...element,
      id: nextId,
      x: remainder[0].x,
      y: remainder[0].y,
      points: remainder,
    },
  };
}
