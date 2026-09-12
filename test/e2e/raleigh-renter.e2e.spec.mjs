import { expect, test } from "@playwright/test";

const canonicalAddress = "222 W HARGETT ST, RALEIGH NC 27601";

async function blockMapTiles(page) {
  await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
}

async function openHome(page) {
  await blockMapTiles(page);
  await page.goto("/");
}

async function runReport(page, address = "222 W Hargett Street") {
  await openHome(page);
  await page.getByLabel("Raleigh street address").fill(address);
  await page.getByRole("button", { name: "Check public records" }).click();
  await expect(page.locator("#report")).toBeVisible();
}

test.describe("Raleigh Renter browser-to-Express E2E contract", () => {
  test("U01 homepage presents the bounded renter question", async ({ page }) => {
    await openHome(page);
    await expect(page.getByRole("heading", { name: "Know what the records say before you sign." })).toBeVisible();
    await expect(page.getByText("A public-record snapshot, not a safety verdict.")).toBeVisible();
  });

  test("U02 address typing returns a canonical suggestion", async ({ page }) => {
    await openHome(page);
    await page.getByLabel("Raleigh street address").fill("222 W Hargett");
    await expect(page.getByRole("button", { name: canonicalAddress })).toBeVisible();
  });

  test("U03 choosing a suggestion fills the canonical address", async ({ page }) => {
    await openHome(page);
    const input = page.getByLabel("Raleigh street address");
    await input.fill("222 W Hargett");
    await page.getByRole("button", { name: canonicalAddress }).click();
    await expect(input).toHaveValue(canonicalAddress);
    await expect(page.locator("#suggestions")).toBeHidden();
  });

  test("U04 manual address submission renders a complete report", async ({ page }) => {
    await runReport(page);
    await expect(page.locator("#report-title")).toHaveText(canonicalAddress);
    await expect(page.locator("#summary-headline")).toHaveText("Public records found, with verification gaps");
    await expect(page.locator("#findings .finding")).toHaveCount(5);
  });

  test("U05 summary evidence links resolve to visible finding cards", async ({ page }) => {
    await runReport(page);
    const evidence = page.locator('#summary-overview a[href="#request-1"]');
    await expect(evidence).toBeVisible();
    await expect(page.locator("#request-1")).toContainText("Outcome is not available");
  });

  test("U06 parcel facts and the map marker render from the API result", async ({ page }) => {
    await runReport(page);
    await expect(page.locator("#property-facts")).toContainText("1703486812");
    await expect(page.locator("#property-facts")).toContainText("1925");
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(1);
  });

  test("U07 record filters change both pressed state and visible findings", async ({ page }) => {
    await runReport(page);
    const permits = page.getByRole("button", { name: "Permits (1)" });
    await permits.click();
    await expect(permits).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#findings .finding")).toHaveCount(1);
    await expect(page.locator("#findings")).toContainText("Residential repair permit");
  });

  test("U08 source coverage exposes status and official links", async ({ page }) => {
    await runReport(page);
    await expect(page.locator("#sources .source")).toHaveCount(3);
    await expect(page.locator("#sources")).toContainText("Available · 1 record");
    await expect(page.getByRole("link", { name: "Wake County parcel address points" })).toHaveAttribute("href", /^https:\/\//);
  });

  test("U09 checking another address resets the report and focuses the input", async ({ page }) => {
    await runReport(page);
    await page.getByRole("button", { name: "Check another address" }).click();
    await expect(page.locator("#report")).toBeHidden();
    await expect(page.getByLabel("Raleigh street address")).toHaveValue("");
    await expect(page.getByLabel("Raleigh street address")).toBeFocused();
  });

  test("U10 health, sources, and report APIs preserve their contracts", async ({ request }) => {
    const health = await request.get("/healthz");
    expect(await health.json()).toMatchObject({ ok: true, service: "raleigh-renter", aiConfigured: false });
    const sources = await request.get("/api/sources");
    expect((await sources.json()).sources).toHaveLength(6);
    const report = await request.post("/api/report", { data: { address: "222 W Hargett Street" } });
    expect(await report.json()).toMatchObject({ property: { address: canonicalAddress }, summaryMode: "deterministic" });
  });

  test("A01 incomplete addresses fail in the browser before an API call", async ({ page }) => {
    await openHome(page);
    let reportCalls = 0;
    page.on("request", (request) => { if (request.url().endsWith("/api/report")) reportCalls += 1; });
    await page.getByLabel("Raleigh street address").fill("x");
    await page.getByRole("button", { name: "Check public records" }).click();
    await expect(page.locator("#form-status")).toContainText("complete Raleigh street address");
    expect(reportCalls).toBe(0);
  });

  test("A02 strict request validation rejects extra fields without reflection", async ({ request }) => {
    const response = await request.post("/api/report", { data: { address: "222 W Hargett Street", attack: "<script>alert(1)</script>" }, failOnStatusCode: false });
    expect(response.status()).toBe(400);
    const body = await response.text();
    expect(body).not.toContain("<script>");
    expect(JSON.parse(body).code).toBe("INVALID_REQUEST");
  });

  test("A03 malformed JSON returns a controlled 400", async ({ request }) => {
    const response = await request.post("/api/report", {
      headers: { "content-type": "application/json" },
      data: Buffer.from("{broken"),
      failOnStatusCode: false
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_JSON" });
  });

  test("A04 oversized JSON returns a controlled 413", async ({ request }) => {
    const response = await request.post("/api/report", {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ address: `1 Main ${"x".repeat(13_000)}` }),
      failOnStatusCode: false
    });
    expect(response.status()).toBe(413);
    expect(await response.json()).toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });

  test("A05 unknown API routes stay JSON 404s", async ({ request }) => {
    const response = await request.get("/api/not-real", { failOnStatusCode: false });
    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  test("A06 unsupported methods return 405 with an Allow header", async ({ request }) => {
    const response = await request.get("/api/report", { failOnStatusCode: false });
    expect(response.status()).toBe(405);
    expect(response.headers().allow).toBe("POST");
    expect(await response.json()).toMatchObject({ code: "METHOD_NOT_ALLOWED" });
  });

  test("A07 hostile browser origins are denied without CORS permission", async ({ request }) => {
    const response = await request.get("/api/sources", { headers: { origin: "https://attacker.example" }, failOnStatusCode: false });
    expect(response.status()).toBe(403);
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
    expect(await response.json()).toMatchObject({ code: "ORIGIN_NOT_ALLOWED" });
  });

  test("A08 traversal-shaped requests cannot expose environment files", async ({ request }) => {
    const response = await request.get("/..%2f..%2f.env.local", { failOnStatusCode: false });
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain("OPENAI_API_KEY");
  });

  test("A09 untrusted report content remains inert text", async ({ page }) => {
    await runReport(page, "123 XSS Lane");
    expect(await page.evaluate(() => window.__e2eXss)).toBeUndefined();
    await expect(page.locator("#report script")).toHaveCount(0);
    await expect(page.locator('#report img:not([class*="leaflet"])')).toHaveCount(0);
    await expect(page.locator("#summary-headline")).toContainText("<img src=x");
  });

  test("A10 duplicate submit events produce only one backend report", async ({ page }) => {
    await openHome(page);
    await page.getByLabel("Raleigh street address").fill("222 W Hargett Street");
    let reportCalls = 0;
    page.on("request", (request) => { if (request.url().endsWith("/api/report")) reportCalls += 1; });
    await page.evaluate(() => {
      const button = document.querySelector('button[type="submit"]');
      button.click();
      button.click();
    });
    await expect(page.locator("#report")).toBeVisible();
    expect(reportCalls).toBe(1);
  });
});
