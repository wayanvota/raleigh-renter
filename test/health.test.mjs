import test from "node:test";
import assert from "node:assert/strict";
import { createDatabaseMonitor } from "../src/health.mjs";
import { createApp } from "../src/server.mjs";

const DAY_MS = 86_400_000;

test("background checks wait 24 hours, including after failure", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  let calls = 0;
  const monitor = createDatabaseMonitor(async () => {
    calls += 1;
    if (calls === 1) throw new Error("private connection details");
    return { ok: true, mode: "neon" };
  });
  await monitor.start();
  assert.equal(calls, 1);
  assert.equal(monitor.snapshot().ok, false);
  assert.equal(JSON.stringify(monitor.snapshot()).includes("private"), false);
  t.mock.timers.tick(DAY_MS - 1);
  assert.equal(calls, 1);
  t.mock.timers.tick(1);
  await new Promise(setImmediate);
  assert.equal(calls, 2);
  assert.equal(monitor.snapshot().ok, true);
  monitor.stop();
  t.mock.timers.tick(DAY_MS);
  assert.equal(calls, 2);
});

test("frequent health and diagnostic requests never query the database", async (t) => {
  let calls = 0;
  const app = createApp({ checkDatabaseFn: async () => {
    calls += 1;
    throw new Error("database offline");
  } });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  t.after(async () => {
    app.locals.databaseMonitor.stop();
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    assert.equal((await fetch(`${base}/healthz/database`)).status, 503);
  }
  assert.equal(calls, 0);
  await app.locals.databaseMonitor.start();
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    const response = await fetch(`${base}/healthz/database`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).ok, false);
  }
  assert.equal(calls, 1);
});
