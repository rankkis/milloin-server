# Claude Development Guide - milloin-server

## Project Overview

Backend service for the milloin-web project using NestJS with TypeScript.

## Tech Stack

- **Framework**: NestJS
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
npm run format            # Format code with Prettier

# Testing
npm run test              # Run unit tests
npm run test:watch        # Run tests in watch mode
npm run test:cov          # Run tests with coverage
npm run test:e2e          # Run end-to-end tests
```

## Project Structure

```
src/
├── main.ts              # Application entry point
├── app.module.ts        # Root module
├── app.controller.ts    # Root controller
└── app.service.ts       # Root service

test/
├── app.e2e-spec.ts      # E2E tests
└── jest-e2e.json        # E2E Jest config
```

## Development Notes

- Default port: 3000 (configurable via PORT env var)
- Uses NestJS CLI for scaffolding
- ESLint and Prettier configured for code consistency
- Jest configured for testing with coverage support
- Use zulu-time in dto's

## Important Reminders

- Always run `npm run lint` before committing
- Run `npm run test` to ensure tests pass
- Use NestJS decorators and patterns
- Follow existing code conventions and file structure
- Keep swagger documentation updated
