# Tonight

Find films included with UK Netflix, Prime Video, Apple TV and Disney+, ranked using your ratings. No LLM is required.

The public app is hosted on GitHub Pages. Ratings and service choices are stored in each browser's local storage; each device has its own profile. Clearing browser data removes those ratings. The original private Sites app keeps its existing household profile in D1.

Favour AD retains every eligible film and sorts by English audio description confidence first, then taste within each group. Unknown means information is missing, not that AD is absent. Netflix evidence is generally stronger than Prime evidence. Availability and AD information can change; check the service before watching. Rentals, purchases and extra paid channels are excluded.

## Build

Use Node 22 or later:

```sh
npm ci
node build.mjs
node build-catalogue.mjs dist/catalogue/index.js
npm test
node build-pages.mjs
```

`pages-config.json` identifies the public read-only catalogue service. The Pages workflow builds and publishes `pages-dist`. No API credentials are included in the browser files.

The catalogue Worker is built with `node build-catalogue.mjs` in its separate Sites checkout. It exposes only GET search, movie, availability, candidates and metadata routes. It has no database binding and cannot read or write the private household profile. Supply `TMDB_READ_TOKEN` as a secret runtime environment variable, never in source or GitHub Pages. Its hosting manifest uses no D1 or R2 binding. The original app uses `.openai/hosting.json` and its D1 migration for private storage; do not change its access to public.

For private local development, put `TMDB_READ_TOKEN` in an ignored `.env`, run `node build.mjs`, then `npm run dev`. Preview SQLite files are also ignored. AD evidence refreshes are manual: `npm run screen:ad` and `node --env-file=.env screen-prime.mjs`. Sources, dates and screening scope are recorded in the seed/report files. Coverage is incomplete, and evidence expires after 30 days.

Tests cover subscription eligibility, category discovery, AD confidence, taste ranking, paging, revisions, title search, availability and separation of public catalogue from private ratings. Browser checks cover the About dialog and deployed app; native VoiceOver/JAWS speech has not been tested.

Availability: JustWatch via TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.

## Apple TV and Disney+

Netflix and Prime Video remain the only default subscriptions. Saved choices are preserved. Exact base subscription provider names are matched; Apple TV Store and Apple/Amazon paid channels do not qualify. Discovery queries only selected services, while individual title availability checks all supported providers.

`node --env-file=.env screen-additional.mjs` checks a bounded crawl of public UK Apple and Disney movie pages, matches exact title and year, and verifies current UK subscription inclusion. Apple English AD requires the visible UK audio-language section. Disney AD badges do not identify language, but receive high priority: below confirmed English AD and above weaker inferred evidence. They are not relabelled as confirmed English AD. Missing metadata remains unknown. Sources expire after 30 days; this index is not exhaustive. See `src/additional-screening-report.json` for the checked sample and `src/additional-ad-seeds.json` for sources.
