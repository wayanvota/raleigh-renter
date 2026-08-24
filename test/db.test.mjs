import test from "node:test";
import assert from "node:assert/strict";
import { cacheKey } from "../src/db.mjs";

test("cache keys are deterministic one-way hashes rather than raw addresses", () => {
  const address = "123 Main Street";
  const key = cacheKey(address);
  assert.equal(key, cacheKey(address.toLowerCase()));
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(key.includes("123"), false);
  assert.equal(key.includes("MAIN"), false);
});
