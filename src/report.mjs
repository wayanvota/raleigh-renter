import crypto from "node:crypto";
import { resolveAddress } from "./address.mjs";
import { collectPublicRecords } from "./sources.mjs";
import { summarizeWithAi } from "./ai.mjs";
import { getCachedReport, saveCachedReport, saveSourceChecks } from "./db.mjs";
import { SOURCE_URLS } from "./constants.mjs";

export async function buildReport(rawAddress) {
  const resolved = await resolveAddress(rawAddress);
  const cached = await safely(() => getCachedReport(resolved.address));
  if (cached) return { ...cached, cache: { hit: true } };

  const collected = await collectPublicRecords(resolved);
  const jurisdiction = collected.parcel?.jurisdiction || "Not listed";
  const inRaleighJurisdiction = /RALEIGH/i.test(jurisdiction);
  const base = {
    id: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    question: `What public records should I know about before renting ${resolved.address}?`,
    property: {
      address: resolved.address,
      city: resolved.city,
      pin: resolved.pin,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      jurisdiction,
      inRaleighJurisdiction,
      parcel: collected.parcel,
    },
    findings: collected.findings,
    sources: collected.sourceChecks,
    coverage: {
      verifiedViolations: "not_available_in_open_feed",
      explanation: "The open Ask Raleigh dataset records complaints and service requests. It does not establish whether inspectors confirmed a housing-code violation.",
      nextStepUrl: SOURCE_URLS.recordsRequest,
    },
    method: sevenSteps(),
  };
  const ai = await summarizeWithAi(base);
  const report = { ...base, summary: ai.summary, summaryMode: ai.mode, model: ai.model || null, cache: { hit: false } };
  await Promise.all([
    safely(() => saveCachedReport(resolved.address, report)),
    safely(() => saveSourceChecks(collected.sourceChecks)),
  ]);
  return report;
}

function sevenSteps() {
  return [
    { step: 1, name: "Resolve the address", status: "complete", detail: "Matched to Wake County’s nightly address point and parcel identifier." },
    { step: 2, name: "Query public sources", status: "complete", detail: "Checked parcel, service request, permit, police incident, and flood-hazard sources." },
    { step: 3, name: "Classify each record", status: "complete", detail: "Separated property records, complaints, permits, reported incidents, and environmental context." },
    { step: 4, name: "Retrieve explanatory records", status: "complete", detail: "Attached official source pages and the city records-request path where open data is incomplete." },
    { step: 5, name: "Summarize the evidence", status: "complete", detail: "Generated a bounded summary from retrieved records only, with a deterministic fallback." },
    { step: 6, name: "Show provenance", status: "complete", detail: "Displayed retrieval time, match method, scope, and official source for each evidence group." },
    { step: 7, name: "State what remains unknown", status: "complete", detail: "Flagged missing violation outcomes, location masking, unavailable sources, and uncertain matches." },
  ];
}

async function safely(task) {
  try { return await task(); } catch { return null; }
}
