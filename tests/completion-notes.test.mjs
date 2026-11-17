import { test } from "node:test";
import assert from "node:assert/strict";
import { requireCompletionNotes } from "../scripts/completion-notes.mjs";
for (const notes of [undefined, null, "", " \n\t ", 42]) test("shared completion gate rejects " + JSON.stringify(notes), () => {
  assert.throws(() => requireCompletionNotes(notes), error => error.code === "notes-required");
});
test("shared completion gate trims and limits service notes", () => {
  assert.equal(requireCompletionNotes("  Replaced filter and tested flow.  "), "Replaced filter and tested flow.");
  assert.throws(() => requireCompletionNotes("x".repeat(2001)), error => error.code === "invalid");
});
