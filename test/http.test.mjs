import test, { after, before } from "node:test";
import assert from "node:assert/strict";

process.env.ALLOWED_ORIGINS = "http://localhost:3000,https://wayan.com";
process.env.REQUEST_LIMIT = "2";
process.env.REQUEST_WINDOW_MS = "60000";
process.env.DATABASE_URL = "";
process.env.OPENAI_API_KEY = "";

const { app } = await import(`../src/server.mjs?test=${Date.now()}`);
let server;
let base;

before(async () => {
  server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("serves the homepage and health contract with security headers", async () => {
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type"), /text\/html/);
  assert.match(await home.text(), /Raleigh Renter Records/);
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  assert.equal(home.headers.get("x-frame-options"), "SAMEORIGIN");

  const health = await fetch(`${base}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    ok: true,
    service: "raleigh-renter",
    database: { ok: true, mode: "disabled" },
    aiConfigured: false,
  });
});

test("returns controlled API routing and method errors", async () => {
  const unknown = await fetch(`${base}/api/does-not-exist`);
  assert.equal(unknown.status, 404);
  assert.match(unknown.headers.get("content-type"), /application\/json/);
  assert.equal((await unknown.json()).code, "NOT_FOUND");

  const wrongMethod = await fetch(`${base}/api/report`);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("allow"), "POST");
  assert.equal((await wrongMethod.json()).code, "METHOD_NOT_ALLOWED");

  const page = await fetch(`${base}/unknown-page`);
  assert.equal(page.status, 404);
  assert.match(await page.text(), /Page not found/);

  const traversal = await fetch(`${base}/..%2f..%2f.env.local`);
  assert.equal(traversal.status, 404);
  assert.equal((await traversal.text()).includes("OPENAI_API_KEY"), false);
});

test("returns controlled boundary errors for malformed and oversized JSON", async () => {
  const malformed = await fetch(`${base}/api/report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{broken",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).code, "INVALID_JSON");

  const oversized = await fetch(`${base}/api/report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: `1 Main ${"x".repeat(13_000)}` }),
  });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).code, "PAYLOAD_TOO_LARGE");
});

test("validates report bodies without reflecting attack strings", async () => {
  const payloads = [
    {},
    { address: "x" },
    { address: "123 Main Street", extra: "unexpected" },
    { address: "<script>alert(1)</script>" },
    { address: "123 Main Street'; DROP TABLE report_cache;--" },
    { address: "１２３ Main Street" },
  ];
  for (const payload of payloads) {
    const response = await fetch(`${base}/api/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.ok([400, 422, 429].includes(response.status));
    const body = await response.json();
    assert.equal(JSON.stringify(body).includes("<script>"), false);
    assert.equal(JSON.stringify(body).includes("DROP TABLE"), false);
  }
});

test("enforces trusted CORS origins", async () => {
  const trusted = await fetch(`${base}/api/sources`, { headers: { origin: "https://wayan.com" } });
  assert.equal(trusted.status, 200);
  assert.equal(trusted.headers.get("access-control-allow-origin"), "https://wayan.com");

  const hostile = await fetch(`${base}/api/sources`, { headers: { origin: "https://attacker.example" } });
  assert.equal(hostile.status, 403);
  assert.equal(hostile.headers.get("access-control-allow-origin"), null);
  assert.equal((await hostile.json()).code, "ORIGIN_NOT_ALLOWED");
});

test("rate limits repeated expensive report requests", async () => {
  const request = () => fetch(`${base}/api/report`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify({ address: "x" }),
  });
  assert.equal((await request()).status, 400);
  assert.equal((await request()).status, 400);
  const limited = await request();
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
});
