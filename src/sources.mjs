import { arcgisQuery, asIso, escapeSqlLiteral, safeText } from "./arcgis.mjs";
import { ENDPOINTS, SOURCE_DEFINITIONS, SOURCE_URLS } from "./constants.mjs";

export async function collectPublicRecords(address) {
  const retrievedAt = new Date().toISOString();
  const tasks = [
    runSource("wake-parcel", retrievedAt, () => getParcel(address)),
    runSource("ask-raleigh", retrievedAt, () => getRequests(address)),
    runSource("building-permits", retrievedAt, () => getPermits(address)),
    runSource("police-incidents", retrievedAt, () => getPoliceIncidents(address)),
    runSource("flood-hazard", retrievedAt, () => getFloodZones(address)),
  ];
  const results = await Promise.all(tasks);
  const byId = Object.fromEntries(results.map((result) => [result.id, result]));
  const parcel = byId["wake-parcel"].data?.parcel || null;
  const findings = results.flatMap((result) => result.data?.findings || []);

  const sourceChecks = SOURCE_DEFINITIONS.map((definition) => {
    if (definition.id === "wake-address") {
      return { ...definition, status: "ok", recordCount: 1, retrievedAt, matchMethod: "Exact Wake County address-point match" };
    }
    const result = byId[definition.id];
    return {
      ...definition,
      status: result?.status || "not_checked",
      recordCount: result?.recordCount || 0,
      retrievedAt,
      matchMethod: result?.matchMethod || null,
      error: result?.error || null,
    };
  });

  return { parcel, findings, sourceChecks, retrievedAt };
}

async function runSource(id, retrievedAt, load) {
  try {
    const data = await load();
    return { id, status: "ok", retrievedAt, data, recordCount: data.recordCount, matchMethod: data.matchMethod };
  } catch (error) {
    return {
      id,
      status: "unavailable",
      retrievedAt,
      error: publicError(error),
      recordCount: 0,
      data: { findings: [] },
    };
  }
}

async function getParcel(address) {
  if (!address.pin) return { parcel: null, findings: [], recordCount: 0, matchMethod: "No parcel identifier available" };
  const features = await arcgisQuery(ENDPOINTS.parcels, {
    where: `PIN_NUM = '${escapeSqlLiteral(address.pin)}'`,
    outFields: "PIN_NUM,REID,SITE_ADDRESS,CITY_DECODE,PLANNING_JURISDICTION,YEAR_BUILT,TYPE_USE_DECODE,TOTUNITS,HEATEDAREA",
    returnGeometry: false,
    resultRecordCount: 2,
  });
  const a = features[0]?.attributes;
  if (!a) return { parcel: null, findings: [], recordCount: 0, matchMethod: "Exact Wake County PIN match" };
  const parcel = {
    pin: safeText(a.PIN_NUM, null),
    realEstateId: safeText(a.REID, null),
    siteAddress: safeText(a.SITE_ADDRESS, address.address),
    city: safeText(a.CITY_DECODE, address.city),
    jurisdiction: safeText(a.PLANNING_JURISDICTION, "Not listed"),
    yearBuilt: a.YEAR_BUILT || null,
    propertyUse: safeText(a.TYPE_USE_DECODE, "Not listed"),
    units: a.TOTUNITS || null,
    heatedArea: a.HEATEDAREA || null,
  };
  const detail = [
    parcel.propertyUse,
    parcel.yearBuilt ? `year built ${parcel.yearBuilt}` : null,
    parcel.units ? `${parcel.units} unit${parcel.units === 1 ? "" : "s"}` : null,
    `planning jurisdiction: ${parcel.jurisdiction}`,
  ].filter(Boolean).join("; ");
  return {
    parcel,
    recordCount: 1,
    matchMethod: "Exact Wake County parcel PIN",
    findings: [finding({
      id: "parcel-1", sourceId: "wake-parcel", classification: "property_record", scope: "parcel",
      level: "information", title: "Wake County parcel record", detail, date: null, sourceUrl: SOURCE_URLS.parcel,
    })],
  };
}

async function getRequests(address) {
  const geometry = point(address);
  const relevant = "(UPPER(SERVICE) = 'UNSAFE HOUSING CONDITIONS' OR UPPER(SERVICE) = 'PUBLIC NUISANCE')";
  const features = await arcgisQuery(ENDPOINTS.requests, {
    where: relevant,
    geometry,
    geometryType: "esriGeometryPoint",
    inSR: 4326,
    spatialRel: "esriSpatialRelIntersects",
    distance: 40,
    units: "esriSRUnit_Meter",
    outFields: "NUMBER,CATEGORY,SERVICE,REQUEST_TYPE,REQUEST_LOCATION,REQUEST_ACTIVE,APPLIED_DATE,RESOLVED_AT,CLOSED_AT,ADDRESS,ZIP_CODE,STATUS",
    returnGeometry: false,
    orderByFields: "APPLIED_DATE DESC",
    resultRecordCount: 100,
  });
  const findings = features.map((feature, index) => {
    const a = feature.attributes || {};
    const exact = sameAddress(a.ADDRESS, address.address);
    const type = [safeText(a.SERVICE, "Service request"), safeText(a.REQUEST_TYPE, "")].filter(Boolean).join(": ");
    const status = safeText(a.STATUS || (a.REQUEST_ACTIVE === "Yes" ? "Active" : "Status not listed"));
    return finding({
      id: `request-${index + 1}`,
      sourceId: "ask-raleigh",
      classification: "complaint_or_request",
      scope: exact ? "address" : "within_40_meters",
      level: /active|open|assigned/i.test(status) ? "attention" : "context",
      title: type,
      detail: `${status}. This is a resident service request, not proof that the city verified a housing-code violation.`,
      date: asIso(a.APPLIED_DATE),
      recordNumber: safeText(a.NUMBER, null),
      sourceUrl: SOURCE_URLS.requests,
    });
  });
  return { findings, recordCount: features.length, matchMethod: "Address point plus 40-meter radius; exact-address matches labeled separately" };
}

async function getPermits(address) {
  if (!address.pin) return { findings: [], recordCount: 0, matchMethod: "No parcel identifier available" };
  const features = await arcgisQuery(ENDPOINTS.permits, {
    where: `pin = '${escapeSqlLiteral(address.pin)}'`,
    outFields: "permitnum,permittype,permittypemapped,workclass,proposedworkdescription,applieddate,issueddate,expiresdate,coissueddate,cocissueddate,statuscurrent,statuscurrentmapped,constcompletedofficial,projectname,originaladdress1,pin",
    returnGeometry: false,
    orderByFields: "applieddate DESC",
    resultRecordCount: 100,
  });
  const findings = features.map((feature, index) => {
    const a = feature.attributes || {};
    const status = safeText(a.statuscurrentmapped || a.statuscurrent);
    const completion = hasCompletionEvidence(a);
    const detail = [
      safeText(a.proposedworkdescription, null),
      `Status: ${status}`,
      completion ? "The export contains affirmative completion or occupancy evidence." : "No affirmative completion or occupancy evidence was found in the exported fields.",
    ].filter(Boolean).join(" ");
    return finding({
      id: `permit-${index + 1}`,
      sourceId: "building-permits",
      classification: "permit_record",
      scope: "parcel",
      level: /expired|void|denied|withdraw/i.test(status) ? "attention" : "information",
      title: `${safeText(a.permittypemapped || a.permittype, "Building permit")} · ${safeText(a.workclass, "Work class not listed")}`,
      detail,
      date: asIso(a.applieddate || a.issueddate),
      recordNumber: safeText(a.permitnum, null),
      sourceUrl: SOURCE_URLS.permits,
    });
  });
  return { findings, recordCount: features.length, matchMethod: "Exact Wake County PIN in the Raleigh permit record" };
}

async function getPoliceIncidents(address) {
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const features = await arcgisQuery(ENDPOINTS.police, {
    where: `reported_date >= TIMESTAMP '${cutoff} 00:00:00'`,
    geometry: point(address),
    geometryType: "esriGeometryPoint",
    inSR: 4326,
    spatialRel: "esriSpatialRelIntersects",
    distance: 402.336,
    units: "esriSRUnit_Meter",
    outFields: "case_number,crime_category,crime_description,crime_type,reported_block_address,reported_date,agency",
    returnGeometry: false,
    orderByFields: "reported_date DESC",
    resultRecordCount: 5000,
  });
  const counts = new Map();
  for (const feature of features) {
    const category = safeText(feature.attributes?.crime_category || feature.attributes?.crime_type, "Other reported incident");
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  const categories = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const findings = categories.slice(0, 12).map(([category, count], index) => finding({
    id: `incident-${index + 1}`,
    sourceId: "police-incidents",
    classification: "reported_incident",
    scope: "within_quarter_mile",
    level: "context",
    title: `${category}: ${count} reported incident${count === 1 ? "" : "s"}`,
    detail: "Area-level context for the prior 12 months. Raleigh masks portions of street addresses, and a police report does not establish that a crime occurred at this property.",
    date: null,
    sourceUrl: SOURCE_URLS.police,
  }));
  return { findings, recordCount: features.length, matchMethod: "Within 0.25 miles of the address point; prior 12 months; grouped by reported category" };
}

async function getFloodZones(address) {
  const features = await arcgisQuery(ENDPOINTS.flood, {
    where: "1=1",
    geometry: point(address),
    geometryType: "esriGeometryPoint",
    inSR: 4326,
    spatialRel: "esriSpatialRelIntersects",
    outFields: "DFIRM_ID,VERSION_ID,FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE,V_DATUM,DEPTH,LEN_UNIT,SOURCE_CIT",
    returnGeometry: false,
    resultRecordCount: 10,
  });
  if (!features.length) {
    return {
      recordCount: 0,
      matchMethod: "Point-in-polygon at the resolved address point",
      findings: [finding({
        id: "flood-1", sourceId: "flood-hazard", classification: "environmental_context", scope: "address_point",
        level: "context", title: "No flood-hazard polygon matched the address point",
        detail: "This narrow map check does not rule out flooding, drainage problems, or a flood zone elsewhere on the parcel. Verify the full parcel in Raleigh’s flood tools.",
        date: null, sourceUrl: SOURCE_URLS.flood,
      })],
    };
  }
  const findings = features.map((feature, index) => {
    const a = feature.attributes || {};
    const sfha = String(a.SFHA_TF).toUpperCase() === "T" || String(a.SFHA_TF).toUpperCase() === "Y";
    return finding({
      id: `flood-${index + 1}`, sourceId: "flood-hazard", classification: "environmental_context", scope: "address_point",
      level: sfha ? "attention" : "context", title: `Mapped flood zone ${safeText(a.FLD_ZONE)}`,
      detail: `${safeText(a.ZONE_SUBTY, "No subtype listed")}. Special Flood Hazard Area flag: ${safeText(a.SFHA_TF)}. The match is to the address point, not a survey of the full parcel.`,
      date: null, sourceUrl: SOURCE_URLS.flood,
    });
  });
  return { findings, recordCount: features.length, matchMethod: "Point-in-polygon at the resolved address point" };
}

function finding(value) {
  return { recordNumber: null, ...value };
}

function point(address) {
  if (!Number.isFinite(address.longitude) || !Number.isFinite(address.latitude)) throw new Error("Resolved address lacks usable coordinates.");
  return `${address.longitude},${address.latitude}`;
}

function sameAddress(left, right) {
  const clean = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const a = clean(left);
  const b = clean(right);
  return a && b && (a === b || a.startsWith(b) || b.startsWith(a));
}

function publicError(error) {
  if (error?.name === "TimeoutError") return "The source did not respond before the 12-second timeout.";
  return String(error?.message || "The source was unavailable.").slice(0, 240);
}

export function hasCompletionEvidence(attributes = {}) {
  if (Number.isFinite(Number(attributes.coissueddate)) && Number(attributes.coissueddate) > 0) return true;
  if (Number.isFinite(Number(attributes.cocissueddate)) && Number(attributes.cocissueddate) > 0) return true;
  return /^(yes|y|true|complete|completed)$/i.test(String(attributes.constcompletedofficial || "").trim());
}
