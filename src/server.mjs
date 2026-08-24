import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false, quiet: true });

import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { config } from "./config.mjs";
import { suggestAddresses } from "./address.mjs";
import { buildReport } from "./report.mjs";
import { checkDatabase, hasDatabase } from "./db.mjs";
import { SOURCE_DEFINITIONS } from "./constants.mjs";

export const app = express();
const directory = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(directory, "../public");
const buckets = new Map();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed."));
  },
  methods: ["GET", "POST"],
}));
app.use(express.json({ limit: "12kb" }));
app.use(express.static(publicDir, { extensions: ["html"], maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 }));

app.get("/healthz", async (_request, response) => {
  try {
    const database = await checkDatabase();
    response.json({ ok: true, service: "raleigh-renter", database, aiConfigured: Boolean(process.env.OPENAI_API_KEY) });
  } catch {
    response.status(503).json({ ok: false, service: "raleigh-renter", database: { ok: false } });
  }
});

app.get("/api/sources", (_request, response) => {
  response.json({ sources: SOURCE_DEFINITIONS, databaseConfigured: hasDatabase() });
});

app.get("/api/addresses", async (request, response) => {
  try {
    const q = z.string().trim().min(5).max(180).parse(request.query.q);
    response.json({ addresses: await suggestAddresses(q) });
  } catch (error) {
    response.status(400).json({ error: publicMessage(error) });
  }
});

app.post("/api/report", rateLimit, async (request, response) => {
  try {
    const input = z.object({ address: z.string().trim().min(5).max(180) }).strict().parse(request.body);
    response.json(await buildReport(input.address));
  } catch (error) {
    const status = error?.code === "ADDRESS_NOT_FOUND" || error?.code === "ADDRESS_UNCERTAIN" ? 422 : 400;
    response.status(status).json({ error: publicMessage(error), code: error?.code || "INVALID_REQUEST", candidates: error?.candidates || [] });
  }
});

app.all("/api/report", methodNotAllowed(["POST"]));
app.all("/api/addresses", methodNotAllowed(["GET"]));
app.all("/api/sources", methodNotAllowed(["GET"]));
app.all("/api/*splat", (_request, response) => {
  response.status(404).json({ error: "API endpoint not found.", code: "NOT_FOUND" });
});

app.get("/", (_request, response) => response.sendFile(path.join(publicDir, "index.html")));
app.use((_request, response) => response.status(404).type("text/plain").send("Page not found."));

app.use((error, _request, response, _next) => {
  if (error?.message === "Origin not allowed.") {
    return response.status(403).json({ error: "The request could not be completed.", code: "ORIGIN_NOT_ALLOWED" });
  }
  if (error?.type === "entity.too.large") {
    return response.status(413).json({ error: "The request body is too large.", code: "PAYLOAD_TOO_LARGE" });
  }
  if (error instanceof SyntaxError && Object.hasOwn(error, "body")) {
    return response.status(400).json({ error: "The request body is not valid JSON.", code: "INVALID_JSON" });
  }
  return response.status(500).json({ error: "The request could not be completed.", code: "INTERNAL_ERROR" });
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(config.port, () => {
    console.log(`Raleigh Renter listening on port ${config.port}`);
  });
}

function rateLimit(request, response, next) {
  const now = Date.now();
  const key = request.ip || "unknown";
  const prior = buckets.get(key);
  if (!prior || prior.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.requestWindowMs });
    return next();
  }
  prior.count += 1;
  if (prior.count > config.requestLimit) {
    response.set("Retry-After", String(Math.ceil((prior.resetAt - now) / 1000)));
    return response.status(429).json({ error: "Too many reports were requested. Please try again in a few minutes." });
  }
  next();
}

function publicMessage(error) {
  if (error instanceof z.ZodError) return "Enter a complete Raleigh street address.";
  return String(error?.message || "The request could not be completed.").slice(0, 300);
}

function methodNotAllowed(allowed) {
  return (_request, response) => {
    response.set("Allow", allowed.join(", "));
    response.status(405).json({ error: "Method not allowed.", code: "METHOD_NOT_ALLOWED" });
  };
}
