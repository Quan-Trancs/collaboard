import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import InsertPanel from "./InsertPanel";
import { SHAPES } from "./shapes";

function renderPanel(onInsert = vi.fn()) {
  render(
    <TooltipProvider>
      <InsertPanel onInsert={onInsert} />
    </TooltipProvider>
  );
  return onInsert;
}

describe("InsertPanel", () => {
  it("offers a full shape gallery and inserts the chosen shape", async () => {
    const user = userEvent.setup();
    const onInsert = renderPanel();

    await user.click(screen.getByLabelText("Insert elements"));
    expect(await screen.findByLabelText("Shape gallery")).toBeInTheDocument();
    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("Arrows")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Insert / }).length).toBe(SHAPES.length);

    await user.click(screen.getByLabelText("Insert Hexagon"));
    expect(onInsert).toHaveBeenCalledWith("shape", { type: "hexagon" });
  });

  it("inserts a bar chart with a type the canvas renderer understands", async () => {
    const user = userEvent.setup();
    const onInsert = renderPanel();

    await user.click(screen.getByLabelText("Insert elements"));
    await user.click(screen.getByRole("tab", { name: "Charts" }));
    await user.click(screen.getByRole("button", { name: /Bar Chart/ }));
    expect(onInsert).toHaveBeenCalledWith("chart", { type: "barChart" });
  });

  it("inserts a table using the selected row and column counts", async () => {
    const user = userEvent.setup();
    const onInsert = renderPanel();

    await user.click(screen.getByLabelText("Insert elements"));
    await user.click(screen.getByRole("tab", { name: "Tables" }));
    await user.click(screen.getByLabelText("Table rows"));
    await user.click(screen.getByRole("option", { name: "5" }));
    await user.click(screen.getByLabelText("Table columns"));
    await user.click(screen.getByRole("option", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "Insert Table" }));
    expect(onInsert).toHaveBeenCalledWith("table", { rows: 5, cols: 4 });
  });

  it("inserts a lucide icon by id", async () => {
    const user = userEvent.setup();
    const onInsert = renderPanel();

    await user.click(screen.getByLabelText("Insert elements"));
    await user.click(screen.getByRole("tab", { name: "Icons" }));
    await user.click(screen.getByLabelText("Insert Rocket icon"));
    expect(onInsert).toHaveBeenCalledWith("icon", { symbol: "rocket" });
  });

  it("inserts two-column and comparison templates", async () => {
    const user = userEvent.setup();
    const onInsert = renderPanel();

    await user.click(screen.getByLabelText("Insert elements"));
    await user.click(screen.getByRole("tab", { name: "Templates" }));
    await user.click(screen.getByRole("button", { name: /Two Column/ }));
    expect(onInsert).toHaveBeenCalledWith("template", { type: "twoColumn" });

    await user.click(screen.getByLabelText("Insert elements"));
    await user.click(screen.getByRole("tab", { name: "Templates" }));
    await user.click(screen.getByRole("button", { name: /Comparison/ }));
    expect(onInsert).toHaveBeenCalledWith("template", { type: "comparison" });
  });
});
