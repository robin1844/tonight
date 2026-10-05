# Tonight

Private browser app for a shared household taste profile and UK base Netflix/Prime film recommendations. No LLM or runtime AI service.

## Functionality

- Search any film and save loved/liked/disliked/seen/unseen/not-tonight feedback.
- D1 stores the shared profile, including subscriptions, chosen genre and ratings. Revision checks prevent concurrent tabs silently overwriting each other's edits.
- Live TMDB/JustWatch subscription discovery and per-film UK offer verification. Rentals, purchases and paid channels are excluded. Provider IDs are resolved from exact base-service names.
- Movie metadata keywords, cast, directors and genres drive explainable weighted ranking. Already seen titles are excluded. Not tonight temporarily dismisses a title without creating a dislike.
- English AD-only uses four individually checked Netflix films, joined to current eligible Netflix offers. Unknown AD is excluded. Evidence expires after 30 days. This is explicitly limited coverage, not a complete AD catalogue.
- Six suggestions at a time. Another selection retrieves the next discovery page. Search and taste learning work in every genre; candidate ranking is within the loaded page, not a claim to score every film in the catalogue.
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

AD evidence was checked on the official UK Netflix title pages on 5 October 2026: Isn't It Romantic, The Noel Diary, Persuasion and Our Souls at Night. The source/date accompanies each positive record in `src/ad-seeds.json`. There is no production scraper or invented AD inference. Prime AD remains unverified. To extend coverage, verify official UK movie audio metadata and correct TMDB identity, then append positive evidence records with their actual check date.

This first version covers films; series need episode-aware AD and availability handling.

The Site is owner-private. Its one shared household record assumes that audience; do not expand access without reviewing the profile ownership model.

## Validation

29 unit/integration checks cover eligibility, AD joins, recommendation weights, SQL persistence, optimistic revisions, invalid inputs and cross-origin write rejection. Live local endpoints successfully retrieved UK Netflix/Prime offers and all four checked AD titles. Browser checks verified search, a saved rating surviving reload, AD-only results, loaded posters and responsive layout. Native VoiceOver/JAWS speech has not been tested.

One optional read-only WebMCP tool reports the visible selection. Valid and invalid calls were tested in the supported browser. It invokes no AI and does not change app state.

Availability attribution: JustWatch via TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
