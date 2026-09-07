import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serializePerson } from "./boardAccess.ts";

describe("serializePerson", () => {
  it("normalizes a missing avatar to null", () => {
    const person = serializePerson(
      { _id: { toString: () => "user-1" }, name: "Ada", email: "ada@example.com" },
      "edit"
    );
    assert.equal(person.id, "user-1");
    assert.equal(person.name, "Ada");
    assert.equal(person.avatar_url, null);
    assert.equal(person.permission, "edit");
  });
});
