# Milloin Ence pelaa? - Feature Documentation

## Overview

`GET /ence` answers when ENCE, the Finnish CS2 team, plays next: the running or next match with up to 5 Finnish and English streams, the next matches after it, the latest results and news. `GET /ence/logos/:id` serves copies of the team logos. milloin-web's `/ence-pelaa` page shows them.

## Data Flow

```
PandaScoreProvider ─┐
                    ├→ EnceCacheService (memory + shared cache, hourly) → EnceService → GET /ence
GoogleNewsProvider ─┘        └→ logo copies → GET /ence/logos/:id
```

## Sources

- **Matches, teams, logos and streams: PandaScore** (`providers/pandascore.provider.ts`), the official esports API. Needs a token in `PANDASCORE_TOKEN` (Vercel) or `pandascore.token` in `config/api-keys.json`; the free plan is enough. One refresh makes four requests (ENCE's team id is looked up once per instance).
- **News: Google News RSS search** (`providers/google-news.provider.ts`) for ENCE and CS2 in the last 30 days. A failed news fetch keeps the previous news.
- **HLTV.org is not used**: it has no API and Cloudflare answers every scripted request, even its RSS feed, with a challenge page (tried October 2026). Its pages are linked for visitors only.

More match sources can be added to `TEAM_DATA_PROVIDERS` in `ence.module.ts`; they are tried in order.

## Caching

`EnceCacheService` works like the electricity price cache:

- Data is fetched again when it is over 60 minutes old: on demand (the request waits, concurrent requests share one fetch) and hourly at :05 on long-lived hosts.
- After a failed fetch, older data is served, and upstream is asked again at most every 10 minutes. With nothing cached the endpoint answers 503.
- On Vercel a fresh instance reads what other instances of the same deployment left in the runtime cache (`ENCE_SHARED_CACHE`) before fetching. A new deployment ignores older data and fetches on startup, so a fix shows at once.
- Logos are copied once from the source (images only, at most 512 KB) and kept 30 days; the response gives their paths (`ence/logos/<id>`, relative to the API root), so visitors' browsers never load them from the source.

## Rules (`ence.service.ts`)

- Streams: only Finnish (`fi`) and English (`en`); most viewers first when the source tells (PandaScore doesn't), otherwise official first, then Finnish; at most 5.
- A match is still the next match for 4 hours after its start, since the data can be an hour old. Live scores are not given.

## Testing

`npm test` covers the mapping, stream rules, news parsing and the cache; `npm run test:e2e` the endpoints with a stubbed cache.
