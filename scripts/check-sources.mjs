import { resolveAddress } from "../src/address.mjs";
import { collectPublicRecords } from "../src/sources.mjs";

const address = process.argv.slice(2).join(" ") || "222 W Hargett Street";
const resolved = await resolveAddress(address);
const report = await collectPublicRecords(resolved);
const result = {
  address: resolved.address,
  pinMatched: Boolean(resolved.pin),
  coordinatesMatched: Number.isFinite(resolved.latitude) && Number.isFinite(resolved.longitude),
  sources: report.sourceChecks.map(({ id, status, recordCount, error }) => ({ id, status, recordCount, error })),
};
console.log(JSON.stringify(result, null, 2));
if (result.sources.some((source) => source.status !== "ok")) process.exitCode = 1;
