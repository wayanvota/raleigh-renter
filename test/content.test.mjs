import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { JSDOM } from "jsdom";
import { SOURCE_URLS } from "../src/constants.mjs";

test("navigation, metadata, and public copy are internally consistent", async () => {
  const html = await fs.readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const dom = new JSDOM(html, { url: "https://wayan.com/raleigh-renter/" });
  const { document } = dom.window;

  assert.equal(document.title, "Raleigh Renter Records");
  assert.equal(document.querySelector('link[rel="canonical"]').href, "https://wayan.com/raleigh-renter/");
  assert.equal(document.querySelector('meta[name="description"]').content.length > 40, true);
  assert.equal(document.querySelectorAll("h1").length, 1);
  assert.match(document.body.textContent, /complaint is not a confirmed violation/i);
  assert.equal(document.body.textContent.includes("�"), false);
  assert.equal(/\[(?:PROJECT PATH|URL|ADD IF KNOWN|SOURCE NEEDED)\]/.test(document.body.textContent), false);

  for (const link of document.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href");
    if (href.startsWith("#")) assert.ok(document.querySelector(href), `Missing anchor target for ${href}`);
    if (/^https?:/.test(href)) assert.equal(href.startsWith("https://"), true);
    if (link.target === "_blank") assert.match(link.rel, /noopener|noreferrer/);
  }
  assert.equal(SOURCE_URLS.police, "https://raleighnc.gov/police/services/raleighs-crime-data");
  assert.equal(Object.values(SOURCE_URLS).every((url) => url.startsWith("https://")), true);
  dom.window.close();
});
