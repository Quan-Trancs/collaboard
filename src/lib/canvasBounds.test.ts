import { describe, expect, it } from "vitest";
import {
  HARD_WORLD_MAX,
  boundsFromItems,
  clampPointToHardWorld,
  clampZoom,
  contentLeash,
  emptyWorkspaceRect,
  isInHardWorld,
} from "./canvasBounds";

describe("canvas bounds", () => {
  it("rejects coordinates outside the hard world", () => {
    expect(isInHardWorld(0, 0)).toBe(true);
    expect(isInHardWorld(HARD_WORLD_MAX + 1, 0)).toBe(false);
    expect(clampPointToHardWorld({ x: 999999, y: 10 })).toEqual({
      x: HARD_WORLD_MAX,
      y: 10,
    });
  });

  it("clamps zoom to 10%–400%", () => {
    expect(clampZoom(0.01)).toBe(0.1);
    expect(clampZoom(8)).toBe(4);
    expect(clampZoom(1.2)).toBe(1.2);
  });

  it("starts empty boards in a 4000x4000 workspace", () => {
    const empty = emptyWorkspaceRect();
    expect(empty.maxX - empty.minX).toBe(4000);
    expect(empty.maxY - empty.minY).toBe(4000);
  });

  it("grows the leash around existing content", () => {
    const content = boundsFromItems([{ x: 0, y: 0, width: 100, height: 50 }]);
    const leash = contentLeash(content);
    expect(leash.minX).toBeLessThan(0);
    expect(leash.maxX).toBeGreaterThan(100);
  });
});
