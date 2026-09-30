import assert from "node:assert/strict";
import test from "node:test";

import "dotenv/config";

import {
  DEFAULT_RETURN_CONDITION_NOTE,
  resolveReturnCondition,
} from "../lib/machine-return";

test("a blank condition box is recorded as the good-condition default", () => {
  // The box is optional. Leaving it empty is the ordinary case, not a missing
  // record, so it still produces a stored condition.
  for (const blank of [undefined, null, "", "   ", "\n\t "]) {
    assert.deepEqual(resolveReturnCondition(blank), {
      note: DEFAULT_RETURN_CONDITION_NOTE,
      hasIssue: false,
    });
  }
});

test("a typed condition is kept verbatim and flagged as an issue", () => {
  assert.deepEqual(resolveReturnCondition("Rear tyre flat, belt frayed"), {
    note: "Rear tyre flat, belt frayed",
    hasIssue: true,
  });
  // Trimmed, so surrounding whitespace never leaks into the report.
  assert.deepEqual(resolveReturnCondition("  Blades need sharpening  "), {
    note: "Blades need sharpening",
    hasIssue: true,
  });
});

test("the default wording is a single shared definition", () => {
  // The client prompt shows this string as placeholder text and the report
  // falls back to it; if the two ever read from different literals the
  // officer would be promised one wording and the report would show another.
  assert.equal(DEFAULT_RETURN_CONDITION_NOTE, "Returned in good condition");
  assert.equal(
    resolveReturnCondition("").note,
    DEFAULT_RETURN_CONDITION_NOTE,
  );
});
