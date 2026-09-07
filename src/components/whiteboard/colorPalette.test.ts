import { describe, expect, it } from "vitest";
import {
  colorsEqual,
  hexToHsv,
  hsvToHex,
  loadRecentColors,
  normalizeHex,
  pushRecentColor,
  rgbToHex,
} from "./colorPalette";

describe("colorPalette", () => {
  it("normalizes 3-digit and 6-digit hex", () => {
    expect(normalizeHex("f00")).toBe("#FF0000");
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("#4a86e3")).toBe("#4A86E3");
    expect(normalizeHex("not-a-color")).toBeNull();
  });

  it("round-trips hex through HSV", () => {
    expect(hsvToHex(hexToHsv("#FF0000")!)).toBe("#FF0000");
    expect(hsvToHex(hexToHsv("#00FF00")!)).toBe("#00FF00");
    expect(hsvToHex(hexToHsv("#0000FF")!)).toBe("#0000FF");
    expect(hsvToHex(hexToHsv("#FFFFFF")!)).toBe("#FFFFFF");
  });

  it("compares colors case-insensitively", () => {
    expect(colorsEqual("#ff0000", "#FF0000")).toBe(true);
    expect(colorsEqual("00f", "#0000FF")).toBe(true);
  });

  it("clamps rgb to hex", () => {
    expect(rgbToHex(300, -4, 16)).toBe("#FF0010");
  });

  it("stores recent colors with newest first and no duplicates", () => {
    expect(loadRecentColors()).toEqual([]);
    pushRecentColor("#FF0000");
    pushRecentColor("#00FF00");
    pushRecentColor("#ff0000");
    expect(loadRecentColors()).toEqual(["#FF0000", "#00FF00"]);
  });
});
