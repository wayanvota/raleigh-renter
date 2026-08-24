import { config } from "./config.mjs";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "overview", "questionsForLandlord", "caveats"],
  properties: {
    headline: { type: "string" },
    overview: {
      type: "array", minItems: 2, maxItems: 6,
      items: {
        type: "object", additionalProperties: false, required: ["claim", "evidenceIds"],
        properties: { claim: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } } },
      },
    },
    questionsForLandlord: {
      type: "array", minItems: 2, maxItems: 6,
      items: {
        type: "object", additionalProperties: false, required: ["question", "evidenceIds"],
        properties: { question: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } } },
      },
    },
    caveats: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
  },
};

export async function summarizeWithAi(report) {
  if (!process.env.OPENAI_API_KEY) return { summary: fallbackSummary(report), mode: "deterministic" };
  const evidenceIds = new Set(report.findings.map((item) => item.id));
  const evidence = report.findings.map(({ id, classification, scope, title, detail, date, sourceId }) => ({
    id, classification, scope, title, detail, date, sourceId,
  }));
  const sourceGaps = report.sources.filter((source) => source.status !== "ok").map((source) => source.name);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(35_000),
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.openaiModel,
        instructions: [
          "You summarize public records for a prospective renter in Raleigh, North Carolina.",
          "Use only the supplied evidence. Never infer that a complaint is a verified violation.",
          "Never say a property is safe or unsafe. No record found never means no problem exists.",
          "Separate parcel-level, address-level, and nearby area records. Keep prose concise and concrete.",
          "Every overview claim and landlord question must cite only supplied evidence IDs.",
          "State material source gaps in caveats.",
        ].join(" "),
        input: JSON.stringify({ address: report.property, evidence, sourceGaps }),
        text: { format: { type: "json_schema", name: "renter_record_summary", strict: true, schema } },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI returned HTTP ${response.status}`);
    const body = await response.json();
    const text = body.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
    if (!text) throw new Error("OpenAI returned no structured text output.");
    const summary = JSON.parse(text);
    const cited = [...summary.overview, ...summary.questionsForLandlord].flatMap((item) => item.evidenceIds);
    if (cited.some((id) => !evidenceIds.has(id))) throw new Error("OpenAI cited an unknown evidence ID.");
    return { summary, mode: "openai", model: config.openaiModel };
  } catch {
    return { summary: fallbackSummary(report), mode: "deterministic_fallback" };
  }
}

export function fallbackSummary(report) {
  const requests = report.findings.filter((item) => item.classification === "complaint_or_request");
  const permits = report.findings.filter((item) => item.classification === "permit_record");
  const incidents = report.findings.filter((item) => item.classification === "reported_incident");
  const flood = report.findings.filter((item) => item.sourceId === "flood-hazard");
  const overview = [];
  if (requests.length) overview.push({ claim: `${requests.length} nearby unsafe-housing or public-nuisance service request${requests.length === 1 ? " was" : "s were"} found. These are complaints or requests, not confirmed violations.`, evidenceIds: requests.map((x) => x.id).slice(0, 8) });
  else overview.push({ claim: "The open Ask Raleigh feed returned no nearby unsafe-housing or public-nuisance requests. That does not establish a clean code-enforcement history.", evidenceIds: [] });
  if (permits.length) overview.push({ claim: `${permits.length} building permit record${permits.length === 1 ? "" : "s"} matched the parcel. Review status and completion fields before signing.`, evidenceIds: permits.map((x) => x.id).slice(0, 8) });
  else overview.push({ claim: "No Raleigh building permits matched the parcel identifier in the open export.", evidenceIds: [] });
  if (incidents.length) overview.push({ claim: "Raleigh police reported incidents were found within one quarter mile during the prior 12 months. They are area context, not property-specific events.", evidenceIds: incidents.map((x) => x.id).slice(0, 8) });
  if (flood.length) overview.push({ claim: flood[0].title, evidenceIds: [flood[0].id] });

  const questionsForLandlord = [
    { question: "Have there been housing-code inspections, notices, or repair orders that do not appear in the open service-request feed?", evidenceIds: requests.map((x) => x.id).slice(0, 3) },
    { question: "Can you provide permits and final inspection or certificate-of-occupancy records for recent work?", evidenceIds: permits.map((x) => x.id).slice(0, 3) },
  ];
  if (flood.length) questionsForLandlord.push({ question: "Has the unit or parcel had flooding, drainage, or water-intrusion problems, including areas outside the mapped address point?", evidenceIds: [flood[0].id] });

  return {
    headline: "A public-record snapshot, with verification gaps",
    overview,
    questionsForLandlord,
    caveats: [
      "Ask Raleigh entries are service requests, not verified code violations.",
      "Police incidents are mapped near the address and may have intentionally masked locations.",
      "No matching record means only that this search did not find one in the available source.",
    ],
  };
}
