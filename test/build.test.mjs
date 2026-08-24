import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("production frontend build rejects unsafe or missing API origins", () => {
  for (const value of ["", "http://example.com", "https://example.com/path", "javascript:alert(1)"]) {
    const result = spawnSync(process.execPath, ["scripts/build-wayan.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, PUBLIC_API_BASE: value },
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Set PUBLIC_API_BASE/);
  }
});
