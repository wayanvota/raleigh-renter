import test from "node:test";
import assert from "node:assert/strict";
import { isRaleighJurisdiction } from "../src/report.mjs";

test("recognizes Wake County's Raleigh jurisdiction code", () => {
  assert.equal(isRaleighJurisdiction("RA"), true);
  assert.equal(isRaleighJurisdiction("Raleigh"), true);
  assert.equal(isRaleighJurisdiction("ETJ"), false);
  assert.equal(isRaleighJurisdiction("Not listed"), false);
});
