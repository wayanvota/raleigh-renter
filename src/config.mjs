export const config = {
  port: Number(process.env.PORT || 3000),
  openaiModel: process.env.OPENAI_MODEL || "gpt-5.6",
  cacheTtlHours: clampNumber(process.env.CACHE_TTL_HOURS, 1, 24, 6),
  requestLimit: clampNumber(process.env.REQUEST_LIMIT, 1, 100, 12),
  requestWindowMs: clampNumber(process.env.REQUEST_WINDOW_MS, 60_000, 3_600_000, 600_000),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
};

function clampNumber(raw, min, max, fallback) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
