import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redoAppliedPayload, undoAppliedPayload } from "./historyEvents.ts";

const stroke = { id: "s1", type: "pen" };
const counts = { canUndo: true, canRedo: true };

describe("historyEvents", () => {
  it("undo of add deletes the live item", () => {
    const payload = undoAppliedPayload({ action: "add", element: stroke }, "u1", counts);
    assert.equal(payload.action, "delete");
    assert.equal(payload.elementId, "s1");
    assert.equal(payload.canRedo, true);
  });

  it("redo of add restores the live item", () => {
    const payload = redoAppliedPayload({ action: "add", element: stroke }, "u1", counts);
    assert.equal(payload.action, "add");
    assert.equal(payload.element?.id, "s1");
  });

  it("undo of delete restores, redo of delete removes again", () => {
    const undone = undoAppliedPayload({ action: "delete", element: stroke }, "u1", counts);
    const redone = redoAppliedPayload({ action: "delete", element: stroke }, "u1", counts);
    assert.equal(undone.action, "add");
    assert.equal(redone.action, "delete");
    assert.equal(redone.elementId, "s1");
  });
});
