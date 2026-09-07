import { describe, expect, it } from "vitest";
import {
  CLIPBOARD_KIND,
  cloneElements,
  fitImageSize,
  isImageFile,
  parseClipboardText,
  serializeElements,
  toDrawingElements,
} from "./boardClipboard";

describe("boardClipboard", () => {
  it("clones elements with a new id and offset", () => {
    const [copy] = cloneElements(
      [{ id: "a", type: "shape", x: 10, y: 20, color: "#000000", strokeWidth: 1, points: [{ x: 10, y: 20 }] }],
      24
    );
    expect(copy.id).not.toBe("a");
    expect(copy.x).toBe(34);
    expect(copy.y).toBe(44);
    expect(copy.points).toEqual([{ x: 34, y: 44 }]);
  });

  it("round-trips copied elements through the clipboard payload", () => {
    const payload = serializeElements([{ id: "shape-1", type: "shape", x: 0, y: 0, color: "#000000", strokeWidth: 1 }]);
    expect(payload).toContain(CLIPBOARD_KIND);
    const parsed = parseClipboardText(payload);
    expect(parsed).toEqual([{ id: "shape-1", type: "shape", x: 0, y: 0, color: "#000000", strokeWidth: 1 }]);
    expect(parseClipboardText("not json")).toBeNull();
    expect(parseClipboardText("hello")).toBeNull();
    expect(toDrawingElements([{ id: "shape-1", type: "shape", x: 0, y: 0 }])[0]).toMatchObject({
      color: "#000000",
      strokeWidth: 1,
    });
  });

  it("fits images to the max edge and detects image files", () => {
    expect(fitImageSize(1200, 600)).toEqual({ width: 480, height: 240 });
    expect(isImageFile(new File(["x"], "photo.png", { type: "image/png" }))).toBe(true);
    expect(isImageFile(new File(["x"], "notes.txt", { type: "text/plain" }))).toBe(false);
  });
});
