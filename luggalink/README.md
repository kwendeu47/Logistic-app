# LuggaLink

A peer-to-peer luggage space marketplace where travelers sell unused luggage weight to senders who want to ship items internationally.

## Monorepo structure

```
luggalink/
├── apps/
│   ├── mobile/          # React Native (Expo) app
│   └── api/              # Node.js + Express REST API
├── packages/
│   ├── shared/           # Shared TypeScript types & utilities
│   └── config/           # Shared ESLint, Prettier, TypeScript config
├── docker-compose.yml     # Local PostgreSQL + Redis
└── package.json           # Root npm workspace
```

## Tech stack

- **Mobile:** React Native (Expo SDK 51), TypeScript, React Navigation v6, Zustand
- **API:** Node.js 20, Express 5, TypeScript, Prisma ORM
- **Database:** PostgreSQL 16
- **Cache/queues:** Redis 7
- **Auth:** JWT (access + refresh tokens)
- **Payments:** Stripe (escrow via payment intents)
- **File storage:** AWS S3
- **Push notifications:** Expo Push Notifications

## Prerequisites

- Node.js 20+
- npm 10+
- Docker + Docker Compose (for local Postgres/Redis)
- Expo Go app or a simulator (for mobile development)

## Getting started

### 1. Install dependencies

```bash
npm install
```

This installs dependencies for all workspaces (`apps/*`, `packages/*`).

### 2. Start local infrastructure

```bash
npm run docker:up
```

This starts PostgreSQL (port `5432`) and Redis (port `6379`) using `docker-compose.yml`.

### 3. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Fill in the values (Stripe keys, AWS credentials, JWT secrets, etc.) in each `.env` file.

### 4. Set up the database

```bash
npm run prisma:migrate --workspace=apps/api
npm run prisma:generate --workspace=apps/api
```

### 5. Run the API

```bash
npm run dev:api
```

The API starts on `http://localhost:4000` (see `apps/api/.env`). Health check: `GET /health`.

### 6. Run the mobile app

```bash
npm run dev:mobile
```

This starts the Expo dev server. Scan the QR code with Expo Go, or press `i`/`a` to launch a simulator.

## Workspace packages

- `@luggalink/shared` — shared TypeScript types (`User`, `Trip`, `Booking`, `Payment`, `Notification`) and constants used by both the API and the mobile app.
- `@luggalink/config` — shared ESLint, Prettier, and base `tsconfig.json` used across all packages.

## Useful scripts

| Command | Description |
| --- | --- |
| `npm run dev:api` | Start the API in watch mode |
| `npm run dev:mobile` | Start the Expo dev server |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | Type-check all workspaces |
| `npm run lint` | Lint all workspaces |
| `npm run docker:up` / `docker:down` | Start/stop local Postgres + Redis |

## Status

This repository is currently scaffolding only — no application/business logic has been implemented yet.
