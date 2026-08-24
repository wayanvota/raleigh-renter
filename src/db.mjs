import crypto from "node:crypto";
import pg from "pg";
import { config } from "./config.mjs";

const { Pool } = pg;
let pool;
let schemaPromise;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!hasDatabase()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

async function ensureSchema() {
  const db = getPool();
  if (!db) return;
  if (!schemaPromise) {
    schemaPromise = db.query(`
      create table if not exists report_cache (
        cache_key text primary key,
        canonical_address text not null,
        report_json jsonb not null,
        created_at timestamptz not null default now(),
        expires_at timestamptz not null
      );
      create index if not exists report_cache_expires_at_idx on report_cache (expires_at);
      create table if not exists source_checks (
        source_id text primary key,
        status text not null,
        record_count integer not null default 0,
        checked_at timestamptz not null default now(),
        detail text
      );
    `).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

export function cacheKey(address) {
  return crypto.createHash("sha256").update(address.toUpperCase()).digest("hex");
}

export async function getCachedReport(address) {
  const db = getPool();
  if (!db) return null;
  await ensureSchema();
  const result = await db.query(
    "select report_json from report_cache where cache_key = $1 and expires_at > now()",
    [cacheKey(address)],
  );
  return result.rows[0]?.report_json ?? null;
}

export async function saveCachedReport(address, report) {
  const db = getPool();
  if (!db) return;
  await ensureSchema();
  await db.query(
    `insert into report_cache (cache_key, canonical_address, report_json, expires_at)
     values ($1, $2, $3, now() + ($4 * interval '1 hour'))
     on conflict (cache_key) do update set
       canonical_address = excluded.canonical_address,
       report_json = excluded.report_json,
       created_at = now(),
       expires_at = excluded.expires_at`,
    [cacheKey(address), address, JSON.stringify(report), config.cacheTtlHours],
  );
}

export async function saveSourceChecks(sourceChecks) {
  const db = getPool();
  if (!db) return;
  await ensureSchema();
  await Promise.all(sourceChecks.map((source) => db.query(
    `insert into source_checks (source_id, status, record_count, checked_at, detail)
     values ($1, $2, $3, now(), $4)
     on conflict (source_id) do update set status=excluded.status, record_count=excluded.record_count,
       checked_at=excluded.checked_at, detail=excluded.detail`,
    [source.id, source.status, source.recordCount || 0, source.error || null],
  )));
}

export async function checkDatabase() {
  if (!hasDatabase()) return { ok: true, mode: "disabled" };
  await ensureSchema();
  await getPool().query("select 1");
  return { ok: true, mode: "neon" };
}
