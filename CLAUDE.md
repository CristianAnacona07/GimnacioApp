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
| `backend/`                 | Express 5 + Mongoose (MongoDB), JWT auth. Deployed to Vercel *and* GHCR/Docker |
| `frontend/gym-aplication/` | Angular 21 standalone + Tailwind v4, PWA, Capacitor (Android/iOS)    |
| `docs/`                    | Project context, user stories, subdomain and deployment guides       |

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
node scripts/migrar-gym.js         # backfill gymId on legacy data

# Email in dev: Mailpit captures every message instead of delivering it
docker compose -f docker-compose.dev.yml up -d   # SMTP :1025, inbox http://localhost:8025
# then set SMTP_HOST=127.0.0.1 / SMTP_PORT=1025 in backend/.env
# (ports already taken? MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose …)

# Frontend
cd frontend/gym-aplication
npm install
npm start                          # ng serve → http://localhost:4200
npm run build                      # ng build + scripts/flatten-layers.mjs (required for Vercel)
npm test                           # ng test (Angular 21 unit-test builder, Vitest + jsdom)
npm test -- --include src/app/guards/auth.spec.ts   # single spec
npm run e2e                        # Playwright (needs a dev server already running on :4200)

# Android / iOS (Capacitor) — webDir is dist/frontend/browser, so a web build must run first
npm run android:sync               # ng build + cap sync android
npm run android:open               # …+ open Android Studio
```

There is **no linter configured** (no ESLint). Formatting is Prettier, configured inline in
`frontend/gym-aplication/package.json` (100 cols, single quotes, `angular` parser for HTML).

**Backend env vars** (`backend/.env.example`): `MONGO_URI`, `JWT_SECRET` (both are
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

## Architecture

### Multi-gym isolation (the central invariant)

Every domain document carries `gymId`. The JWT payload carries `gymId`, the auth
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
  requests during a cold start share one `mongoose.connect` instead of racing; the lock is
  cleared on failure so the next request can retry.
- **Two entry points**: `index.js` exports the app and only calls `listen()` when
  `NODE_ENV !== 'production'` (Vercel imports it). `server.js` exists for the Docker image,
  which runs with `NODE_ENV=production` and *must* listen. Don't merge them.

### Data layer conventions

- **Soft delete** ([models/plugins/softDelete.js](backend/models/plugins/softDelete.js)) is
  applied to User, Gym, Rutina, Noticia, Plan, MetodoPago, Transaccion. It adds `deletedAt`
  and **silently filters `deletedAt: null` into every read/update query**. To see deleted
  docs you must opt in: `Model.find(f).setOptions({ withDeleted: true })`. Delete with
  `Model.softDelete(filtro)`, undo with `Model.restore(filtro)`. This is the most surprising
  behavior in the backend — a "missing" document is usually soft-deleted.
- **Audit trail**: `registrarAuditoria(req, 'ACCION', { recurso, recursoId, detalle })`
  ([helpers/audit.js](backend/helpers/audit.js)) writes an `AuditLog` and never throws, so a
  failed log can't take down a successful operation. Call it on sensitive admin/superadmin ops.
- **Email is unique per gym**, not globally:
  `UserSchema.index({ email: 1, gymId: 1 }, { unique: true })` — the same person can belong
  to two gyms.
- `password` and the 2FA/verification token fields are `select: false`; you must
  `.select('+password')` explicitly.
- **Pagination is backward-compatible**: without `?page` a route returns a plain array;
  with `?page` it returns `{ data, total, page, limit, pages }`. Preserve that shape when
  touching list endpoints.
- User stats are nested under `stats` (`stats.racha`, `stats.asistenciasMes`). Membership
  dates are `fechaRegistro` / `fechaVencimiento`; `codigoAcceso` is the 6-digit check-in
  code encoded in the member's QR.

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
  [tests/setup.js](backend/tests/setup.js) sets `JWT_SECRET`/`MONGO_URI` *before* app modules
  load, because they read env at import time. Tests use stubbed `req`/`res`/`next` and
  `supertest`; there is no live MongoDB — don't write tests that need one.
- Frontend: `@angular/build:unit-test` (Vitest + jsdom + `fake-indexeddb`), specs colocated
  as `*.spec.ts`, HTTP tested with `provideHttpClientTesting` + `HttpTestingController`.
- E2E: Playwright specs in `e2e/` using semantic selectors; `webServer` is intentionally
  commented out, so start `npm start` yourself first.

## Gotchas

- **Dev API port mismatch**: `environment.ts` points at `http://localhost:3000` while the
  backend defaults to `PORT=10000`. Set `PORT=3000` in `backend/.env` (or edit the
  environment file), otherwise every dev request hits the wrong port.
- Use `npm run build`, not bare `ng build`: `scripts/flatten-layers.mjs` flattens Tailwind v4
  cascade layers, and without it the deployed CSS breaks.
- `npx cap sync` copies `dist/frontend/browser`, so a stale build ships silently — always
  build first (the `android:*` scripts already do).
- Role checks belong on **both** sides; a frontend guard without the matching backend
  middleware adds no security.
- Never commit `.env` files.

## Further reading

[README.md](README.md) (monorepo quickstart), [docs/SUBDOMINIOS.md](docs/SUBDOMINIOS.md)
(activating per-gym subdomains), [docs/DESPLIEGUE-Y-MOVIL.md](docs/DESPLIEGUE-Y-MOVIL.md),
[docs/AUDITORIA-PENDIENTES.md](docs/AUDITORIA-PENDIENTES.md) (what the security audit fixed
and what stays open), and [APP-MOVIL.md](frontend/gym-aplication/APP-MOVIL.md)
(OAuth client ids, keystore).
