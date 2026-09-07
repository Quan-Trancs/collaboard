import { describe, expect, it, vi } from "vitest";
import {
  compactElementPatch,
  createThrottle,
  interpolateCursors,
  lerpCursor,
} from "./livePresence";

describe("livePresence", () => {
  it("drops undefined fields from a patch", () => {
    expect(compactElementPatch({ x: 10, y: 20, points: undefined, text: "Hi" })).toEqual({
      x: 10,
      y: 20,
      text: "Hi",
    });
  });

  it("throttles bursts and still sends the latest value", () => {
    vi.useFakeTimers();
    const sent: number[] = [];
    const throttle = createThrottle(50);
    throttle.schedule(() => sent.push(1));
    throttle.schedule(() => sent.push(2));
    throttle.schedule(() => sent.push(3));
    expect(sent).toEqual([1]);
    vi.advanceTimersByTime(50);
    expect(sent).toEqual([1, 3]);
    vi.useRealTimers();
  });

  it("interpolates remote cursors toward their targets", () => {
    const current = new Map([["a", { x: 0, y: 0, name: "Ada", color: "#000" }]]);
    const targets = new Map([["a", { x: 100, y: 50, name: "Ada", color: "#000" }]]);
    const next = interpolateCursors(current, targets, 0.5);
    expect(next.get("a")).toMatchObject({ x: 50, y: 25 });
    expect(lerpCursor({ x: 0, y: 0, name: "A", color: "#f00" }, { x: 10, y: 0, name: "A", color: "#f00" }, 1)).toMatchObject({
      x: 10,
      y: 0,
    });
  });
});
