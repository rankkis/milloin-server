# Claude Development Guide - milloin-server

## Project Overview

Backend service for the milloin-web project using NestJS with TypeScript.

## Tech Stack

- **Runtime**: Node.js 22 (see `.nvmrc`)
- **Framework**: NestJS 10
- **Language**: TypeScript
- **Package Manager**: npm
- **Testing**: Jest
- **Linting**: ESLint + Prettier

## Repository

- **GitHub**: https://github.com/rankkis/milloin-server
- **Related Project**: [milloin-web (frontend)](https://github.com/rankkis/milloin-web)

## Development Commands

```bash
# Development
npm run start:dev          # Start in watch mode
npm run start:debug        # Start with debugging

# Building & Production
npm run build             # Build the project
npm run start:prod        # Run production build

# Code Quality
npm run lint              # Run ESLint with auto-fix
npm run lint:check        # Run ESLint without fixing (CI)
npm run format            # Format code with Prettier
npm run format:check      # Check formatting (CI)

# Testing
npm run test              # Run unit tests
npm run test:watch        # Run tests in watch mode
npm run test:cov          # Run tests with coverage
npm run test:e2e          # Run end-to-end tests (mocked prices, no API keys)
npm run test:integration  # Run integration tests against real ENTSO-E (needs config/api-keys.json)
```

CI (`.github/workflows/ci.yml`) runs lint, format check, unit tests, e2e tests and build on every pull request.

## Project Structure

```
src/
├── main.ts              # Application entry point
├── app.module.ts        # Root module
├── app.controller.ts    # Root controller
└── app.service.ts       # Root service

test/
├── app.e2e-spec.ts      # E2E tests with mocked electricity prices
├── jest-e2e.json        # E2E Jest config
├── integration/         # Tests against real ENTSO-E
└── jest-integration.json
```

## Version control notes

- Prefer github flow by using feature-branches
- Always squeeze commits in feature branches before it is merged with master branch
- Use rebase always to prevent merge commits in history

## Deployment Notes

- Execute prettier, linter and run tests before production deployment
- Verify that swagger documentation is updated
- After deployment verify service health

## Development Notes

- Default port: 3000 (configurable via PORT env var)
- Uses NestJS CLI for scaffolding
- ESLint and Prettier configured for code consistency
- Jest configured for testing with coverage support
- Use zulu-time in dto's
- The API is public and free to use: any origin may call it (CORS), and its developer docs are milloin-web's https://milloin.xyz/docs (guides and a reference drawn from this server's OpenAPI document, `/api-json`); https://milloin.xyz/api redirects there. This server's own Swagger UI stays at `/api`. CORS, the OpenAPI document (contact, servers) and Swagger UI are set up in `src/app.setup.ts`, shared by `src/main.ts` and `api/index.ts`
- `GET /ence` (milloin-web's "Milloin Ence pelaa?"): ENCE's next CS2 match, streams, results and news from PandaScore (`PANDASCORE_TOKEN`) and Google News, refreshed hourly; see `src/ence/FEATURE.md`. It is milloin-web's own endpoint, left out of the public OpenAPI document (`@ApiExcludeController`)
- Public API v1 (`src/v1/`): `GET /v1/prices` (from, to, resolution=15min|hour), `GET /v1/prices/current`, `GET /v1/plans` (when to run a load: continuous runs ranked, or with `pausable=true` the cheapest plan in blocks; `activeNow` and `nextChangeAt` for devices; `earliestStart` may be in the past or `today` so the plan stays put), `POST /v1/plans/search` (same plus `profileKwh` and `startTimes`), `GET /v1/health` (status ok|late, pricesUntil, tomorrowPublished, nextPricesExpectedAt, source, fetchedAt; the same freshness fields are in `/v1/prices` meta), `GET /v1/plans/presets` and `/v1/plans/presets/{name}` (`src/v1/plans/plan-presets.ts`; query parameters override). The plan calculations are in `src/pricing/plans.ts`. The routes before /v1 (`/overview`, `/optimal-window`, `/optimal-schedule`) send Deprecation and Sunset (31 Dec 2026) headers (`src/shared/http/deprecated.ts`). Prices and plans take `vat=false` (prices without VAT; categories still judged with VAT) and `area` (only FI); plans also `resolution=hour` (plans on hourly averages, starts on full hours). Each price also has `dayCategory`, its quintile within its Finnish day (`src/pricing/day-category.ts`). Times in requests may carry a UTC offset (a `+` that a URL turned into a space is restored, `src/v1/common/time-query.ts`); responses are always Zulu. Every error is `application/problem+json` (`src/shared/http/problem-details.ts`), with the invalid fields listed on validation errors. OpenAPI operationIds are the controller method names, so method names must be unique across controllers
- Pricing: calculations are plain functions in `src/pricing/` on `PricePoint`s in c/kWh (not rounded); `ElectricityPriceService` converts the providers' €/kWh once and services round only their output. Services take the time from the injected `Clock` (`src/shared/clock/clock.ts`), not `Date.now()`. Request DTOs are validated by the global `ValidationPipe` in `app.module.ts`
- HTTP caching: GET responses get `Cache-Control` from the global `HttpCacheInterceptor` (`src/shared/http/http-cache.ts`): up to the next quarter hour by default, a fixed time with `@HttpCache(seconds)`, `no-store` on errors. Vercel's CDN serves repeat requests without running the function. POSTs are not cached
- Rate limit: 60 requests per minute per client IP (`src/shared/config/rate-limit.config.ts`, @nestjs/throttler). The count is kept in memory, so each Vercel function instance counts separately. Requests carrying the `SSR_API_KEY` env var's value in the `x-milloin-ssr-key` header (milloin-web's server-side rendering) are not limited

## Important Reminders

- Always run `npm run lint` before committing
- Run `npm run test` to ensure tests pass
- Use NestJS decorators and patterns
- Follow existing code conventions and file structure
