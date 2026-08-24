import fs from "node:fs/promises";
import path from "node:path";

const source = path.resolve("public");
const destination = path.resolve("dist");
const apiBase = String(process.env.PUBLIC_API_BASE || "").replace(/\/$/, "");
if (!/^https:\/\/[a-z0-9.-]+$/i.test(apiBase)) {
  throw new Error("Set PUBLIC_API_BASE to the deployed HTTPS Render origin before building the Wayan.com frontend.");
}

await fs.rm(destination, { recursive: true, force: true });
await fs.cp(source, destination, { recursive: true });
await fs.writeFile(
  path.join(destination, "config.js"),
  `window.RALEIGH_RENTER_CONFIG = {\n  apiBase: ${JSON.stringify(apiBase)}\n};\n`,
  "utf8",
);
console.log(`Built Wayan.com frontend for ${apiBase}`);
