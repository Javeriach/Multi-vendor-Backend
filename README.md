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

## Deployment

Postgres is on Neon and image storage is Cloudinary regardless of where the backend
itself runs. Stripe stays in test mode.

### Database (Neon)

Create a Neon project, copy its connection string into `DATABASE_URL` (see
`.env.example` — the app accepts either a single `DATABASE_URL` or the discrete
`DATABASE_*` fields; `DATABASE_URL` wins if both are set). Run `npm run migration:run`
against it once before first deploy.

If deploying the backend as **serverless** (Vercel), use Neon's **pooled** connection
string (the one with `-pooler` in the hostname, from the Neon dashboard's "Pooled
connection" toggle) instead of the direct one — a serverless function creates many
short-lived connections under load, and Neon's own PgBouncer pooler is built for exactly
that pattern; the direct connection string can exhaust Neon's connection limit under
concurrent invocations. On Render (a single long-running process), either string works.

### Image storage (Cloudinary)

Product photos are never written to local disk (see `src/uploads`) — they upload
straight to Cloudinary via `cloudinary.uploader.upload_stream`, after being normalized
to a 1200×1200 JPEG by `sharp` first. Required in every environment, including local
dev: `CLOUD_NAME`, `CLOUDNARY_API_KEY`, `CLOUDNARY_API_SECRET` (see `.env.example`).

### Backend on Vercel (serverless, WebSockets included)

- `api/index.js` is the serverless entry point (Vercel's convention for anything under
  `/api` at the repo root). It's deliberately plain JS, not TypeScript, requiring the
  **already tsc-compiled** `dist/create-app.js` rather than letting Vercel's own
  esbuild-based Node builder transpile a `.ts` file — esbuild doesn't support
  `emitDecoratorMetadata`, which NestJS's dependency injection depends on, so handing
  Vercel a raw `.ts` entry point here would silently break DI once deployed.
- **It exports the raw `http.Server`, not a `(req, res) => {}` function.** This is
  load-bearing for the `/chat` WebSocket gateway: Vercel's Fluid Compute routes an
  incoming WS handshake as an `upgrade` event on the function's underlying server, and a
  plain request-handler function has no such event to listen on — REST would work but
  chat would silently receive zero connections. The exported server is the same one
  `create-app.ts`'s `IoAdapter` attaches Socket.IO to, so upgrade requests reach it
  exactly like they would on a normal long-running process (Render, local dev). Since
  Nest's bootstrap (DB connection, module wiring) is unavoidably async but Vercel reads
  the export synchronously at module load, the file creates a bare server immediately and
  queues any request/upgrade that arrives before bootstrap finishes, replaying them once
  ready — in practice an empty queue except on the very first cold start.
- **Fluid Compute must be enabled** on the Vercel project (Project Settings → Functions →
  Fluid Compute). Without it, connections aren't held open long enough for a WebSocket
  session to survive.
- Verified locally end-to-end (this exact `api/index.js`, driven as a real server: login,
  WS handshake with cookie auth, `conversation:join`, a live `message:new` delivery) — but
  **not yet verified against real Vercel infrastructure**, since Fluid Compute WS support
  is new enough that I don't have first-hand confirmation NestJS's gateway model behaves
  identically under Vercel's actual request routing versus this local simulation. Test the
  live socket connection immediately after your first deploy (open the deployed site,
  open two accounts, send a chat message) before relying on it. If it doesn't connect,
  Render (below) is the zero-risk fallback — proven working, no Vercel-specific WS
  plumbing required.
- `vercel.json`'s `buildCommand` (`npm run build`) runs `nest build` before the function
  is packaged, so `dist/` exists when `api/index.js` requires it.
- `vercel.json`'s rewrite sends every path to that one function — `/health`,
  `/api/products`, `/api/webhooks/stripe`, all of it — `req.url` is preserved, so the
  Express app inside does its own routing exactly like it does locally.
- Cold starts re-run the full Nest bootstrap (module wiring, DB pool setup); warm
  invocations reuse the already-bootstrapped server.
- Env vars (Vercel dashboard, Production + Preview): `NODE_ENV=production`,
  `DATABASE_URL` (pooled, see above), `JWT_SECRET`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL`, `CORS_ORIGIN`, `CLOUD_NAME`,
  `CLOUDNARY_API_KEY`, `CLOUDNARY_API_SECRET`.
- Stripe webhook URL: `https://<your-vercel-domain>/api/webhooks/stripe`.

### Backend on Render (alternative — persistent process, proven WS support)

Web Service, build command `npm install && npm run build`, start command
`npm run start:prod`. Render sets `PORT` itself — the app already reads
`process.env.PORT` (`main.ts`), no change needed. Health check path: `GET /health`
(deliberately outside the `/api` prefix and auth-exempt — see `src/health`). Same env
vars as above — Cloudinary and Neon are used identically either way. The `/chat` gateway
needs no special handling here: `main.ts` calls `.listen()`, giving Socket.IO a normal
always-on process to attach to, the same model this was originally developed and
extensively tested against.

### Frontend on Vercel

See `marketplace-frontend/.env.example` for its three env vars
(`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`).
`NEXT_PUBLIC_SOCKET_URL` is the backend's origin with no path (Socket.IO owns its own
`/socket.io` transport path plus the `/chat` namespace) — point it at whichever backend
host you actually deployed to, Vercel or Render.

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
