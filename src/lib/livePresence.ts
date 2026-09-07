export const CURSOR_INTERVAL_MS = 50;
export const PREVIEW_INTERVAL_MS = 50;
export const CURSOR_LERP = 0.28;
export const CURSOR_SNAP = 0.5;

export type CursorPresence = {
  x: number;
  y: number;
  name: string;
  color: string;
};

export function compactElementPatch(updates: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) patch[key] = value;
  }
  return patch;
}

export function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

export function lerpCursor(from: CursorPresence, to: CursorPresence, amount = CURSOR_LERP): CursorPresence {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) < CURSOR_SNAP && Math.abs(dy) < CURSOR_SNAP) {
    return { ...to, x: to.x, y: to.y };
  }
  return {
    ...to,
    x: lerp(from.x, to.x, amount),
    y: lerp(from.y, to.y, amount),
  };
}

export function interpolateCursors(
  current: Map<string, CursorPresence>,
  targets: Map<string, CursorPresence>,
  amount = CURSOR_LERP
) {
  if (current.size === 0 && targets.size === 0) return current;
  const next = new Map<string, CursorPresence>();
  let changed = current.size !== targets.size;
  targets.forEach((target, id) => {
    const previous = current.get(id);
    const value = previous ? lerpCursor(previous, target, amount) : target;
    next.set(id, value);
    if (
      !previous ||
      previous.x !== value.x ||
      previous.y !== value.y ||
      previous.name !== value.name ||
      previous.color !== value.color
    ) {
      changed = true;
    }
  });
  return changed ? next : current;
}

export function createThrottle(intervalMs: number) {
  let lastSent = -intervalMs;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: (() => void) | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending) return;
    const run = pending;
    pending = null;
    lastSent = Date.now();
    run();
  };

  const schedule = (send: () => void) => {
    pending = send;
    const elapsed = Date.now() - lastSent;
    if (elapsed >= intervalMs) {
      flush();
      return;
    }
    if (timer) return;
    timer = setTimeout(flush, intervalMs - elapsed);
  };

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  };

  return { schedule, flush, cancel };
}
