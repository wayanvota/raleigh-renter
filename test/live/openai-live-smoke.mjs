import assert from "node:assert/strict";
import { buildReport } from "../../src/report.mjs";

assert.ok(process.env.OPENAI_API_KEY, "OPENAI_API_KEY is required for the live OpenAI smoke test.");

const report = await buildReport("222 W Hargett Street");
assert.equal(report.property?.inRaleighJurisdiction, true, "The official address did not resolve within Raleigh jurisdiction.");
assert.ok(report.findings?.length > 0, "Official data adapters returned no report findings.");
assert.equal(report.summaryMode, "openai", "OpenAI synthesis did not pass the evidence-ID boundary.");
assert.ok(report.summary?.overview?.length >= 2, "OpenAI synthesis returned an incomplete overview.");

console.log(`Raleigh Renter live smoke passed: ${report.findings.length} findings with evidence-gated OpenAI synthesis.`);
