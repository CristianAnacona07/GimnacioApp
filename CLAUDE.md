# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack gym management application with role-based access control (superadmin, admin, entrenador, socio). The system manages gym memberships, workout routines, news, payment methods, and member progress tracking.

**Stack:**
- Frontend: Angular 21 (standalone components), Tailwind CSS v4, PWA with service worker
- Backend: Node.js + Express 5, MongoDB + Mongoose, JWT authentication
- Deployment: Vercel (frontend as SPA, backend as serverless functions)

**Directory Structure:**
- `/frontend/gym-aplication/` - Angular application
- `/backend/` - Express API server

## Development Commands

### Backend
```bash
cd backend
npm start              # Start with nodemon (dev mode)
node scripts/crear-superadmin.js    # Create superadmin user
node scripts/migrar-gym.js          # Migrate gym data
```

**Environment variables required** (see `backend/.env.example`):
- `MONGO_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `EMAIL_USER`, `EMAIL_PASS`, `FRONTEND_URL`, `NODE_ENV`, `PORT`

### Frontend
```bash
cd frontend/gym-aplication
npm start              # Start dev server (ng serve) on localhost:4200
npm run build          # Production build with layer flattening script
npm test               # Run unit tests (ng test — Angular 21 unit-test builder, Vitest-backed)
npm run watch          # Watch mode for development builds
```

### Mobile (Android via Capacitor)
The Angular app is also wrapped as a native Android app ("Kodiak Gym", appId `com.kodiak.gym`). iOS is not included yet (PWA is used on iPhone). See [APP-MOVIL.md](frontend/gym-aplication/APP-MOVIL.md) for OAuth/keystore details.
```bash
cd frontend/gym-aplication
npm run android:sync   # ng build + npx cap sync android
npm run android:open   # ng build + cap sync + open Android Studio
```
- Native extras over the PWA: local alarm/notification for the cronómetro (fires even when app is closed), and hybrid Google login (native Credential Manager, falling back to browser AppAuth on devices without Google services).
- Capacitor `webDir` is `dist/frontend/browser`, so a web build must run before any `cap sync`.

## Architecture

### Role-Based Access Control

The application enforces strict role separation:
- **superadmin**: Platform-level access, manages multiple gyms (`/sa`, `/plataforma`)
- **admin**: Gym owner/manager, full gym management access (`/admin/*`)
- **entrenador**: Trainer role (defined in schema, not fully implemented in routes)
- **socio**: Gym member, limited to viewing assigned content (`/socio/*`)

**Key principle**: Admin manages everything (members, routines, news, plans). Socios only see what's assigned to them.

### Multi-Gym Architecture

Users belong to a specific gym via `gymId` reference:
- Users select gym before login at `/gimnasios` route
- Selected gym stored in `localStorage.gymActual`
- Backend middleware extracts `gymId` from JWT payload (`req.gymId`)
- All queries scoped by `gymId` to ensure data isolation between gyms

**Subdomain-per-gym (ready, pending domain purchase)**: when the app runs on `<slug>.<tenantRootDomain>` (e.g. `sogafi.gimnasios.co`), an APP_INITIALIZER ([app.config.ts](frontend/gym-aplication/src/app/app.config.ts)) resolves the gym by slug and [tenant.guard.ts](frontend/gym-aplication/src/app/guards/tenant.guard.ts) skips the `/gimnasios` selector. Configured via `tenantRootDomain` (frontend environments) and `TENANT_ROOT_DOMAIN` (backend CORS env var). Dev testing: `http://<slug>.localhost:4200`. Activation guide: [docs/SUBDOMINIOS.md](docs/SUBDOMINIOS.md).

### Authentication Flow

1. **Frontend Guard** ([guards/auth.ts](frontend/gym-aplication/src/app/guards/auth.ts)):
   - Checks `localStorage` for `token` and `gymActual`
   - Validates JWT expiration client-side (decodes payload)
   - Role-based routing: `/admin/*` requires `role === 'admin'`
   - Token expired → clears session, preserves `gymActual`, redirects to login

2. **Backend Middleware** ([middleware/auth.js](backend/middleware/auth.js)):
   - `verificarToken`: Validates JWT, attaches `req.userId`, `req.userRole`, `req.gymId`
   - `soloAdmin`: Restricts to admin/superadmin roles
   - `soloSuperAdmin`: Restricts to superadmin only
   - JWT tokens expire in 8 hours

3. **HTTP Interceptor** ([interceptors/auth.interceptor.ts](frontend/gym-aplication/src/app/interceptors/auth.interceptor.ts), wired in [app.config.ts](frontend/gym-aplication/src/app/app.config.ts) via `withInterceptors`):
   - Attaches `Authorization: Bearer <token>` to every request
   - **Does NOT send a client-controlled `user-id` header** — the backend identifies the user only from the verified JWT (prevents impersonation/IDOR)
   - On `401`: clears session and redirects to `/login`, **except** for public auth endpoints (login/register/google/forgot-password/reset-password), where a 401 means invalid credentials, not an expired session

4. **Session Storage** (localStorage):
   - `token`, `userId`, `usuario` (JSON), `role`, `nombre`, `gymActual`

### MongoDB Connection (Serverless Optimization)

Backend uses connection pooling optimized for Vercel serverless ([index.js:32-49](backend/index.js#L32-L49)):
- `cachedDb` stores connection between function invocations
- Connection reused if `mongoose.connection.readyState === 1`
- Pool size: min 1, max 5 connections
- Timeouts tuned for cold starts (10s server selection, 45s socket timeout)

**Important**: All routes wrapped in DB connection middleware that ensures connection before request processing.

### API Routes

All routes prefixed with `/api/`:
- `/api/auth` - Login, register, Google OAuth, user management, profile updates, membership renewal, password reset (via nodemailer)
- `/api/rutinas` - Assign/update/delete workout routines, toggle exercise completion
- `/api/noticias` - CRUD for gym news/announcements
- `/api/planes` - CRUD for membership plans
- `/api/pagos` - CRUD for payment methods
- `/api/progreso` - Member progress tracking (visualized with Chart.js in frontend)
- `/api/medidas` - Body measurements tracking (visualized with Chart.js in frontend)
- `/api/gym` - Gym management (superadmin operations)
- `/api/feedback` - Member feedback system

**Health Check**: `/health` endpoint returns `{status: 'ok'}` for monitoring.

**Performance**: All responses use compression middleware to reduce payload size.

### Frontend Component Organization

**Shared Routes** (accessible to both admin and socio):
- `noticias`, `planes`, `pagos` - Defined once in `sharedRoutes`, included in both dashboards

**Admin Dashboard** ([admin/dashboardAdmin](frontend/gym-aplication/src/app/components/admin/dashboardAdmin)):
- Shell component with navbar + router-outlet
- Child routes: `entrenadores`, `socios`, `rutinas`, `rutinas/:id`, `detalle-rutina/:id`, `settings`
- All protected by `authGuard`

**Socio Dashboard** ([socio/dashboardSocio](frontend/gym-aplication/src/app/components/socio/dashboardSocio)):
- Shell component with navbar + router-outlet
- Child routes: `perfil`, `datos-personales`, `mi-rutina`, `progreso`, `medidas`, `feedback`
- All protected by `authGuard`

### State Management

**UserStateService** ([services/user-state.service.ts](frontend/gym-aplication/src/app/services/user-state.service.ts)):
- BehaviorSubject pattern for reactive user state
- Syncs with localStorage
- Used by Navbar to display current user (5min cache to avoid repeated API calls)
- Updates trigger re-render across components

### Data Models

**User** ([models/user.js](backend/models/user.js)):
- Core fields: `gymId` (ref), `nombre`, `email`, `password` (bcrypt hashed), `role`
- Profile: `fotoUrl`, `mensajeMotivador`
- Personal data: `datosPersonales` (identificacion, fechaNacimiento, sexo, pesoActual, altura, telefono)
- Stats: `racha`, `asistenciasMes`
- Membership: `fechaRegistro`, `fechaVencimiento`

**Rutina** ([models/rutina.js](backend/models/rutina.js)):
- Reference: `usuarioId` (ref User), `gymId` (ref Gym)
- Schedule: `nombre`, `dia` (enum: Lunes-Domingo)
- Exercises: Array with `nombre`, `series`, `repeticiones`, `instrucciones`, `imagenUrl`, `completado`
- Used for weekly workout assignment per member

**Other Models**: Gym, Plan, Pagos (MetodoPago), Noticia, Progreso, Medidas, Feedback

### Exercise Catalog

Static data file at [src/data/ejercicios-catalogo.ts](frontend/gym-aplication/src/data/ejercicios-catalogo.ts):
- `CATALOGO_EJERCICIOS` array with exercise metadata (name, images, GIFs, category, description, tips)
- `CATEGORIAS_UNICAS` for filtering
- Images/GIFs stored as local assets in `public/ejercicios/`
- Admin uses this to build routines; exercises are copied (not referenced) when assigned

### CORS Configuration

Backend CORS ([index.js:12-26](backend/index.js#L12-L26)):
- Production: `https://gimnacio-app.vercel.app`
- Dynamic: Allows `*.vercel.app` and `localhost` origins
- Credentials enabled for cookie/auth support
- Custom headers: `Content-Type`, `Authorization`, `user-id`

### Build & Deployment

**Frontend** ([package.json:7](frontend/gym-aplication/package.json#L7)):
- Build: `ng build && node scripts/flatten-layers.mjs`
- Custom script flattens CSS cascade layers for Vercel compatibility
- PWA config: [ngsw-config.json](frontend/gym-aplication/ngsw-config.json)
- Vercel rewrites all routes to `/index.html` for SPA routing

**Backend** ([vercel.json](backend/vercel.json)):
- Single serverless function at `index.js`
- All routes proxied through main handler
- Relies on cached MongoDB connection for performance
- Runs on port 10000 in development mode

### Common Patterns

**Lazy Loading**: All routes use `loadComponent()` with dynamic imports for code splitting

**Guards**:
- `authGuard` - Requires token + gym selection, enforces role-based routing
- `noAuthGuard` - Prevents logged-in users from accessing login/register
- `superAdminGuard` - Restricts to superadmin role

**Services**: Each domain has corresponding service (auth, gym, planes, pagos, noticias, progreso, medidas, feedback) that wraps HTTP calls to backend

**Storage Management**:
- `StorageService` ([services/storage.service.ts](frontend/gym-aplication/src/app/services/storage.service.ts)): Centralized localStorage management
  - `clearSessionPreservingData()`: Clears auth data but preserves timer, theme, gym selection
  - `isTokenExpired()`: Checks if JWT token is expired
  - `getTokenTimeRemaining()`: Returns milliseconds until token expiration
- `TokenMonitorService` ([services/token-monitor.service.ts](frontend/gym-aplication/src/app/services/token-monitor.service.ts)): Monitors token expiration
  - Checks every 60 seconds
  - Auto-renews the token when less than 2 hours remain (RENEWAL_THRESHOLD_MS)
  - Shows a warning when less than 30 minutes remain (isTokenExpiringSoon)
  - Auto-logout when expired (preserving timer and preferences)

### PWA Features

- Service worker for offline capability ([ngsw-config.json](frontend/gym-aplication/ngsw-config.json))
- Web manifest at `public/manifest.webmanifest`
- Update service monitors for new versions ([services/update.service.ts](frontend/gym-aplication/src/app/services/update.service.ts))

## Important Notes

- **Never commit `.env` files** - Use `.env.example` as template
- **Role checks happen on both client and server** - Client guards are UX, server middleware is security
- **Gym isolation is critical** - All user/data queries must filter by `gymId`
- **MongoDB indexes**: User model has index on `email` (unique) and `gymId` for query performance
- **Frontend uses Prettier** with specific Angular HTML parser config ([package.json:11-22](frontend/gym-aplication/package.json#L11-L22))
- **Tailwind v4** uses PostCSS with cascade layers plugin ([postcss.config.js](frontend/gym-aplication/postcss.config.js))
- **localStorage management**: NEVER use `localStorage.clear()` directly - use `StorageService.clearSessionPreservingData()` to preserve timer, theme, and gym selection
- **Timer persistence**: Cronometer state is preserved even when token expires or user logs out

## Troubleshooting

**Backend won't start**:
- Verify `.env` file exists with all required variables (see `.env.example`)
- Check MongoDB URI is valid and accessible
- Ensure port 10000 is not in use

**Frontend build fails**:
- Clear Angular cache: `rm -rf frontend/gym-aplication/.angular`
- Delete node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`
- Check Tailwind CSS v4 PostCSS configuration is correct

**CORS errors in development**:
- Backend allows localhost origins by default
- Verify frontend is running on `localhost:4200`
- Check backend CORS configuration includes your origin

**JWT token expired loop**:
- Token expires after 8 hours
- Frontend clears token but preserves `gymActual`
- User must re-login to their selected gym

**MongoDB connection timeout on Vercel**:
- Check MongoDB Atlas allows connections from `0.0.0.0/0` (all IPs)
- Verify `MONGO_URI` in Vercel environment variables
- Connection pooling settings are optimized for serverless cold starts
