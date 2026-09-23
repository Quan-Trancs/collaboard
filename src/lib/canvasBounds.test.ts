import { describe, expect, it } from "vitest";
import {
  HARD_WORLD_MAX,
  boundsFromItems,
  clampCameraPan,
  clampPointToHardWorld,
  clampZoom,
  CONTENT_LEASH_PADDING,
  contentLeash,
  emptyWorkspaceRect,
  fitCameraToContent,
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

  it("pads an empty workspace so the default camera can pan", () => {
    const empty = emptyWorkspaceRect();
    const leash = contentLeash(null);
    expect(leash.minX).toBe(empty.minX - CONTENT_LEASH_PADDING);
    expect(leash.maxX).toBe(empty.maxX + CONTENT_LEASH_PADDING);
  });

  it("still allows panning when the view is larger than the leash", () => {
    const leash = { minX: -100, minY: -100, maxX: 100, maxY: 100 };
    const zoomedOut = clampCameraPan(
      { x: -400, y: -50, zoom: 1 },
      { width: 800, height: 200 },
      leash
    );
    expect(zoomedOut.x).toBe(-400);
    expect(zoomedOut.y).toBe(-100);
  });

  it("opens empty boards at 100% and fits existing content", () => {
    const viewport = { width: 800, height: 600 };
    const empty = fitCameraToContent(null, viewport);
    expect(empty.zoom).toBe(1);

    const fitted = fitCameraToContent(
      { minX: 0, minY: 0, maxX: 2000, maxY: 1500 },
      viewport
    );
    expect(fitted.zoom).toBeLessThan(1);
    expect(fitted.x).toBeLessThanOrEqual(0);
    expect(fitted.x + 800 / fitted.zoom).toBeGreaterThanOrEqual(2000);
    expect(fitted.y).toBeLessThanOrEqual(0);
    expect(fitted.y + 600 / fitted.zoom).toBeGreaterThanOrEqual(1500);
  });
});
