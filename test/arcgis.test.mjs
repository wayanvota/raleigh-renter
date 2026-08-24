import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { arcgisQuery, escapeSqlLiteral } from "../src/arcgis.mjs";

test("escapes SQL literals used in fixed ArcGIS queries", () => {
  assert.equal(escapeSqlLiteral("O'BRIEN'; DROP TABLE x;--"), "O''BRIEN''; DROP TABLE x;--");
});

test("rejects a malformed upstream response without treating it as records", async () => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("not-json");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await assert.rejects(() => arcgisQuery(`http://127.0.0.1:${port}/query`, { where: "1=1" }), SyntaxError);
  await new Promise((resolve) => server.close(resolve));
});

test("times out an unavailable upstream source", async () => {
  const server = http.createServer(() => {});
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await assert.rejects(() => arcgisQuery(`http://127.0.0.1:${port}/query`, {}, { timeoutMs: 30 }), /aborted|timeout/i);
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});
