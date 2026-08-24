import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import axe from "axe-core";
import { JSDOM } from "jsdom";

test("homepage has no serious or critical automated accessibility violations", async () => {
  const html = await fs.readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://wayan.com/raleigh-renter/" });
  dom.window.eval(axe.source);
  const result = await dom.window.axe.run(dom.window.document, {
    rules: { "color-contrast": { enabled: false } },
  });
  const severe = result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
  const evidence = severe.map(({ id, impact, nodes }) => ({
    id,
    impact,
    targets: nodes.map((node) => node.target),
  }));
  assert.equal(severe.length, 0, JSON.stringify(evidence));
  dom.window.close();
});
