import test from "node:test";
import assert from "node:assert/strict";
import { hasCompletionEvidence } from "../src/sources.mjs";

test("does not treat a negative completion flag as evidence of completion", () => {
  assert.equal(hasCompletionEvidence({ constcompletedofficial: "No" }), false);
  assert.equal(hasCompletionEvidence({ constcompletedofficial: "Yes" }), true);
  assert.equal(hasCompletionEvidence({ coissueddate: 1700000000000 }), true);
});
