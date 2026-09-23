import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHAT_MAX_LENGTH, normalizeChatText, normalizeClientId } from "./chat.ts";

describe("chat text", () => {
  it("trims a message and keeps the words", () => {
    const result = normalizeChatText("  hello board  ");
    assert.deepEqual(result, { text: "hello board" });
  });

  it("rejects an empty message", () => {
    const result = normalizeChatText("   ");
    assert.deepEqual(result, { error: "Message is empty" });
  });

  it("rejects a message past the length limit", () => {
    const result = normalizeChatText("a".repeat(CHAT_MAX_LENGTH + 1));
    assert.equal("error" in result, true);
  });

  it("accepts a client id and drops anything else", () => {
    assert.equal(normalizeClientId("abc-1234-def"), "abc-1234-def");
    assert.equal(normalizeClientId("short"), undefined);
    assert.equal(normalizeClientId(12), undefined);
  });
});
