import { describe, expect, it } from "vitest";
import { DEV_LOGIN, IS_DEV_APP } from "./devMode";

describe("devMode", () => {
  it("keeps the demo login in one place", () => {
    expect(DEV_LOGIN.email).toBe("slide@example.com");
    expect(DEV_LOGIN.password.length).toBeGreaterThanOrEqual(6);
    expect(IS_DEV_APP).toBe(false);
  });
});
