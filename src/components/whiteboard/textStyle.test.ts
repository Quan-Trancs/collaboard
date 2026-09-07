import { describe, expect, it } from "vitest";
import {
  TEXT_BOX_PADDING,
  clampFontSize,
  clampLineHeight,
  cssFont,
  cssTextDecoration,
  styleFromElement,
  textBoxContentWidth,
  textBoxMinHeight,
} from "./textStyle";

describe("textStyle", () => {
  it("clamps font size to 8–200 px", () => {
    expect(clampFontSize(4)).toBe(8);
    expect(clampFontSize(24.4)).toBe(24);
    expect(clampFontSize(400)).toBe(200);
    expect(clampFontSize(Number.NaN)).toBe(24);
  });

  it("reads Word-style fields from an element", () => {
    const style = styleFromElement({
      fontSize: 36,
      fontFamily: "Georgia",
      bold: true,
      italic: true,
      underline: true,
      strikethrough: true,
      align: "center",
      lineHeight: 1.5,
    });
    expect(style).toMatchObject({
      fontSize: 36,
      fontFamily: "Georgia",
      bold: true,
      italic: true,
      underline: true,
      strikethrough: true,
      align: "center",
      lineHeight: 1.5,
    });
    expect(cssFont(style)).toContain("italic");
    expect(cssFont(style)).toContain("700");
    expect(cssFont(style)).toContain("36px");
    expect(cssTextDecoration(style)).toBe("underline line-through");
  });

  it("clamps line spacing", () => {
    expect(clampLineHeight(0.5)).toBe(1);
    expect(clampLineHeight(4)).toBe(3);
  });

  it("sizes a text box with padding", () => {
    expect(textBoxContentWidth(320)).toBe(320 - TEXT_BOX_PADDING * 2);
    expect(textBoxMinHeight({
      fontSize: 24,
      fontFamily: "Inter",
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      align: "left",
      lineHeight: 1.25,
    })).toBeGreaterThanOrEqual(24 * 1.25 + TEXT_BOX_PADDING * 2);
  });
});
