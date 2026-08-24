import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAddressInput } from "../src/address.mjs";

test("normalizes a full Raleigh address", () => {
  assert.deepEqual(normalizeAddressInput("222 W Hargett Street, Raleigh, NC 27601"), {
    number: 222,
    prefix: "W",
    name: "HARGETT",
    suffix: "ST",
  });
});

test("accepts an address without a street suffix", () => {
  assert.deepEqual(normalizeAddressInput("222 W Hargett"), {
    number: 222,
    prefix: "W",
    name: "HARGETT",
    suffix: null,
  });
});

test("rejects input without a house number", () => {
  assert.throws(() => normalizeAddressInput("Hargett Street"), /house number/);
});

test("removes a unit number before matching the parcel address", () => {
  assert.deepEqual(normalizeAddressInput("123 Main Street # 4, Raleigh NC"), {
    number: 123,
    prefix: null,
    name: "MAIN",
    suffix: "ST",
  });
});

test("handles whitespace and Unicode street text without widening the house-number rule", () => {
  assert.deepEqual(normalizeAddressInput("  123   José   Road  "), {
    number: 123,
    prefix: null,
    name: "JOSÉ",
    suffix: "RD",
  });
  assert.throws(() => normalizeAddressInput("１２３ Main Street"), /house number/);
});
