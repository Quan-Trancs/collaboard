import { describe, expect, it } from "vitest";
import { SHAPE_IDS, SHAPES, getShape, shapesInGroup } from "./shapes";

describe("shapes", () => {
  it("defines a Google Slides-sized catalog with unique ids", () => {
    expect(SHAPES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(SHAPE_IDS).size).toBe(SHAPE_IDS.length);
    expect(SHAPE_IDS).toContain("hexagon");
    expect(SHAPE_IDS).toContain("rightArrow");
    expect(SHAPE_IDS).toContain("speech");
    expect(SHAPE_IDS).toContain("cylinder");
  });

  it("gives every shape drawable primitives", () => {
    for (const shape of SHAPES) {
      expect(shape.primitives.length).toBeGreaterThan(0);
      for (const primitive of shape.primitives) {
        if (primitive.kind === "path") {
          expect(primitive.d.startsWith("M")).toBe(true);
        } else {
          expect(primitive.rx).toBeGreaterThan(0);
          expect(primitive.ry).toBeGreaterThan(0);
        }
      }
    }
  });

  it("aliases legacy arrow inserts to the right arrow", () => {
    expect(getShape("arrow").id).toBe("rightArrow");
    expect(getShape("unknown").id).toBe("rectangle");
  });

  it("groups shapes for the insert gallery", () => {
    expect(shapesInGroup("basic").length).toBeGreaterThan(10);
    expect(shapesInGroup("arrows").map((shape) => shape.id)).toContain("bentArrow");
  });
});
