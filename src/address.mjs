import { z } from "zod";
import { arcgisQuery, escapeSqlLiteral, safeText } from "./arcgis.mjs";
import { ENDPOINTS } from "./constants.mjs";

const AddressInput = z.string().trim().min(5).max(180);
const SUFFIXES = new Map([
  ["STREET", "ST"], ["ST", "ST"], ["ROAD", "RD"], ["RD", "RD"],
  ["AVENUE", "AVE"], ["AVE", "AVE"], ["DRIVE", "DR"], ["DR", "DR"],
  ["LANE", "LN"], ["LN", "LN"], ["COURT", "CT"], ["CT", "CT"],
  ["BOULEVARD", "BLVD"], ["BLVD", "BLVD"], ["PARKWAY", "PKWY"], ["PKWY", "PKWY"],
  ["PLACE", "PL"], ["PL", "PL"], ["CIRCLE", "CIR"], ["CIR", "CIR"],
  ["TRAIL", "TRL"], ["TRL", "TRL"], ["WAY", "WAY"], ["HIGHWAY", "HWY"], ["HWY", "HWY"],
]);
const DIRECTIONS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);

export function normalizeAddressInput(raw) {
  const parsed = AddressInput.parse(raw)
    .toUpperCase()
    .replace(/\s+(?:#|UNIT|APT|APARTMENT|STE|SUITE)\s*[A-Z0-9-]+.*$/, "")
    .replace(/[.,#]/g, " ")
    .replace(/\bRALEIGH\b|\bNC\b|\bNORTH CAROLINA\b|\b27\d{3}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = parsed.match(/^(\d+)\s+(.+)$/);
  if (!match) throw new Error("Enter a Raleigh street address beginning with a house number.");

  const number = Number(match[1]);
  let tokens = match[2].split(" ").filter(Boolean);
  const prefix = DIRECTIONS.has(tokens[0]) ? tokens.shift() : null;
  const maybeSuffix = tokens.at(-1);
  const suffix = SUFFIXES.get(maybeSuffix) || null;
  if (suffix) tokens = tokens.slice(0, -1);
  const name = tokens.join(" ");
  if (!name) throw new Error("Enter the street name after the house number.");
  return { number, prefix, name, suffix };
}

export async function suggestAddresses(raw, limit = 8) {
  const input = normalizeAddressInput(raw);
  const where = [
    `ST_NUM = ${input.number}`,
    `UPPER(ST_NAME) LIKE '${escapeSqlLiteral(input.name)}%'`,
    "UPPER(POSTAL_CITY) = 'RALEIGH'",
  ];
  if (input.prefix) where.push(`UPPER(DIR_PREFIX) = '${input.prefix}'`);
  if (input.suffix) where.push(`UPPER(ST_TYPE) = '${input.suffix}'`);

  const features = await arcgisQuery(ENDPOINTS.addresses, {
    where: where.join(" AND "),
    outFields: "OBJECTID,PIN_NUM,ST_NUM,DIR_PREFIX,ST_NAME,ST_TYPE,DIR_SUFFIX,POSTAL_CITY,FULLADDR",
    returnGeometry: true,
    outSR: 4326,
    resultRecordCount: Math.min(20, Math.max(limit, 8)),
    orderByFields: "FULLADDR",
  });

  return features
    .map(toAddress)
    .sort((a, b) => scoreAddress(input, b) - scoreAddress(input, a))
    .slice(0, limit);
}

export async function resolveAddress(raw) {
  const candidates = await suggestAddresses(raw, 8);
  if (!candidates.length) {
    const error = new Error("No matching Raleigh address was found in Wake County’s nightly address file.");
    error.code = "ADDRESS_NOT_FOUND";
    throw error;
  }
  const input = normalizeAddressInput(raw);
  const top = candidates[0];
  const exactStreet = top.streetName === input.name;
  const matchingPrefix = !input.prefix || top.prefix === input.prefix;
  const matchingSuffix = !input.suffix || top.streetType === input.suffix;
  if (!exactStreet || !matchingPrefix || !matchingSuffix) {
    const error = new Error("The address match is uncertain. Choose a more complete street address.");
    error.code = "ADDRESS_UNCERTAIN";
    error.candidates = candidates;
    throw error;
  }
  return { ...top, candidates };
}

function toAddress(feature) {
  const a = feature.attributes || {};
  return {
    objectId: a.OBJECTID,
    pin: safeText(a.PIN_NUM, null),
    address: safeText(a.FULLADDR),
    city: safeText(a.POSTAL_CITY),
    streetNumber: a.ST_NUM,
    prefix: safeText(a.DIR_PREFIX, null),
    streetName: safeText(a.ST_NAME),
    streetType: safeText(a.ST_TYPE, null),
    longitude: feature.geometry?.x ?? null,
    latitude: feature.geometry?.y ?? null,
  };
}

function scoreAddress(input, candidate) {
  let score = candidate.streetNumber === input.number ? 3 : 0;
  if (candidate.streetName === input.name) score += 4;
  else if (candidate.streetName.startsWith(input.name)) score += 2;
  if (!input.prefix || candidate.prefix === input.prefix) score += 1;
  if (!input.suffix || candidate.streetType === input.suffix) score += 1;
  return score;
}
