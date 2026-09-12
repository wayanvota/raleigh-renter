# Raleigh Renter End-to-End Test Report

## Scope and result

- Date: 2026-09-11
- Boundary: real Chromium frontend through real Express routing, validation, headers, and response contracts
- Replaced boundary: Wake County, Raleigh, OpenAI, and Neon use deterministic dependency fixtures
- Categories: exactly 20, comprising `U01`-`U10` and `A01`-`A10`
- External requests and credentials: none
- Optional live smoke: separate from the 20 deterministic categories and excluded from CI
- Existing automated checks: 29 passed, 0 failed
- Deterministic E2E: 20 passed, 0 failed
- Production Wayan build: passed for `https://raleigh-renter-api.onrender.com`
- Live public-data and OpenAI smoke: passed with 32 findings and evidence-gated synthesis
- Dependency audit: 0 vulnerabilities

## User-behavior categories

| ID | Scenario | Expected result |
| --- | --- | --- |
| U01 | Open homepage | Bounded renter question and no-safety-verdict warning are visible |
| U02 | Type an address | Canonical suggestion appears |
| U03 | Choose suggestion | Canonical address fills and suggestions close |
| U04 | Submit address | Complete report renders from Express API |
| U05 | Follow evidence | Summary evidence IDs resolve to finding cards |
| U06 | Review parcel and map | Parcel facts and property marker render |
| U07 | Filter records | Pressed state and findings update together |
| U08 | Review sources | Status, match detail, and official link appear |
| U09 | Start another search | Report hides and focused input resets |
| U10 | Use public APIs | Health, source, and report contracts remain stable |

## Adversarial categories

| ID | Scenario | Expected result |
| --- | --- | --- |
| A01 | Short browser input | Client rejects it without a report request |
| A02 | Extra JSON field | Strict server validation returns 400 without reflection |
| A03 | Malformed JSON | Controlled 400 `INVALID_JSON` |
| A04 | Oversized JSON | Controlled 413 `PAYLOAD_TOO_LARGE` |
| A05 | Unknown API | JSON 404 `NOT_FOUND` |
| A06 | Wrong method | 405 with correct `Allow` header |
| A07 | Hostile origin | 403 without CORS permission |
| A08 | Traversal-shaped path | No environment file content is exposed |
| A09 | Untrusted report markup | Content stays inert text |
| A10 | Duplicate submit | Busy state permits one backend request |

## Architecture decision

`createApp()` accepts four service functions while preserving the existing production defaults. The E2E server replaces only address resolution, report generation, and database health. Express middleware, CORS, rate limiting, JSON boundaries, static delivery, API routing, and the browser application remain production code. This gives CI a deterministic product boundary without calling changing government datasets or spending OpenAI credits.

## Finding fixed

The repository declared Node.js `>=22.13.0`, but the locked `jsdom@30.0.1` requires Node.js `^22.22.2`, `^24.15.0`, or `>=26.0.0`. Clean installation on 22.16.0 produced engine warnings. The declared minimum and GitHub Actions runtime now use 22.22.2. Local verification used Node.js 26.5.0, which satisfies the same dependency contract.

## Reproduction

```bash
npm ci
npx playwright install chromium
npm run test:ci
npm audit --audit-level=high
```

GitHub Actions uses Node.js 22.22.2, the minimum supported by the locked `jsdom` dependency, and uploads the HTML report, traces, screenshots, and videos only when the E2E job fails.
