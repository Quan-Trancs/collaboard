import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_STROKE_POINTS, splitInkElement, splitStrokePoints, strokeChunkId } from "./strokeChunks.ts";

function points(count: number) {
  return Array.from({ length: count }, (_, index) => ({ x: index, y: index }));
}

describe("strokeChunks", () => {
  it("keeps short strokes as a single piece", () => {
    const short = points(8);
    assert.deepEqual(splitStrokePoints(short), [short]);
  });

  it("overlaps adjacent pieces by one point", () => {
    const chunks = splitStrokePoints(points(MAX_STROKE_POINTS + 2));
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].length, MAX_STROKE_POINTS);
    assert.deepEqual(chunks[1][0], chunks[0][chunks[0].length - 1]);
  });

  it("keeps the original id on chunk 0", () => {
    const pieces = splitInkElement({
      id: "ink-1",
      type: "drawing",
      points: points(MAX_STROKE_POINTS + 1),
    });
    assert.equal(pieces[0].id, "ink-1");
    assert.equal(pieces[1].id, strokeChunkId("ink-1", 1));
  });
});
