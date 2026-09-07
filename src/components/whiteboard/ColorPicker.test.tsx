import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeAll } from "vitest";
import ColorPicker from "./ColorPicker";
import { GOOGLE_STANDARD_COLORS, GOOGLE_THEME_ACCENTS, GOOGLE_THEME_COLORS } from "./colorPalette";

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
});

describe("ColorPicker", () => {
  it("opens a Google-style palette with theme, standard, and custom colors", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker color="#000000" onChange={onChange} />);

    await user.click(screen.getByLabelText("Color picker"));
    const palette = await screen.findByLabelText("Color palette");
    expect(within(palette).getByLabelText("Theme colors")).toBeInTheDocument();
    expect(within(palette).getByLabelText("Standard colors")).toBeInTheDocument();

    const expected = GOOGLE_THEME_COLORS.length + GOOGLE_THEME_ACCENTS.length + GOOGLE_STANDARD_COLORS.flat().length;
    expect(within(palette).getAllByRole("button", { name: /Select color/i }).length).toBeGreaterThanOrEqual(expected);

    await user.click(within(palette).getByLabelText("Select color #FF0000"));
    expect(onChange).toHaveBeenCalledWith("#FF0000");
  });

  it("accepts a custom hex color", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker color="#000000" onChange={onChange} />);

    await user.click(screen.getByLabelText("Color picker"));
    await user.click(await screen.findByRole("button", { name: "Custom" }));
    const hex = await screen.findByLabelText("Hex color");
    await user.clear(hex);
    await user.type(hex, "1a73e8");
    expect(onChange).toHaveBeenCalledWith("#1A73E8");
  });
});
