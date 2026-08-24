import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { JSDOM } from "jsdom";

const html = (await fs.readFile(new URL("../public/index.html", import.meta.url), "utf8"))
  .replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
  .replaceAll(/<script[^>]*><\/script>/gi, "");

test("form validation and server errors remain usable", async () => {
  const { window, cleanup } = await loadUi(async () => ({
    ok: false,
    json: async () => ({ error: "No matching Raleigh address was found." }),
  }));
  const form = window.document.querySelector("#search-form");
  const input = window.document.querySelector("#address");

  input.value = "x";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  assert.match(window.document.querySelector("#form-status").textContent, /complete Raleigh street address/i);

  input.value = "99999 Missing Street";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  assert.match(window.document.querySelector("#form-status").textContent, /No matching Raleigh address/);
  assert.equal(input.disabled, false);
  assert.equal(window.document.querySelector("button[type=submit]").disabled, false);
  cleanup();
});

test("renders untrusted API and AI text as text rather than executable HTML", async () => {
  const marker = `<img src=x onerror="globalThis.__xss=1"><script>globalThis.__xss=2</script>`;
  const { window, cleanup } = await loadUi(async () => ({ ok: true, json: async () => fakeReport(marker) }));
  const input = window.document.querySelector("#address");
  input.value = "123 Main Street";
  window.document.querySelector("#search-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();

  const report = window.document.querySelector("#report");
  assert.equal(report.hidden, false);
  assert.match(window.document.querySelector("#summary-headline").textContent, /<img/);
  assert.equal(report.querySelector("script"), null);
  assert.equal(report.querySelector("img"), null);
  assert.equal(window.__xss, undefined);
  cleanup();
});

test("record filters update pressed state and visible cards", async () => {
  const { window, cleanup } = await loadUi(async () => ({ ok: true, json: async () => fakeReport("Grounded summary") }));
  const input = window.document.querySelector("#address");
  input.value = "123 Main Street";
  window.document.querySelector("#search-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();

  const permit = [...window.document.querySelectorAll(".filter-button")].find((button) => button.textContent.startsWith("Permits"));
  permit.click();
  const updatedPermit = [...window.document.querySelectorAll(".filter-button")].find((button) => button.textContent.startsWith("Permits"));
  assert.equal(updatedPermit.getAttribute("aria-pressed"), "true");
  assert.equal(window.document.querySelectorAll(".finding").length, 1);
  assert.match(window.document.querySelector(".finding h4").textContent, /Permit/);
  cleanup();
});

test("busy state prevents duplicate click submissions and recovers", async () => {
  let calls = 0;
  let release;
  const response = new Promise((resolve) => { release = resolve; });
  const { window, cleanup } = await loadUi(async () => {
    calls += 1;
    return response;
  });
  const input = window.document.querySelector("#address");
  const button = window.document.querySelector("button[type=submit]");
  input.value = "123 Main Street";
  button.click();
  button.click();
  assert.equal(calls, 1);
  assert.equal(button.disabled, true);
  assert.equal(window.document.querySelector("#loading").hidden, false);

  release({ ok: false, json: async () => ({ error: "Temporary source failure" }) });
  await settle();
  assert.equal(button.disabled, false);
  assert.match(window.document.querySelector("#form-status").textContent, /Temporary source failure/);
  cleanup();
});

async function loadUi(fetchImpl) {
  const dom = new JSDOM(html, { url: "http://localhost:3000/", pretendToBeVisual: true });
  const prior = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.fetch = fetchImpl;
  dom.window.RALEIGH_RENTER_CONFIG = { apiBase: "" };
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  await import(`../public/app.js?test=${Math.random()}`);
  return {
    window: dom.window,
    cleanup() {
      dom.window.close();
      globalThis.window = prior.window;
      globalThis.document = prior.document;
      globalThis.fetch = prior.fetch;
    },
  };
}

function fakeReport(marker) {
  return {
    generatedAt: "2026-08-24T10:00:00.000Z",
    cache: { hit: false },
    property: { address: "123 MAIN ST", pin: "1", jurisdiction: "RA", latitude: null, longitude: null, parcel: { propertyUse: "Residential", yearBuilt: 2000, units: 1 } },
    summary: {
      headline: marker,
      overview: [{ claim: marker, evidenceIds: ["parcel-1"] }],
      questionsForLandlord: [{ question: marker, evidenceIds: ["permit-1"] }],
      caveats: [marker],
    },
    findings: [
      { id: "parcel-1", classification: "property_record", level: "information", scope: "parcel", title: marker, detail: marker, sourceUrl: "https://example.com/parcel" },
      { id: "permit-1", classification: "permit_record", level: "information", scope: "parcel", title: "Permit", detail: marker, sourceUrl: "https://example.com/permit" },
    ],
    sources: [{ name: marker, url: "https://example.com/source", scope: "Exact", cadence: "Nightly", matchMethod: marker, retrievedAt: "2026-08-24T10:00:00.000Z", status: "ok", recordCount: 1 }],
    coverage: { nextStepUrl: "https://example.com/records" },
  };
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 30));
}
