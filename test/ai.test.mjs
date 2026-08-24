import test from "node:test";
import assert from "node:assert/strict";
import { fallbackSummary } from "../src/ai.mjs";

test("fallback summary does not turn complaints into violations", () => {
  const summary = fallbackSummary({
    findings: [
      { id: "request-1", classification: "complaint_or_request", sourceId: "ask-raleigh", title: "Unsafe Housing Conditions" },
      { id: "permit-1", classification: "permit_record", sourceId: "building-permits", title: "Alteration" },
      { id: "flood-1", classification: "environmental_context", sourceId: "flood-hazard", title: "No flood-hazard polygon matched" },
    ],
  });
  const prose = JSON.stringify(summary);
  assert.match(prose, /not confirmed violations/i);
  assert.doesNotMatch(prose, /property is safe/i);
  assert.deepEqual(summary.overview[0].evidenceIds, ["request-1"]);
});
