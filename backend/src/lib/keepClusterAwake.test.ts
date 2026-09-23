import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { keepClusterAwake, type ClusterPing } from "./keepClusterAwake.ts";

function client(overrides: Partial<ClusterPing> = {}): ClusterPing & { calls: string[] } {
  const calls: string[] = [];
  return {
    uri: "mongodb://127.0.0.1:27017/collaboard",
    calls,
    connect: async () => {
      calls.push("connect");
    },
    ping: async () => {
      calls.push("ping");
      return { ok: 1 };
    },
    disconnect: async () => {
      calls.push("disconnect");
    },
    ...overrides,
  };
}

describe("keepClusterAwake", () => {
  it("connects, pings, and disconnects", async () => {
    const ping = client();
    await keepClusterAwake(ping);
    assert.deepEqual(ping.calls, ["connect", "ping", "disconnect"]);
  });

  it("refuses to run without a URI", async () => {
    await assert.rejects(
      () => keepClusterAwake(client({ uri: "  " })),
      /MONGODB_URI is not set/
    );
  });

  it("disconnects when the ping fails", async () => {
    const ping = client({
      ping: async () => ({ ok: 0 }),
    });
    await assert.rejects(() => keepClusterAwake(ping), /did not succeed/);
    assert.deepEqual(ping.calls, ["connect", "disconnect"]);
  });
});
