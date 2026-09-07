import { describe, expect, it } from "vitest";
import {
  createBoardSchema,
  insertChartSchema,
  insertTemplateSchema,
  updateBoardSchema,
  elementDataSchema,
} from "./validation";

describe("validation schemas", () => {
  it("accepts board titles up to 200 characters", () => {
    const title = "Q".repeat(200);
    expect(createBoardSchema.parse({ title }).title).toBe(title);
    expect(updateBoardSchema.parse({ title }).title).toBe(title);
    expect(createBoardSchema.safeParse({ title: "Q".repeat(201) }).success).toBe(false);
  });

  it("accepts the chart and template types the insert panel sends", () => {
    expect(insertChartSchema.parse({ type: "barChart" }).type).toBe("barChart");
    expect(insertChartSchema.parse({ type: "pieChart" }).type).toBe("pieChart");
    expect(insertChartSchema.safeParse({ type: "bar" }).success).toBe(false);

    expect(insertTemplateSchema.parse({ type: "twoColumn" }).type).toBe("twoColumn");
    expect(insertTemplateSchema.parse({ type: "comparison" }).type).toBe("comparison");
    expect(insertTemplateSchema.safeParse({ type: "woColumn" }).success).toBe(false);
  });

  it("allows transparent fill colors", () => {
    expect(elementDataSchema.parse({ color: "#112233", strokeWidth: 2, fillColor: "transparent" }).fillColor).toBe(
      "transparent"
    );
    expect(elementDataSchema.parse({ color: "#112233", strokeWidth: 2, fillColor: "#abcdef" }).fillColor).toBe(
      "#abcdef"
    );
  });
});
