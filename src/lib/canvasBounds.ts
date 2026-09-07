export const HARD_WORLD_MIN = -32000;
export const HARD_WORLD_MAX = 32000;
export const CONTENT_LEASH_PADDING = 2000;
export const EMPTY_WORKSPACE_SIZE = 4000;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export type Point = { x: number; y: number };

export type Rect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampZoom(zoom: number): number {
  return clamp(zoom, MIN_ZOOM, MAX_ZOOM);
}

export function isInHardWorld(x: number, y: number): boolean {
  return (
    x >= HARD_WORLD_MIN &&
    x <= HARD_WORLD_MAX &&
    y >= HARD_WORLD_MIN &&
    y <= HARD_WORLD_MAX
  );
}

export function hardWorldRect(): Rect {
  return {
    minX: HARD_WORLD_MIN,
    minY: HARD_WORLD_MIN,
    maxX: HARD_WORLD_MAX,
    maxY: HARD_WORLD_MAX,
  };
}

export function emptyWorkspaceRect(): Rect {
  const half = EMPTY_WORKSPACE_SIZE / 2;
  return { minX: -half, minY: -half, maxX: half, maxY: half };
}

export function expandRect(rect: Rect, padding: number): Rect {
  return {
    minX: rect.minX - padding,
    minY: rect.minY - padding,
    maxX: rect.maxX + padding,
    maxY: rect.maxY + padding,
  };
}

export function intersectRects(a: Rect, b: Rect): Rect {
  return {
    minX: Math.max(a.minX, b.minX),
    minY: Math.max(a.minY, b.minY),
    maxX: Math.min(a.maxX, b.maxX),
    maxY: Math.min(a.maxY, b.maxY),
  };
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  return rects.reduce((acc, rect) => ({
    minX: Math.min(acc.minX, rect.minX),
    minY: Math.min(acc.minY, rect.minY),
    maxX: Math.max(acc.maxX, rect.maxX),
    maxY: Math.max(acc.maxY, rect.maxY),
  }));
}

export function contentLeash(content: Rect | null): Rect {
  const grown = content
    ? expandRect(content, CONTENT_LEASH_PADDING)
    : emptyWorkspaceRect();
  return intersectRects(grown, hardWorldRect());
}

export function clampPointToRect(point: Point, rect: Rect): Point {
  return {
    x: clamp(point.x, rect.minX, rect.maxX),
    y: clamp(point.y, rect.minY, rect.maxY),
  };
}

export function clampPointToHardWorld(point: Point): Point {
  return clampPointToRect(point, hardWorldRect());
}

export function boundsFromItems(
  items: Array<{ x: number; y: number; width?: number; height?: number; points?: Point[] }>
): Rect | null {
  const rects: Rect[] = [];
  for (const item of items) {
    if (item.points && item.points.length > 0) {
      const xs = item.points.map((p) => p.x);
      const ys = item.points.map((p) => p.y);
      rects.push({
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      });
      continue;
    }
    const width = item.width ?? 0;
    const height = item.height ?? 0;
    rects.push({
      minX: Math.min(item.x, item.x + width),
      minY: Math.min(item.y, item.y + height),
      maxX: Math.max(item.x, item.x + width),
      maxY: Math.max(item.y, item.y + height),
    });
  }
  return unionRects(rects);
}

export function clampCameraPan(
  camera: { x: number; y: number; zoom: number },
  viewport: { width: number; height: number },
  leash: Rect
): { x: number; y: number; zoom: number } {
  const zoom = clampZoom(camera.zoom);
  const viewW = viewport.width / zoom;
  const viewH = viewport.height / zoom;

  let x = camera.x;
  let y = camera.y;

  if (viewW >= leash.maxX - leash.minX) {
    x = (leash.minX + leash.maxX) / 2 - viewW / 2;
  } else {
    x = clamp(x, leash.minX, leash.maxX - viewW);
  }

  if (viewH >= leash.maxY - leash.minY) {
    y = (leash.minY + leash.maxY) / 2 - viewH / 2;
  } else {
    y = clamp(y, leash.minY, leash.maxY - viewH);
  }

  return { x, y, zoom };
}
