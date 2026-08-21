# marketplace-backend — Phase 2: Database Foundation

NestJS + TypeORM + PostgreSQL backend for the EShop multi-vendor marketplace rebuild.

**This is a new, separate project.** It does not touch `Ecommerce-Backend` (the existing
Express/MongoDB API) or `Ecommerce-Frontend` — both remain available as reference during
the migration.

## Scope of this phase

Database foundation only: 9 entities (`User`, `Vendor`, `Store`, `Category`, `Product`,
`ProductImage`, `ProductVariant`, `Inventory`, `Address`), TypeORM wired into NestJS via
`@nestjs/config` + `@nestjs/typeorm`, and one hand-written initial migration. No auth, no
controllers, no services, no business logic — that starts in later phases.

## Setup

```bash
npm install
cp .env.example .env   # then fill in real DATABASE_* values
```

Requires a running PostgreSQL instance (13+) reachable with the credentials in `.env`.
Nothing in this project starts or manages Postgres for you.

## Commands

| Command | Does |
|---|---|
| `npm run build` | Compiles via `nest build` |
| `npm run start:dev` | Boots the app (DB connection only — no routes yet) |
| `npm run migration:run` | Applies `src/database/migrations/*` against `.env`'s database |
| `npm run migration:revert` | Rolls back the last applied migration |
| `npm run migration:generate -- src/database/migrations/SomeName` | Diffs entities against the live DB and generates a new migration (only meaningful once the initial migration has been applied) |
| `npm run migration:show` | Lists applied/pending migrations |

`synchronize` is intentionally `false` everywhere — schema changes only ever happen
through a reviewed migration file, never automatic sync.

## Deployment (Vercel + Render + Neon)

Target architecture for the hosted demo: frontend on Vercel, this backend on Render,
Postgres on Neon, Stripe in test mode. All free-tier.

- **Database**: create a Neon project, copy its connection string into `DATABASE_URL`
  (see `.env.example` — the app accepts either a single `DATABASE_URL` or the discrete
  `DATABASE_*` fields; `DATABASE_URL` wins if both are set). Run
  `npm run migration:run` against it once before first deploy.
- **Backend on Render**: Web Service, build command `npm install && npm run build`,
  start command `npm run start:prod`. Render sets `PORT` itself — the app already reads
  `process.env.PORT` (`main.ts`), no change needed. Health check path: `GET /health`
  (deliberately outside the `/api` prefix and auth-exempt — see `src/health`).
- **Env vars on Render**: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`,
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL`, `CORS_ORIGIN` (both
  pointed at the deployed Vercel URL).
- **Frontend on Vercel**: see `marketplace-frontend/.env.example` for its two env vars.

**Not yet implemented**: this codebase has no WebSocket/Socket.IO layer (no dependency,
no gateway, no notification/chat modules, on either side) — order updates, notifications,
and chat are all REST-only today. The deployed demo reflects that; real-time delivery
(order status pushes, chat) is a planned addition, not a current feature. When it's
added, the backend already listening on a single Render URL is the natural place for a
Socket.IO server to live alongside the REST API — no separate service needed.

## Structure

```
src/
├── entities/          9 TypeORM entities + enums.ts + index.ts (shared entity list)
├── database/
│   ├── data-source.ts       standalone DataSource for the TypeORM CLI
│   └── migrations/
│       └── 1755280000000-InitialSchema.ts
├── app.module.ts       ConfigModule + TypeOrmModule wiring
└── main.ts            bootstraps the app (no controllers registered yet)
```
