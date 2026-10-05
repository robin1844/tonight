# Tonight

Private browser app for a shared household taste profile and UK base Netflix/Prime film recommendations. No LLM or runtime AI service.

## Functionality

- Search any film and save loved/liked/disliked/seen/unseen/not-tonight feedback.
- D1 stores the shared profile, including subscriptions, chosen genre and ratings. Revision checks prevent concurrent tabs silently overwriting each other's edits.
- Live TMDB/JustWatch subscription discovery and per-film UK offer verification. Rentals, purchases and paid channels are excluded. Provider IDs are resolved from exact base-service names.
- Movie metadata keywords, cast, directors and genres drive explainable weighted ranking. Explicit Netflix category evidence supplements missing TMDB romcom labels. Already seen titles are excluded. Not tonight temporarily dismisses a title without creating a dislike.
- Favour AD sorts by confirmed, likely, possible and unknown English AD evidence without excluding any eligible films. Evidence expires after 30 days; coverage remains incomplete.
- Six suggestions at a time. Another selection visits remaining loaded matches before retrieving the next discovery page. The full checked evidence index is merged into the same candidate pool in both preference modes; taste matching ranks within loaded films.
- The category list is curated: Romantic comedy, Romance, Comedy, Drama, Crime, Thriller, Mystery, Horror, Science fiction, Fantasy, Documentary, Action & adventure, Animation, Family, History, War and Music. TV Movie is omitted because it describes format; Western is omitted at Robin's request. Existing saved category choices are retained or mapped to their corresponding new category without changing ratings. A removed category falls back to Any genre.
- Romantic comedy searches two independent subscription-only discovery routes: Romance AND Comedy, and TMDB's exact romcom keyword (9799, verified through keyword search). The routes are merged and deduplicated, with balanced half-page windows so neither route's remaining results are discarded. Classification is applied again to detailed movie metadata and during ranking. Action & adventure accepts either genre. Missing source labels still limit coverage.
- Visible native controls, skip link, labelled rating inputs, polite updates, keyboard focus management, responsive layout and reduced-motion support.

## Development

```powershell
npm install
npm run build
npm test
npm run dev
```

Local `.env` contains `TMDB_READ_TOKEN`. Production receives it as a Sites secret; it is never part of the client bundle or source archive. Preview uses SQLite with the generated Drizzle migration; production uses the declared D1 binding `DB`. The preview database is ignored by Git and excluded from deployment. Build before starting/restarting preview after source changes.

## Coverage and limits

Availability refreshes on use with at most a one-hour catalogue cache. Feed updates can lag behind the services. Basic Netflix/Prime subscriptions are supported; Netflix advert-tier exceptions have not been independently verified. TMDB viewing-option links are used where a verified direct service title link is unavailable.

AD screening on 5 October 2026 checked 364 movie/title pages discovered from Netflix UK's public romantic comedy and romance browse lists, plus known references. It found 151 movie pages with explicit English AD; 102 mapped uniquely by title/year to TMDB. Ambiguous identities are excluded. Of 81 Netflix-classified romcoms in that index, 77 passed current UK Netflix subscription checks. These counts describe this run and can change. Prime AD is unverified.

Run `npm run screen:ad` to rediscover and recheck those public pages, then build and publish the refreshed index. This is an operator-run refresh, not an unattended schedule. Individual sources/dates are stored in `src/ad-seeds.json`; screening statistics and scope are in `src/ad-screening-report.json`. No sign-in, CAPTCHA bypass, LLM inference or audio-language guess is used.

Love at First Sight exposes English AD on its UK Netflix title page. TMDB labels it Romance/Drama without a romcom keyword. Netflix's official Media Center explicitly calls it a romantic comedy, so that source is recorded as additional category evidence. Both the regular and AD-only searches include such verified Netflix classifications.

This first version covers films; series need episode-aware AD and availability handling.

The Site is owner-private. Its one shared household record assumes that audience; do not expand access without reviewing the profile ownership model.

## Validation

39 unit/integration checks cover category membership, both romcom discovery routes, pagination coverage, eligibility, AD joins, recommendation weights, SQL persistence, optimistic revisions, invalid inputs and cross-origin write rejection. Live local endpoints successfully retrieved UK Netflix/Prime offers and all four checked AD titles. The category update's live check caught The Lost City through the romcom keyword despite it lacking the Romance/Comedy pair. Browser checks verified search, a saved rating surviving reload, AD-only results, loaded posters and responsive layout. Native VoiceOver/JAWS speech has not been tested.

One optional read-only WebMCP tool reports the visible selection. Valid and invalid calls were tested in the supported browser. It invokes no AI and does not change app state.

Availability attribution: JustWatch via TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.


## AD preference and Prime sample (5 October 2026)

The UI now uses Favour AD, not AD-only. All eligible films remain available; confirmed service/UK English AD ranks ahead of likely, possible and unknown, with taste ordering each group. The complete checked evidence index is loaded alongside normal discovery, so known AD films are not trapped on later discovery pages. Switching the checkbox reorders the same loaded set. Ratings, subscriptions and source explanations remain available behind disclosures.

The fixed 12-film popularity-ordered GB Prime romcom convenience sample was rechecked per title for base Prime inclusion: 12/12 qualify. Five have original-version English AD evidence on public Prime pages (two direct-page checks, three reviewed web retrievals). One has evidence only on an ASL version and is possible. Six remain unknown. None is confirmed for the UK account/version. These proportions measure positive evidence found in this small sample, not actual AD prevalence or recall for the full catalogue. Nine direct page fetches failed; missing metadata never means AD is absent. The report and sources are in src/prime-screening-report.json; reviewed fallback evidence retains its original date and expires after 30 days. Run node --env-file=.env screen-prime.mjs to repeat the fixed sample, then build and publish. Refreshes are manual.

## Cleaner listings and title suggestions

All loaded eligible films are rendered together without six-film selection pages. Additional discovery pages are fetched near the end of the list; the focusable continuation also triggers fetching for keyboard navigation. The entire remote catalogue is not fetched upfront. Favour AD and taste ranking remain active. Card explanations, AD badges/evidence, process counts and checkbox description have been removed. Provider credits remain inside How Tonight works. Watch links have identical visible and accessible names: View on Netflix / View on Prime.

Title search now provides debounced suggestions from TMDB multi-search, filters out people, and opens the selected exact movie/TV identity. Emily in Paris can be rated, with TV ratings stored under a separate ID namespace; recommendations remain films. Browser form-history suggestions are disabled on this input.
