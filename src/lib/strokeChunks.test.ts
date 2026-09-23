import { describe, expect, it } from "vitest";
import {
  MAX_STROKE_POINTS,
  appendStrokePoint,
  expandInkElements,
  splitInkElement,
  splitStrokePoints,
  strokeChunkId,
} from "./strokeChunks";

function points(count: number) {
  return Array.from({ length: count }, (_, index) => ({ x: index, y: index }));
}

describe("strokeChunks", () => {
  it("keeps short strokes as a single piece", () => {
    const short = points(10);
    expect(splitStrokePoints(short)).toEqual([short]);
    expect(splitInkElement({ id: "ink-1", points: short, x: 0, y: 0 })).toEqual([
      { id: "ink-1", points: short, x: 0, y: 0 },
    ]);
  });

  it("splits on the max with a one-point overlap so pieces join", () => {
    const long = points(MAX_STROKE_POINTS + 2);
    const chunks = splitStrokePoints(long);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(MAX_STROKE_POINTS);
    expect(chunks[1][0]).toEqual(chunks[0][chunks[0].length - 1]);
    expect(chunks[1]).toHaveLength(3);
  });

  it("keeps the original id on the first chunk", () => {
    const pieces = splitInkElement({ id: "ink-1", points: points(MAX_STROKE_POINTS + 1), x: 0, y: 0 });
    expect(pieces[0].id).toBe("ink-1");
    expect(pieces[1].id).toBe(strokeChunkId("ink-1", 1));
    expect(pieces[1].x).toBe(pieces[0].points![pieces[0].points!.length - 1].x);
  });

  it("starts a new live stroke when appending past the cap", () => {
    const current = { id: "ink-1", x: 0, y: 0, points: points(MAX_STROKE_POINTS) };
    const { current: sealed, next } = appendStrokePoint(current, { x: 999, y: 999 }, "ink-2");
    expect(sealed.points).toHaveLength(MAX_STROKE_POINTS);
    expect(next?.id).toBe("ink-2");
    expect(next?.points).toEqual([
      sealed.points![sealed.points!.length - 1],
      { x: 999, y: 999 },
    ]);
  });

  it("does not split shapes when expanding a mixed list", () => {
    const items = expandInkElements([
      { id: "shape-1", type: "shape", x: 1, y: 2 },
      { id: "ink-1", type: "pen", x: 0, y: 0, points: points(MAX_STROKE_POINTS + 1) },
    ]);
    expect(items[0].id).toBe("shape-1");
    expect(items).toHaveLength(3);
  });
});
