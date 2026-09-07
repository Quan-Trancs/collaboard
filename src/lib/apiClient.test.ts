import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, clearCache } from "./apiClient";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiClient cache", () => {
  afterEach(() => {
    clearCache();
    localStorage.clear();
  });

  it("does not reuse one user's board list for another user", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ id: "board-a" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: "board-b" }]));
    vi.stubGlobal("fetch", fetchMock);

    localStorage.setItem("auth_token", "token-user-a");
    await expect(apiRequest("/boards", { useCache: true, retries: 0 })).resolves.toEqual([
      { id: "board-a" },
    ]);

    localStorage.setItem("auth_token", "token-user-b");
    await expect(apiRequest("/boards", { useCache: true, retries: 0 })).resolves.toEqual([
      { id: "board-b" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("drops in-flight cache writes after a full clear", async () => {
    let finishFirst: (value: Response) => void = () => {};
    const first = new Promise<Response>((resolve) => {
      finishFirst = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(jsonResponse([{ id: "fresh" }]));
    vi.stubGlobal("fetch", fetchMock);

    localStorage.setItem("auth_token", "token-user-a");
    const pending = apiRequest("/boards", { useCache: true, retries: 0 });
    clearCache();
    finishFirst(jsonResponse([{ id: "stale" }]));
    await expect(pending).resolves.toEqual([{ id: "stale" }]);

    await expect(apiRequest("/boards", { useCache: true, retries: 0 })).resolves.toEqual([
      { id: "fresh" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
