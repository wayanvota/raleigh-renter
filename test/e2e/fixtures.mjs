const checkedAt = "2026-09-11T12:00:00.000Z";
const marker = '<img src=x onerror="window.__e2eXss=1"><script>window.__e2eXss=2</script>';

export async function suggestAddressesFixture(query) {
  if (/missing/i.test(query)) return [];
  return [{
    address: "222 W HARGETT ST, RALEIGH NC 27601",
    pin: "1703486812",
    latitude: 35.7787,
    longitude: -78.6423
  }];
}

export async function buildReportFixture(address) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const xss = /XSS Lane/i.test(address);
  const displayAddress = xss ? "123 XSS LANE, RALEIGH NC" : "222 W HARGETT ST, RALEIGH NC 27601";
  const headline = xss ? marker : "Public records found, with verification gaps";
  return {
    id: "e2e-report-1",
    generatedAt: checkedAt,
    question: `What public records should I know about before renting ${displayAddress}?`,
    cache: { hit: false },
    summaryMode: "deterministic",
    property: {
      address: displayAddress,
      city: "RALEIGH",
      pin: "1703486812",
      latitude: 35.7787,
      longitude: -78.6423,
      jurisdiction: "RA",
      inRaleighJurisdiction: true,
      parcel: { propertyUse: "Residential", yearBuilt: 1925, units: 1 }
    },
    summary: {
      headline,
      overview: [
        { claim: xss ? marker : "One service request was returned. It is not a confirmed violation.", evidenceIds: ["request-1"] },
        { claim: "One completed permit matched the parcel.", evidenceIds: ["permit-1"] }
      ],
      questionsForLandlord: [
        { question: "Was the service request inspected and resolved?", evidenceIds: ["request-1"] },
        { question: "Can you provide the permit's final inspection record?", evidenceIds: ["permit-1"] }
      ],
      caveats: [xss ? marker : "A complaint is not a verified housing-code violation.", "No matching record does not prove no problem exists."]
    },
    findings: [
      { id: "parcel-1", sourceId: "wake-parcel", classification: "property_record", level: "information", scope: "parcel", title: "Wake County parcel", detail: "Residential parcel in Raleigh jurisdiction.", sourceUrl: "https://data.wake.gov/" },
      { id: "request-1", sourceId: "ask-raleigh", classification: "complaint_or_request", level: "attention", scope: "within_40_meters", title: xss ? marker : "Unsafe housing service request", detail: "Open request record. Outcome is not available in the feed.", date: "2026-07-01T00:00:00.000Z", sourceUrl: "https://www.arcgis.com/" },
      { id: "permit-1", sourceId: "building-permits", classification: "permit_record", level: "information", scope: "parcel", title: "Residential repair permit", detail: "Permit record marked complete.", date: "2025-10-15T00:00:00.000Z", sourceUrl: "https://data-ral.opendata.arcgis.com/" },
      { id: "incident-1", sourceId: "police-incidents", classification: "reported_incident", level: "context", scope: "within_quarter_mile", title: "Nearby reported incident", detail: "Area context, not a property-specific event.", date: "2026-06-15T00:00:00.000Z", sourceUrl: "https://raleighnc.gov/" },
      { id: "flood-1", sourceId: "flood-hazard", classification: "environmental_context", level: "information", scope: "address_point", title: "Address point outside mapped flood zone", detail: "Point-in-polygon result for the official address coordinate.", sourceUrl: "https://raleighnc.gov/" }
    ],
    sources: [
      { id: "wake-address", name: "Wake County parcel address points", url: "https://data.wake.gov/", scope: "Exact address resolution", cadence: "Nightly", matchMethod: "Canonical address point", retrievedAt: checkedAt, status: "ok", recordCount: 1 },
      { id: "ask-raleigh", name: "Ask Raleigh service requests", url: "https://www.arcgis.com/", scope: "Within 40 meters", cadence: "Twice daily", matchMethod: "Coordinate radius", retrievedAt: checkedAt, status: "ok", recordCount: 1 },
      { id: "building-permits", name: "Raleigh building permits", url: "https://data-ral.opendata.arcgis.com/", scope: "Parcel", cadence: "Daily", matchMethod: "Parcel PIN", retrievedAt: checkedAt, status: "ok", recordCount: 1 }
    ],
    coverage: {
      verifiedViolations: "not_available_in_open_feed",
      explanation: "The open feed records requests, not confirmed violations.",
      nextStepUrl: "https://raleighnc.gov/ask-raleigh-fix-report-request/services/records-request"
    },
    method: []
  };
}
