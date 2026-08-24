export async function arcgisQuery(endpoint, params, { timeoutMs = 12_000 } = {}) {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries({ ...params, f: "json" })) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json", "user-agent": "RaleighRenter/1.0 public-record research" },
  });
  if (!response.ok) throw new Error(`Public data source returned HTTP ${response.status}.`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || "Public data source query failed.");
  return body.features || [];
}

export function asIso(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function safeText(value, fallback = "Not listed") {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  return String(value).trim();
}

export function escapeSqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}
