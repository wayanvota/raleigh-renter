# Raleigh Renter Records

Raleigh Renter Records answers one bounded question: **What public records should I know about before renting this Raleigh address?**

The application resolves an address against Wake County’s nightly address points, obtains the parcel identifier, checks five official public-data systems, classifies each record by what it actually proves, and produces a cited renter-facing summary. It never produces a property safety score.

## Evidence boundaries

- Ask Raleigh records are complaints and service requests. They are not labeled as verified code violations.
- Police incidents are area-level context within 0.25 miles for the prior 12 months. Raleigh intentionally masks portions of incident addresses.
- Flood matching is a point-in-polygon check at the official address point, not a survey of the full parcel.
- Missing records and unavailable sources remain visible. A zero-result search is not evidence that a property has no problems.
- The report links to Raleigh’s records-request process for housing, nuisance, building, and fire-code records that are not available in the open feed.

## Local setup

1. Copy `.env.example` to `.env.local` and set the needed values.
2. Use a pooled Neon connection string for `DATABASE_URL` if caching and source-health history are desired.
3. Run `npm install`.
4. Run `npm test` and `npm run check:sources`.
5. Run `npm run dev`, then open `http://localhost:3000`.

The app works without Neon and falls back to deterministic summaries if OpenAI is unavailable. Neither fallback hides a failed public source.

## Testing

- `npm run check` runs ESLint, compile checks, and the automated unit, component, API, accessibility, abuse-resistance, and content tests.
- `npm run check:sources -- 222 W Hargett Street` checks the live official-data adapters without using OpenAI or writing user input to the database.
- `PUBLIC_API_BASE=https://raleigh-renter-api.onrender.com npm run build:wayan` builds the static production artifact.
- See [`TEST-REPORT.md`](TEST-REPORT.md) for the latest full QA and application-security review.

## Production

- Public site: [wayan.com/raleigh-renter](https://wayan.com/raleigh-renter/)
- API health: [raleigh-renter-api.onrender.com/healthz](https://raleigh-renter-api.onrender.com/healthz)

`render.yaml` defines the Render service. Configure `OPENAI_API_KEY` and `DATABASE_URL` as secret environment variables in Render. Run `PUBLIC_API_BASE=https://raleigh-renter-api.onrender.com npm run build:wayan` to create the static Wayan deployment in `dist/`.

## Privacy

The API does not write raw questions, IP addresses, user agents, or account data to Neon. Cache keys are one-way hashes of canonical public street addresses. The cached report contains only the canonical address and public-record results.

## Official sources

- [Wake County parcel address points](https://data.wake.gov/datasets/bc9728cd700e40cca91e9411bf47876c)
- [Wake County parcels](https://data.wake.gov/datasets/f5ed009c66e844ec82f29064edd95017)
- [Ask Raleigh service requests](https://www.arcgis.com/home/item.html?id=54adb38aba1c4781927e6245dd1409d0)
- [Raleigh building permits](https://data-ral.opendata.arcgis.com/datasets/ral::building-permits/about)
- [Raleigh crime data](https://raleighnc.gov/police/services/raleighs-crime-data)
- [Raleigh address services and floodplain lookup](https://raleighnc.gov/ask-raleigh-fix-report-request/services/find-your-services)
- [Raleigh public-records request](https://raleighnc.gov/ask-raleigh-fix-report-request/services/records-request)
