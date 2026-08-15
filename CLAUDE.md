# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gym management SaaS with role-based access (superadmin, admin, entrenador, socio) and
multi-gym (multi-tenant) data isolation: memberships, routines, attendance check-in,
payments, news and member progress.

**Monorepo** — frontend and backend are versioned together so an API change and its
consumer fit in one commit. There is **no root `package.json`**: each project installs
and runs its own dependencies.

| Path                       | Contents                                                            |
| -------------------------- | ------------------------------------------------------------------- |
| `backend/`                 | Express 5 + Prisma (PostgreSQL), JWT auth. Deployed to Vercel *and* GHCR/Docker |
| `frontend/gym-aplication/` | Angular 21 standalone + Tailwind v4, PWA, Capacitor (Android/iOS)    |
| `docs/`                    | Project context, user stories, subdomain and deployment guides       |

**Migrated from MongoDB/Mongoose to PostgreSQL/Prisma** (2026-08-15). Every primary key is
still the original 24-hex-char Mongo `ObjectId` string, stored as `CHAR(24)` — this was a
deliberate choice so the one-time data migration was a straight 1:1 copy with zero FK
remapping, and so 8h JWTs issued before the cutover kept working. New rows generate the same
24-hex format via a Prisma extension (`bson.ObjectId().toHexString()`), not native UUIDs.

## Commands

```bash
# Backend (needs backend/.env — see backend/.env.example)
cd backend
npm install
npm start                          # nodemon index.js → http://localhost:10000
npm test                           # Vitest (node env, tests/**/*.test.js)
npx vitest run tests/auth.test.js  # single file
npx vitest run -t "verificarToken" # single test by name
node scripts/crear-superadmin.js   # bootstrap a superadmin user
npx prisma migrate dev             # create+apply a new migration from schema.prisma changes
npx prisma studio                  # browse the DB in a local GUI

# One-time Mongo → Postgres data migration (see "Data layer conventions" below); dry-run by
# default, prints counts and touches nothing until CONFIRMAR_MIGRACION=si:
node scripts/etl-mongo-to-postgres.js
CONFIRMAR_MIGRACION=si node scripts/etl-mongo-to-postgres.js   # writes for real

# Email in dev: Mailpit captures every message instead of delivering it
docker compose -f docker-compose.local.yml up -d mailpit   # SMTP :1026, inbox http://localhost:8026
# then set SMTP_HOST=127.0.0.1 / SMTP_PORT=1026 in backend/.env
# Non-standard ports on purpose: other projects on this machine own 1025/8025.

# Frontend
cd frontend/gym-aplication
npm install
npm start                          # ng serve → http://localhost:4200
npm run build                      # ng build (producción) → dist/frontend/browser
npm test                           # ng test (Angular 21 unit-test builder, Vitest + jsdom)
npm test -- --include src/app/guards/auth.spec.ts   # single spec
npm run e2e                        # Playwright (needs a dev server already running on :4200)

# Android / iOS (Capacitor) — webDir is dist/frontend/browser, so a web build must run first
npm run android:sync               # ng build + cap sync android
npm run android:open               # …+ open Android Studio
```

There is **no linter configured** (no ESLint). Formatting is Prettier, configured inline in
`frontend/gym-aplication/package.json` (100 cols, single quotes, `angular` parser for HTML).

**Backend env vars** (`backend/.env.example`): `DATABASE_URL` (Postgres connection string,
consumed by [prisma/client.js](backend/prisma/client.js) via `@prisma/adapter-pg` — Prisma 7
no longer accepts a `url` in `schema.prisma` itself, only `prisma.config.ts` for the CLI and
this env var for the runtime client), `JWT_SECRET` (both are
*hard* requirements — `index.js` throws at boot if missing), `GOOGLE_CLIENT_ID`,
`GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `EMAIL_USER`, `EMAIL_PASS`,
`FRONTEND_URL`, `NODE_ENV`, `PORT`, `TENANT_ROOT_DOMAIN`, and optionally
`WHATSAPP_TOKEN`/`WHATSAPP_PHONE_ID`/`WHATSAPP_TEMPLATE`/`WHATSAPP_LANG`.

Mail goes through [helpers/email.js](backend/helpers/email.js), which picks its transport
from env: **`SMTP_HOST` set → plain SMTP** (Mailpit in dev, no credentials needed) and Gmail
is ignored entirely; otherwise `EMAIL_USER`/`EMAIL_PASS` over Gmail (production). Leave the
`SMTP_*` vars empty in production. `emailConfigurado()` is the single check for "can we send
at all" — use it instead of testing `EMAIL_USER` directly, or the dev setup breaks.

**CI** (`.github/workflows/`, each triggered only by changes in its own area):
`backend-docker.yml` / `frontend-docker.yml` publish images to GHCR,
`android-build.yml` produces a debug APK artifact, `ios-build.yml` builds unsigned iOS.

**Two unrelated docker-compose files, don't confuse them**: root
[docker-compose.local.yml](docker-compose.local.yml) builds everything from source
(postgres + Mailpit + backend + frontend) for local dev or self-hosting without Vercel —
configure via a root `.env` copied from `.env.docker.example`. [backend/docker-compose.yml](backend/docker-compose.yml)
instead *pulls* the prebuilt GHCR images for a real deployment and is configured via
`backend/.env.example`-style vars (`DATABASE_URL` pointing at wherever Postgres ends up
living near the deploy target — no bundled DB container there).

## Architecture

### Multi-gym isolation (the central invariant)

Every domain table carries `gymId`. The JWT payload carries `gymId`, the auth
middleware puts it on `req.gymId`, and **every query must filter by it** — that is the
only thing keeping gym A's data out of gym B.

Users pick a gym at `/gimnasios` before logging in; the choice lives in
`localStorage.gymActual` and survives logout/token expiry.

**Subdomain-per-gym** (implemented, waiting on a domain purchase): on
`<slug>.<tenantRootDomain>` a `provideAppInitializer` in
[app.config.ts](frontend/gym-aplication/src/app/app.config.ts) resolves the gym by slug and
applies its theme before routing, and [tenant.guard.ts](frontend/gym-aplication/src/app/guards/tenant.guard.ts)
skips the selector. Configured by `tenantRootDomain` (frontend environments) and
`TENANT_ROOT_DOMAIN` (backend CORS). Dev: `http://<slug>.localhost:4200`.
Guide: [docs/SUBDOMINIOS.md](docs/SUBDOMINIOS.md).

### Roles and authorization

Four roles, each with its own dashboard shell and route tree:

| Role         | Entry route          | Scope                                                       |
| ------------ | -------------------- | ----------------------------------------------------------- |
| `superadmin` | `/sa`, `/plataforma` | Platform level: creates/edits gyms, colors, modules, slug     |
| `admin`      | `/admin/*`           | Everything inside one gym (socios, rutinas, recepción, matrícula, settings) |
| `entrenador` | `/entrenador/*`      | Only the socios whose `entrenadorId` points at them           |
| `socio`      | `/socio/*`           | Only their own data                                           |

- Client side: [auth.ts](frontend/gym-aplication/src/app/guards/auth.ts) decodes the JWT and
  bounces anyone browsing outside their zone to *their* root (`rootPorRol`). This is UX only.
- Server side ([middleware/auth.js](backend/middleware/auth.js)) is the actual security:
  `verificarToken` → `req.userId`/`req.userRole`/`req.gymId`; `soloAdmin`, `soloSuperAdmin`;
  plus two helpers that exist to prevent IDOR and **should be used instead of trusting
  client-supplied ids**: `resolverUsuarioId(req, solicitado)` (admins may act on another
  user, socios/entrenadores are forced to themselves) and `filtroPropiedad(req)` (adds
  `usuarioId: req.userId` for non-admins).

### Auth flow

JWT expires in 8 hours. Google OAuth (web popup + native Credential Manager on Android),
optional TOTP 2FA (`/api/2fa`, hand-rolled RFC 6238 on `crypto`, no external dep), email
verification tokens, and password reset by nodemailer.

The [auth.interceptor.ts](frontend/gym-aplication/src/app/interceptors/auth.interceptor.ts):
- attaches `Authorization: Bearer <token>` and **deliberately does not send a `user-id`
  header** — the backend identifies the caller only from the verified JWT;
- on `401` clears the session and redirects to `/login`, **except** on the public auth
  endpoints, where 401 means "bad credentials", not "expired session";
- adds `timeout(20000)` plus retries **for GET only** (non-idempotent verbs are never retried).

[TokenMonitorService](frontend/gym-aplication/src/app/services/token-monitor.service.ts) polls
every 60s, auto-renews under 2h remaining, warns under 30min, and logs out on expiry.

### Backend request pipeline ([index.js](backend/index.js))

Order matters: `helmet` (with `crossOriginOpenerPolicy: same-origin-allow-popups`, needed
for the Google popup) → `compression` → CORS → body parsers (10mb) → DB connection
middleware → rate limits → routes → 404 handler → global error handler.

- **CORS is an explicit allowlist**, not a wildcard: `FRONTEND_URL`, the production Vercel
  URL, any `*.localhost` (for dev subdomain tenancy), Capacitor origins
  (`capacitor://localhost`, `ionic://localhost`), and `https://<slug>.TENANT_ROOT_DOMAIN`.
  Allowed headers are only `Content-Type` and `Authorization`.
- **Rate limits**: 30 req/15min per IP on the auth endpoints and `/api/2fa/verify`,
  300 req/15min on the rest of `/api`. `app.set('trust proxy', 1)` makes per-IP limiting
  work behind Vercel.
- **Serverless connection reuse**: `cachedDb` plus a `connectingPromise` lock so parallel
  requests during a cold start share one connection attempt instead of racing; the lock is
  cleared on failure so the next request can retry. This shape predates the Postgres
  migration and was deliberately left untouched — only what's *inside* `connectDB()` changed
  (it now builds/warms the Prisma client via `getPrismaClient()` instead of calling
  `mongoose.connect`). It's a vestige of the original Vercel-serverless design; once the
  project finishes moving to a persistent VPS process this lock stops being necessary
  (Prisma's own connection pool handles concurrency fine on its own) but nobody's cleaned
  it up yet.
- **Two entry points**: `index.js` exports the app and only calls `listen()` when
  `NODE_ENV !== 'production'` (Vercel imports it). `server.js` exists for the Docker image,
  which runs with `NODE_ENV=production` and *must* listen. Don't merge them.

### Data layer conventions

The Prisma client is a singleton built once by
[prisma/client.js](backend/prisma/client.js) (`getPrismaClient()`) and composed from two
[Client Extensions](backend/prisma/extensions/) — always get it from there, never
`new PrismaClient()` directly in a route:

- **Soft delete** ([prisma/extensions/softDelete.js](backend/prisma/extensions/softDelete.js))
  replaces the old Mongoose plugin. Applied to the same 7 models as before — Gym, User,
  Rutina, Noticia, Plan, MetodoPago, Transaccion — via `SOFT_DELETE_MODELS`. It intercepts
  `findMany/findFirst/findUnique/count/update/updateMany` and **silently injects
  `deletedAt: null` into `where`**. To see deleted rows, opt in per-query with
  `{ ..., withDeleted: true }` (a sentinel the extension strips before the real query runs —
  it is *not* a real Prisma option). Delete with `model.softDelete(where)`, undo with
  `model.restore(where)` (statics the extension adds to every soft-deletable model). This is
  still the most surprising behavior in the backend — a "missing" row is usually
  soft-deleted. The extension's pure logic (`applyFilter`, `argsSoftDelete`, `argsRestore`,
  `interceptar`) is exported separately so it's unit-testable without a live DB — see
  [tests/softdelete.test.js](backend/tests/softdelete.test.js).
- **ObjectId-style ids** ([prisma/extensions/objectId.js](backend/prisma/extensions/objectId.js))
  auto-generates a 24-hex `id` on `create`/`createMany` when one isn't supplied. **It only
  intercepts top-level operations** (`prisma.rutina.create(...)`) — a nested relation write
  (`{ ejercicios: { create: [...] } }`) does *not* go through this hook, so nested creates
  must generate their own id by hand (see `ejerciciosParaCrear` in
  [lib/rutinaMapper.js](backend/lib/rutinaMapper.js)). Forgetting this on a new nested-create
  call site fails loudly (`Argument \`id\` is missing`), not silently.
- **Audit trail**: `registrarAuditoria(req, 'ACCION', { recurso, recursoId, detalle })`
  ([helpers/audit.js](backend/helpers/audit.js)) writes an `AuditLog` row and never throws, so a
  failed log can't take down a successful operation. Call it on sensitive admin/superadmin ops.
- **Email is unique per gym**, not globally: `@@unique([email, gymId])` on `User` — the same
  person can belong to two gyms. Postgres treats every `NULL` in a composite unique as
  distinct, which would let two superadmins (`gymId = null`) share an email; a *hand-written*
  partial unique index in the init migration (`users_superadmin_email_key ... WHERE gym_id IS
  NULL`) closes that gap. Prisma's schema language can't express partial indexes, so this
  lives directly in `prisma/migrations/20260815000000_init/migration.sql`, not in
  `schema.prisma` — don't expect `prisma migrate diff` to regenerate it if the migration is
  ever reset.
- **`password` and the 2FA/token fields are hidden by default via Prisma's `omit` API**
  (configured once in `prisma/client.js`), the relational equivalent of Mongoose's
  `select: false`. To read one, pass `{ omit: { password: false } }` on that specific query
  (see `auth.js` login/cambiar-password, `twofa.js`) — there is no per-schema-field
  declarative flag for this in Postgres/Prisma.
- **Pagination is backward-compatible**: without `?page` a route returns a plain array; with
  `?page` it returns `{ data, total, page, limit, pages }`. This used to be six separate
  copies of the same math; it's now one shared helper,
  [lib/pagination.js](backend/lib/pagination.js) (`paginar(req, prisma.model, { where,
  orderBy, defaultLimit })`) — use it for any new paginated list endpoint instead of
  reimplementing the skip/take arithmetic.
- **Search is ILIKE, not regex**: [lib/searchFilters.js](backend/lib/searchFilters.js)
  (`ilikeContains(field, term)`, `personaSearchWhere(gymId, q)`) replaces the three
  independent regex-based search implementations that used to live in `buscador.js`,
  `admin.js` and `asistencia.js`.
- **Nested JSON shapes are flattened into columns, and reconstructed at the API boundary.**
  Mongoose's `datosPersonales`, `stats`, `twoFactor` (on `User`) and `colores`, `modulos` (on
  `Gym`) are now plain flat columns (`identificacion`, `telefono`, `racha`,
  `asistenciasMes`, `twoFactorEnabled`, `colorPrimario`, `moduloRutinas`, …) — there is no
  nested JSON column. **The frontend was not touched and still expects the old nested
  shape**, so every route that returns a full `User` or `Gym` re-nests it with
  [lib/userMapper.js](backend/lib/userMapper.js) (`toApiUser`, `fromApiDatosPersonales`) or
  [lib/gymMapper.js](backend/lib/gymMapper.js) (`toApiGym`, `fromApiGymConfig`) — and
  `_id`/`id` too: Prisma rows carry `.id`, the API still answers with `_id`, so `id` gets
  stripped and remapped, never left duplicated alongside `_id` in a JSON response.
  `Rutina.ejercicios` similarly went from an embedded array to a child table
  (`rutina_ejercicios`, with an explicit `orden` column standing in for array position) —
  reshaped by [lib/rutinaMapper.js](backend/lib/rutinaMapper.js) (`conRutina`,
  `ejerciciosParaCrear`). If you add a field to any of these nested groups, update the model
  *and* its mapper, or it'll silently vanish between Postgres and the JSON response.
- Membership dates are `fechaRegistro` / `fechaVencimiento`; `codigoAcceso` is the 6-digit
  check-in code encoded in the member's QR. `Plan.precio` and `Transaccion.monto` are
  `Decimal`, not float — compare/format with `Prisma.Decimal`, not `===`/`+`.
- `transacciones.js`'s payment-registration endpoint wraps the `User.fechaVencimiento` update
  and the `Transaccion` insert in a real `prisma.$transaction([...])` — the original Mongoose
  code had zero atomicity there (two independent `.save()` calls); this is a genuine
  correctness improvement made during the migration, not just parity.

### Domain modules (API ↔ UI)

| API                  | Frontend surface                        | Notes |
| -------------------- | --------------------------------------- | ----- |
| `/api/auth`          | login/register/reset, perfil, renovación | Google OAuth, refresh-token, paginated `/usuarios` |
| `/api/asistencia`    | `admin/recepcion`, socio QR in `perfil`  | check-in by código/QR/manual, días restantes, WhatsApp receipt |
| `/api/transacciones` | `admin/matricula`, `pagos`               | registering a payment extends `fechaVencimiento` and stores history |
| `/api/entrenador`    | `entrenador/mis-socios`, `socio/:id`     | scoped by `entrenadorId`, guarded by an inline `soloEntrenador` |
| `/api/admin`         | admin settings                           | CSV export/import of usuarios & transacciones, audit log viewer |
| `/api/2fa`           | settings                                 | TOTP enroll/verify + backup codes |
| `/api/gym`           | superadmin `/plataforma`, gym selector   | slug, colores, módulos, `spotifyPlaylist` |
| `/api/rutinas`, `/api/noticias`, `/api/planes`, `/api/pagos`, `/api/progreso`, `/api/medidas`, `/api/feedback` | admin CRUD + socio views | progreso/medidas charted with Chart.js |

`Gym.modulos` (rutinas, progreso, medidas, pagos, noticias, cronometro) toggles features per
gym — check it before assuming a section is visible. `/health` returns `{status:'ok'}`.

### Frontend structure

- All routes are lazy (`loadComponent`) with `PreloadAllModules`; `noticias`/`planes`/`pagos`
  are declared once as `sharedRoutes` and spread into both the admin and socio trees.
- Services wrap HTTP calls and build every URL from `environment.apiUrl`; components contain
  no hardcoded hosts.
- **Theming**: `Gym.colores.navbar` is the single "principal" color —
  [theme.service.ts](frontend/gym-aplication/src/app/services/theme.service.ts) deliberately
  writes it into `--color-navbar`, `--color-primario`, `--color-menu` and `--color-dias` at
  once, ignoring older per-element values, so a gym only picks one color.
- **Storage**: never call `localStorage.clear()`. Use
  [StorageService](frontend/gym-aplication/src/app/services/storage.service.ts)
  (`clearSessionPreservingData()`, `isTokenExpired()`, `decodeTokenPayload()`), which keeps
  the timer, theme and gym selection. The cronómetro also persists in IndexedDB
  ([indexed-db.service.ts](frontend/gym-aplication/src/app/services/indexed-db.service.ts))
  so it survives a localStorage wipe, and fires a native local notification on Android.
- `GlobalErrorHandler` in [app.config.ts](frontend/gym-aplication/src/app/app.config.ts)
  surfaces uncaught errors through the toast service.
- **i18n**: [i18n.service.ts](frontend/gym-aplication/src/app/services/i18n.service.ts) is a
  dependency-free dot-path lookup over `assets/i18n/<lang>.json` (es/en). Add keys to *both*
  files; a missing key falls back to the key itself.
- Exercise data is a static catalog ([src/data/ejercicios-catalogo.ts](frontend/gym-aplication/src/data/ejercicios-catalogo.ts))
  with assets in `public/ejercicios/`; exercises are **copied** into a routine, not referenced.
- PWA: service worker via [ngsw-config.json](frontend/gym-aplication/ngsw-config.json) (prod
  builds only), manifest in `public/`, updates handled by `update.service.ts`.

### Testing

- Backend: Vitest with `globals: false` (import `describe`/`it`/`expect` explicitly).
  [tests/setup.js](backend/tests/setup.js) sets `JWT_SECRET`/`DATABASE_URL` *before* app
  modules load, because they read env at import time — the `DATABASE_URL` fallback is a
  bogus connection string (`postgresql://noop:noop@localhost:5432/test-noop`), never a real
  DB: constructing the Prisma client via `@prisma/adapter-pg` doesn't connect eagerly, so
  requiring a route module in a test is safe as long as the test never actually issues a
  query. Tests use stubbed `req`/`res`/`next` and pure helpers exported off routers
  (`router.miHelper = miHelper`); there is no live Postgres in the suite — don't write tests
  that need one. `tests/softdelete.test.js` is the template for testing Prisma-extension
  logic this way: it calls the extension's exported pure functions
  (`applyFilter`/`interceptar`/`argsSoftDelete`/`argsRestore`) directly with a `vi.fn()` spy
  standing in for the downstream `query`, instead of hitting a real database.
- Frontend: `@angular/build:unit-test` (Vitest + jsdom + `fake-indexeddb`), specs colocated
  as `*.spec.ts`, HTTP tested with `provideHttpClientTesting` + `HttpTestingController`.
- E2E: Playwright specs in `e2e/` using semantic selectors; `webServer` is intentionally
  commented out, so start `npm start` yourself first.

## Gotchas

- **Dev API port mismatch**: `environment.ts` points at `http://localhost:3000` while the
  backend defaults to `PORT=10000`. Set `PORT=3000` in `backend/.env` (or edit the
  environment file), otherwise every dev request hits the wrong port.
- **Never flatten Tailwind v4's cascade layers.** Every build path — `ng serve`, `npm run
  build`, Vercel, Docker, `android:sync`, CI — must ship the CSS with its `@layer` rules
  intact. A `scripts/flatten-layers.mjs` step existed until 2026-08-05 and **broke the
  styling**: flattening emulates layer order by inflating specificity, turning Tailwind's
  preflight into `button:not(#\#):not(#\#)` — specificity (0,2,1) — while an Angular
  component style is `.btn-login[_ngcontent-x]` — (0,2,0). Preflight won by one element and
  overrode `background` and `border-radius` on *every* component-styled button and input
  (on `/login` the submit button turned white, square and full-bleed). It was deleted along
  with the `@csstools/postcss-cascade-layers` dependency and a dead `postcss.config.js`
  (Angular reads `.postcssrc.json`, never `postcss.config.js`).
  **The symptom was deceptive**: the step rewrote the file *after* Angular hashed its name,
  so `styles-XXXX.css` had the same filename everywhere while holding different bytes. To
  compare two environments' CSS, diff sizes or grep for `@layer` — never filenames.
  `vercel.json` is schema-validated and rejects unknown keys, so it cannot carry comments;
  document build quirks here instead.
- `npx cap sync` copies `dist/frontend/browser`, so a stale build ships silently — always
  build first (the `android:*` scripts already do).
- Role checks belong on **both** sides; a frontend guard without the matching backend
  middleware adds no security.
- Never commit `.env` files.
- **Prisma 7 changed how the client connects** — don't "fix" this back to older-Prisma
  patterns. `schema.prisma`'s `datasource` block cannot carry a `url` anymore (`prisma
  validate` rejects it); the connection string lives in `prisma.config.ts` (CLI/migrations
  only) and is passed to the *runtime* client explicitly via `@prisma/adapter-pg`'s
  `PrismaPg({ connectionString })`, wired in `prisma/client.js`. The generator is pinned to
  `provider = "prisma-client-js"` (the classic CJS output to `node_modules/@prisma/client`)
  rather than the newer `"prisma-client"` provider, which by default emits TypeScript-only
  source with no compiled JS — incompatible with this plain-CommonJS backend (`require()`
  everywhere, no build step). If `prisma generate` ever stops working with a `require`
  error, check that `provider` hasn't drifted back to `"prisma-client"`.
- A one-time Mongo→Postgres cutover plan (ETL run order, verification queries, maintenance
  window steps, rollback window) lives in this session's plan file
  (`C:\Users\Diego-A\.claude\plans\glowing-gliding-pinwheel.md` at the time of migration) —
  worth re-reading before ever running `scripts/etl-mongo-to-postgres.js` against real data.

## Further reading

[README.md](README.md) (monorepo quickstart), [docs/SUBDOMINIOS.md](docs/SUBDOMINIOS.md)
(activating per-gym subdomains), [docs/DESPLIEGUE-Y-MOVIL.md](docs/DESPLIEGUE-Y-MOVIL.md),
[docs/AUDITORIA-PENDIENTES.md](docs/AUDITORIA-PENDIENTES.md) (what the security audit fixed
and what stays open), and [APP-MOVIL.md](frontend/gym-aplication/APP-MOVIL.md)
(OAuth client ids, keystore).
