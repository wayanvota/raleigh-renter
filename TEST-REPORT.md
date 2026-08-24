# Raleigh Renter Records Test Report

**Date:** August 24, 2026

**Reviewer role:** Senior software test engineer and application-security reviewer

**Repository:** `/Users/wayanvota/Documents/ChatGPT/AI Tools/raleigh-renter`

**Branch:** `main`

**Committed baseline tested:** `9e10585176640e1e29f35014b2d2d0c548a7e2cc`

**Published release tested:** `f9192d8` plus the static artifact built from `81505b2`

**Production frontend:** `https://wayan.com/raleigh-renter/`

**Production API:** `https://raleigh-renter-api.onrender.com`

**Environment:** macOS 26.5.2, Node.js 26.5.0, npm 11.17.0

## Release recommendation

**READY WITH KNOWN LIMITATIONS**

The published release passed 28 automated tests and the main live flow in Chromium, Firefox, and Safari. No critical or high-severity vulnerability was confirmed by the tests performed. Seven defects were found and fixed, including a stale-cache defect discovered during the production rollout.

Production verification confirmed structured API 404 and 400 responses, Raleigh jurisdiction `RA` classified correctly, current police-data citations in cached reports, canonical and social metadata, and the Apache security-header policy on the Wayan frontend.

This report does not claim that the application is secure. It records the behaviors and attack classes tested, the protections that resisted them, and the remaining gaps.

## Architecture and major flows discovered

The application is a public, unauthenticated Express 5 service with a static JavaScript frontend. The frontend is also built as a separate Apache-hosted artifact for Wayan.com. The backend:

1. Normalizes a Raleigh street address.
2. Resolves it against Wake County address points.
3. Uses the parcel PIN and coordinates to query fixed Wake County and Raleigh ArcGIS endpoints.
4. Separates property facts, complaints or service requests, permits, nearby reported incidents, and flood context.
5. Optionally asks the OpenAI Responses API for a strict-schema summary whose citations must match retrieved evidence IDs.
6. Falls back to a deterministic summary if AI is unavailable or returns an unknown evidence ID.
7. Optionally caches public-record reports in Neon using a SHA-256 cache key.

The primary renter flow is homepage load, address entry or suggestion selection, report generation, map rendering, filtering, source review, and a new search. There are no accounts, roles, cookies, uploads, user-supplied URLs, payments, or state-changing public-data operations.

Material assumptions:

- Prior authorization to build and publish this specific website permits safe live smoke, navigation, TLS, header, and primary-flow checks.
- Malicious inputs, oversized bodies, malformed JSON, injection strings, and attack simulations were limited to local servers.
- The existing Neon database was tested only with `select 1` over strict TLS. Cache rows were not modified for this review.
- Raleigh and Wake County source data can change between runs. Record counts are evidence of adapter operation, not a permanent property fact.

## Outcome summary

- **Distinct categories executed:** 42
- **Categories passed outright:** 32
- **Categories passed after fixes:** 7
- **Categories partially unverified:** 3
- **Executed categories still failing locally:** 0
- **Blocked categories:** 0
- **Inapplicable categories:** 6
- **Automated regression tests:** 27 passed, 0 failed, 0 skipped
- **Dependency audit:** 0 known vulnerabilities reported by `npm audit`
- **Official source adapters:** 6 of 6 returned `ok` for `222 W Hargett Street`
- **Repeated live reports:** 3 of 3 produced the same normalized-result SHA-256 hash

## Test-category matrix

| # | Category | Result | Executed check and evidence |
|---:|---|---|---|
| 1 | Clean installation and build | PASS | `npm ci`; 196 packages audited after test dependencies; Wayan build completed and produced 12 artifact files including `.htaccess`. |
| 2 | Static analysis | PASS | ESLint 10 ran across application and tests with 0 errors and 0 warnings after removing an unused frontend variable. |
| 3 | Compile checking | PASS | `node --check src/server.mjs` and `node --check public/app.js`. |
| 4 | Unit tests | FIXED | Address normalization, permit completion, cache hashing, AI citation validation, jurisdiction interpretation, ArcGIS escaping, and build-origin validation. Fixed `RA` being incorrectly treated as outside Raleigh. |
| 5 | Component tests | PASS | jsdom exercised form validation, server errors, loading recovery, filter state, duplicate clicks, and untrusted rendered text. |
| 6 | Integration tests | PASS | Local production-configured Express server queried all official adapters and returned a 33-finding deterministic report in 7.99 seconds. Strict-TLS Neon `select 1` returned `1`. |
| 7 | Smoke tests | PASS | Homepage, health endpoint, JavaScript, CSS, Leaflet, and marker assets returned 200. Built artifact size was 268 KB. |
| 8 | Primary user flow | PASS | `222 W Hargett Street` produced a report and map in Chromium, Firefox, and Safari. Live cached report returned 33 findings. |
| 9 | Form and input validation | PASS | Required, too short, over 180 characters, whitespace, unit number, Unicode, full-width digits, extra fields, script strings, and SQL-like strings were tested. |
| 10 | Negative paths | PASS | Missing addresses, strict-body violations, hostile origins, upstream timeout, malformed upstream JSON, and transient frontend errors failed without leaving controls disabled. |
| 11 | Navigation and links | FIXED | Internal anchors and external protocols were checked. Seven official links returned 200; the old police-data link returned 404 and was replaced with the current official URL, which returns 200. |
| 12 | Routing and direct entry | FIXED | Original `/api/does-not-exist` returned 200 HTML. Candidate returns JSON 404; unknown pages return text 404; traversal-shaped paths return 404 without file contents. |
| 13 | API contracts | FIXED | Health schema, content types, 400, 403, 404, 405, 413, 422, and 429 contracts were asserted. Existing API paths now return controlled 405 responses for unsupported methods. |
| 14 | State and persistence | PASS | Cache keys are deterministic one-way hashes; live cache hit was verified; filters reset per report. Cache expiry and stale-row mutation were not tested against production. |
| 15 | Concurrency and idempotency | PASS | Duplicate submit clicks issued one fetch while busy; repeated requests were rate limited; three live cached reports were identical after normalization. |
| 16 | Error recovery | PASS | Local timeouts, malformed upstream JSON, rejected report responses, and delayed responses restored usable controls and honest errors. |
| 17 | Responsive layout | PASS | Chromium viewport checks at 390×844, 768×1024, and 1440×900 found no horizontal overflow. Search and method grids switched at intended breakpoints. |
| 18 | Cross-browser | PASS | Main live flow and map rendered in Chromium, Firefox, and Safari. Visual evidence is stored in `test-artifacts/`. |
| 19 | Accessibility audit | PASS | axe-core found 0 serious or critical static-page violations. Color contrast was excluded from jsdom automation and visually reviewed. |
| 20 | Keyboard-only | PARTIAL | Firefox focus order reached skip link, brand, method link, address field, and submit button. Browser-control automation did not reliably complete a fully keyboard-only submission, so that final activation remains unverified. |
| 21 | Screen-reader-oriented checks | PASS | Firefox and Safari accessibility trees exposed labeled textbox and buttons, headings, regions, definition list, filter toggle states, map controls, source links, and live status content. No physical screen reader was used. |
| 22 | Visual regression | PASS | New Firefox and Safari populated-report baselines were captured. Mobile Chromium was visually checked at 390×844. There was no historical baseline for pixel comparison. |
| 23 | Content integrity | PASS | Checked replacement characters, placeholders, disclaimer language, heading count, terminology, evidence labels, raw error exposure, and complaint-versus-violation wording. |
| 24 | Localization and formatting | PASS | Unicode street text, full-width-digit rejection, whitespace, 180-character boundary, ISO dates, local date rendering, pluralization, and long AI-like strings were exercised. |
| 25 | Performance | PASS | Local homepage TTFB 0.014 s; fresh real-source report 7.99 s; live Wayan homepage 0.407 s; live cached report 0.697 s; artifact 268 KB. Thresholds were 2 s for cached/home responses and 15 s for a fresh report. |
| 26 | Slow network and caching | PARTIAL | Delayed fetch recovery, one-hour static cache headers, ETag revalidation, and 304 response were verified. The live Wayan page has no explicit Cache-Control header. Offline and packet-loss recovery were not tested. |
| 27 | Cross-site scripting | PASS | Script and image-handler strings supplied through mocked API, AI, source, finding, and caveat fields remained text. No script or image node was created and no marker variable executed. |
| 28 | Injection | PASS | SQL-like address strings, quotes, semicolons, strict JSON fields, and ArcGIS literal escaping were tested. Fixed SQL templates use parameterized Neon queries and escaped fixed-endpoint ArcGIS clauses. |
| 29 | Authentication | N/A | The application has no authentication or accounts. Replaced by AI citation-integrity testing. |
| 30 | Authorization | N/A | No roles, protected objects, or mutation endpoints exist. Replaced by API routing and evidence-boundary testing. |
| 31 | Session, cookie, and CSRF | N/A | No session, cookie, login, or state-changing authenticated operation exists. Replaced by CORS and duplicate-submit testing. |
| 32 | SSRF and unsafe URLs | N/A | Users cannot provide URLs and runtime fetch destinations are fixed constants. Build-time public API origin validation was tested instead. |
| 33 | Path traversal and file access | PASS | Encoded traversal-shaped request returned 404 and did not expose `.env.local` identifiers or contents. |
| 34 | File upload | N/A | No upload surface exists. Replaced by production-artifact and built-secret inspection. |
| 35 | Open redirect | N/A | No redirect parameter or redirect endpoint exists. Replaced by internal-anchor and external-link validation. |
| 36 | CORS and security headers | FIXED | Trusted Wayan origin allowed; hostile origin returned 403 without ACAO. Render has CSP, HSTS, nosniff, framing, and referrer headers. The deployed Wayan `.htaccess` adds CSP, Permissions-Policy, Referrer-Policy, nosniff, and frame denial. |
| 37 | Request boundaries | FIXED | Original malformed and >12 KB JSON both returned 500. Candidate returns controlled 400 and 413. Unsupported methods, extra fields, long values, and unsupported bodies were also checked. |
| 38 | Rate limits and abuse controls | PASS | Local limit of two requests produced 429 on the third with positive `Retry-After`. Multi-instance persistence and production proxy-spoof resistance remain unverified. |
| 39 | Secrets and sensitive data | PASS | Tracked-file and built-artifact scans found no project keys, database URLs, or private-key blocks. `dist/config.js` contains only the public Render origin. |
| 40 | Dependencies and configuration | PASS | `npm audit --audit-level=low` reported 0 vulnerabilities. Production build rejects missing, HTTP, path-bearing, and JavaScript API origins. Neon strict certificate validation succeeded. |
| 41 | Privacy and logging | PASS | Code scan found no browser storage or cookie use and no request-body logging. Runtime logs contain startup and build messages only. Cache keys hash canonical public addresses; cached reports contain public-record results. |
| 42 | AI adversarial behavior | PASS | Direct prompt injection, role-like instructions, fake evidence IDs, system-prompt extraction text, unsafe safety claims, and fabricated citations were supplied through mocked evidence. Unknown citations forced deterministic fallback. |
| 43 | SEO and discoverability | FIXED | The live Wayan page now contains description, robots, canonical, and Open Graph title, description, type, and URL. |
| 44 | Health and readiness | PASS | Local health worked with database and AI disabled; live health reported Neon and AI configured; strict-TLS Neon query succeeded. Local servers accepted SIGINT. Forced live dependency failure was not attempted. |
| 45 | Production artifact | PASS | Built and served `dist/` independently. Homepage, configuration, JavaScript, CSS, Leaflet, and marker files returned 200 with expected sizes. |
| 46 | Repeated reliability | PASS | Three live report requests produced the same normalized SHA-256 hash. A separate live performance request also returned cache hit, OpenAI mode, and 33 findings. |
| 47 | Regression | PASS | Final `npm run check` passed 28 tests with 0 failures, 0 skipped, and no lint warnings. |
| 48 | Live verification | PARTIAL | TLS, homepage, headers, assets, suggestions, health, CORS, validation, primary flow, map, performance, jurisdiction, cached citations, and three-browser behavior passed. The full browser matrix was not repeated after the final backend-only cache hotfix. |

## Defects found and fixed

### 1. Unknown API routes returned the homepage with HTTP 200

- **Severity:** Medium reliability and integration defect
- **Reproduction:** Run committed baseline locally, then `GET /api/does-not-exist`.
- **Observed:** HTTP 200, `text/html`, homepage body. The live API reproduced the same behavior.
- **Cause:** A broad `GET /*splat` SPA fallback ran after API routes.
- **Fix:** Added explicit JSON API 404 handling, per-route 405 handlers, an exact homepage route, and a plain page 404.
- **Regression coverage:** `test/http.test.mjs`, “returns controlled API routing and method errors.”

### 2. Malformed and oversized JSON returned generic HTTP 500

- **Severity:** Medium API robustness defect
- **Reproduction:** On an isolated copy of baseline commit `9e10585`, send `{broken` or a JSON body larger than 12 KB to `POST /api/report`.
- **Observed:** Both returned HTTP 500.
- **Cause:** Express body-parser errors reached the generic 500 handler.
- **Fix:** Map malformed JSON to 400 `INVALID_JSON` and oversized bodies to 413 `PAYLOAD_TOO_LARGE`.
- **Regression coverage:** `test/http.test.mjs`, “returns controlled boundary errors for malformed and oversized JSON.”

### 3. Wake County jurisdiction code `RA` was treated as outside Raleigh

- **Severity:** Medium data-integrity defect
- **Reproduction:** Live report for `222 W Hargett Street` returned `jurisdiction: "RA"` and `inRaleighJurisdiction: false`.
- **Cause:** The code tested only for the literal word “RALEIGH.”
- **Fix:** Added a bounded interpreter accepting `RA` or `RALEIGH`, case-insensitively.
- **Regression coverage:** `test/report.test.mjs`.

### 4. Official Raleigh police-data citation returned 404

- **Severity:** Medium evidence-traceability defect
- **Reproduction:** HEAD request to the stored police source URL returned 404.
- **Cause:** Raleigh moved the service from the Apps, Maps, and Open Data path to the Police service path.
- **Fix:** Updated the source constant and README to `https://raleighnc.gov/police/services/raleighs-crime-data`.
- **Regression coverage:** `test/content.test.mjs`; replacement URL independently returned 200.

### 5. Wayan frontend lacked defense-in-depth security headers

- **Severity:** Medium defense-in-depth risk
- **Reproduction:** Live Wayan response had no CSP, frame restriction, nosniff, referrer, or permissions headers.
- **Cause:** The separate Apache deployment contained static assets but no tracked `.htaccess` header configuration.
- **Fix:** Added `public/.htaccess`; the Wayan build now includes it in `dist/`.
- **Regression coverage:** Artifact inspection verifies `.htaccess` is packaged. The live Wayan response now enforces the policy.

### 6. Candidate lacked canonical and social metadata

- **Severity:** Low discoverability and link-preview defect
- **Reproduction:** Live homepage contained title and description but no canonical or Open Graph fields.
- **Cause:** Metadata was not included in the initial static page.
- **Fix:** Added robots, canonical, and Open Graph metadata.
- **Regression coverage:** `test/content.test.mjs`.

### 7. Existing cached reports retained corrected jurisdiction and citation values

- **Severity:** Medium data-integrity and traceability defect
- **Reproduction:** The first production report after deployment returned jurisdiction `RA` with `inRaleighJurisdiction: false`. Its source summary also retained the superseded police-data URL.
- **Cause:** Neon caches serialized reports, so code corrections did not alter fields already stored in unexpired cache rows.
- **Fix:** Cached reports are normalized on read for Raleigh jurisdiction and both finding-level and source-summary police citations.
- **Regression coverage:** Unit coverage exercises the legacy cache shapes without mutating the original object. The final production check returned `true` for Raleigh and the current official URL in both citation locations.

## Security findings

### Confirmed vulnerabilities

No critical or high-severity vulnerability was confirmed by this test scope. Missing Wayan headers were a confirmed medium defense-in-depth weakness, especially for framing and containment. The deployed header policy now mitigates that weakness, and no exploitable DOM XSS was found.

### Mitigated risks in the published release

- DOM XSS payloads remain text because the frontend uses `textContent` and DOM construction rather than HTML injection.
- Unknown AI citations cause deterministic fallback.
- ArcGIS destinations are fixed and query literals are escaped.
- Neon queries are parameterized and now require certificate verification by default.
- Hostile CORS origins are rejected.
- JSON body size is limited to 12 KB.
- Report generation is rate limited per observed client IP.
- Traversal-shaped static requests return 404.
- The build rejects unsafe public API origins.

### Not fully testable or outside evidence

- Distributed rate limiting across multiple Render instances or restarts.
- Production proxy behavior under forged forwarding headers.
- Full packet-loss, offline, or multi-minute upstream outage behavior.
- Physical assistive-technology testing with VoiceOver, NVDA, or JAWS.
- A complete keyboard-only submission because the browser-control layer changed tabs during that step.
- Cache expiry, stale-row replacement, and concurrent Neon upserts without modifying production data.
- OpenAI vendor-side model behavior beyond the strict-schema mock tests and normal live report.
- The full three-browser primary-flow matrix after the final backend-only cache hotfix. The preceding published frontend passed that matrix and the backend hotfix did not change browser code.
- Destructive payloads, credential attacks, denial-of-service, aggressive load, and third-party scanning were intentionally excluded.

## Exact commands and tools used

Primary commands:

```text
npm ci
npm run check
npm test
npm run lint
node --check src/server.mjs
node --check public/app.js
npm audit --audit-level=low
PUBLIC_API_BASE=https://raleigh-renter-api.onrender.com npm run build:wayan
npm run check:sources -- 222 W Hargett Street
DATABASE_URL= OPENAI_API_KEY= ALLOWED_ORIGINS=http://localhost:3407 PORT=3407 NODE_ENV=production npm start
curl -X POST http://127.0.0.1:3407/api/report -H 'Content-Type: application/json' --data '{"address":"222 W Hargett Street"}'
curl -X POST http://127.0.0.1:3410/api/report -H 'Content-Type: application/json' --data-binary '{broken'
curl https://raleigh-renter-api.onrender.com/api/does-not-exist
curl -X POST https://raleigh-renter-api.onrender.com/api/report -H 'Origin: https://wayan.com' -H 'Content-Type: application/json' --data '{"address":"222 W Hargett Street"}'
curl -X OPTIONS https://raleigh-renter-api.onrender.com/api/report -H 'Origin: https://attacker.example' -H 'Access-Control-Request-Method: POST'
curl -I https://wayan.com/raleigh-renter/
curl -I https://raleigh-renter-api.onrender.com/healthz
git diff --check
git grep -nE 'sk-proj-[A-Za-z0-9_-]{20,}|postgres(ql)?://[^[:space:]]+|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY'
```

Additional tools and manual checks:

- Node built-in test runner for unit and HTTP integration tests.
- ESLint for static analysis.
- jsdom for component and content tests.
- axe-core for automated accessibility checks.
- Browser control for Chromium DOM, responsive, map, and primary-flow checks.
- Firefox and Safari Computer Use for real-browser rendering, accessible-tree, keyboard-focus, and primary-flow checks.
- `curl`, `jq`, `shasum`, `rg`, `du`, and `file` for response, performance, repeatability, artifact, and secret evidence.
- Official Raleigh web search was used only to locate the replacement primary-source police-data URL.

## Evidence files

- `test-artifacts/firefox-live-report.jpeg`, SHA-256 `9a509ce8fb2f951d9b2dfa2a0da2b63d4d8b5db9041ef4fa67c875c0adedb901`
- `test-artifacts/safari-live-report.jpeg`, SHA-256 `1db25355e14cdd5a41b5892d803d95d9a3f208be67b84a32cf7ddf0e45085cfd`
- Automated tests under `test/`
- Apache header policy in `public/.htaccess`
- Production artifact in ignored `dist/`

## Completed release sequence

1. Reviewed, tested, and committed the candidate changes.
2. Pushed the release to public GitHub after explicit authorization.
3. Confirmed Render deployed the corrected API.
4. Uploaded the rebuilt `dist/`, including `.htaccess`, to the Wayan Apache directory.
5. Ran the 28-test regression and source integration checks.
6. Repeated the live API routing, malformed-body, jurisdiction, cached-source-link, Wayan-header, canonical, and primary report checks.
