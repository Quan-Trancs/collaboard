export const HARD_WORLD_MIN = -32000;
export const HARD_WORLD_MAX = 32000;

export function isInHardWorld(x: number, y: number): boolean {
  return (
    typeof x === 'number' &&
    typeof y === 'number' &&
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= HARD_WORLD_MIN &&
    x <= HARD_WORLD_MAX &&
    y >= HARD_WORLD_MIN &&
    y <= HARD_WORLD_MAX
  );
}

export function assertPointsInHardWorld(
  points: Array<{ x: number; y: number }>
): boolean {
  return points.every((point) => isInHardWorld(point.x, point.y));
}
