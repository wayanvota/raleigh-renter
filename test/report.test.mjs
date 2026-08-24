import test from "node:test";
import assert from "node:assert/strict";
import { isRaleighJurisdiction, normalizeCachedReport } from "../src/report.mjs";

test("recognizes Wake County's Raleigh jurisdiction code", () => {
  assert.equal(isRaleighJurisdiction("RA"), true);
  assert.equal(isRaleighJurisdiction("Raleigh"), true);
  assert.equal(isRaleighJurisdiction("ETJ"), false);
  assert.equal(isRaleighJurisdiction("Not listed"), false);
});

test("normalizes corrected jurisdiction and citations in older cached reports", () => {
  const oldPoliceUrl = "https://raleighnc.gov/apps-maps-and-open-data/services/raleighs-crime-data";
  const cached = {
    property: { jurisdiction: "RA", inRaleighJurisdiction: false },
    findings: [{ sourceId: "police-incidents", sourceUrl: oldPoliceUrl }],
    sources: [{ id: "police-incidents", url: oldPoliceUrl }],
  };

  const normalized = normalizeCachedReport(cached);

  assert.equal(normalized.property.inRaleighJurisdiction, true);
  assert.equal(normalized.findings[0].sourceUrl, "https://raleighnc.gov/police/services/raleighs-crime-data");
  assert.equal(normalized.sources[0].url, "https://raleighnc.gov/police/services/raleighs-crime-data");
  assert.equal(cached.property.inRaleighJurisdiction, false);
});
