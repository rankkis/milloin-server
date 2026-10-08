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
- The API is public and free to use: any origin may call it (CORS), and its docs are at https://milloin.xyz/api, which milloin-web proxies to this server's Swagger UI. CORS, the OpenAPI document (contact, servers) and Swagger UI are set up in `src/app.setup.ts`, shared by `src/main.ts` and `api/index.ts`
- Rate limit: 60 requests per minute per client IP (`src/shared/config/rate-limit.config.ts`, @nestjs/throttler). The count is kept in memory, so each Vercel function instance counts separately. Requests carrying the `SSR_API_KEY` env var's value in the `x-milloin-ssr-key` header (milloin-web's server-side rendering) are not limited

## Important Reminders

- Always run `npm run lint` before committing
- Run `npm run test` to ensure tests pass
- Use NestJS decorators and patterns
- Follow existing code conventions and file structure
