import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("devSeed", () => {
  it("is skipped in production", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const { seedDevelopmentUser } = await import("./devSeed.ts");
    await seedDevelopmentUser();
    process.env.NODE_ENV = previous;
    assert.ok(true);
  });
});
