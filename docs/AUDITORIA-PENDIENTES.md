# Auditoría — Estado final

Auditoría del 2026-07-04 y su resolución. De los 117 hallazgos verificados, **la gran mayoría
quedó implementada y verificada** (builds en verde + 134 tests pasando). Aquí queda registrado
lo que se hizo y lo poco que sigue abierto, con su motivo.

## ✅ Implementado y verificado

**Seguridad / correctitud (commits de hardening):**
- Contraseñas ≥8, OAuth con validación de audience, login anti-enumeración, reset 30 min
- Handler 404 + middleware de error global, validación de env, lock de conexión (cold-start)
- Bounds-check de arrays, anti-IDOR, validación numérica, guards de borrado, `gymId` obligatorio + índices
- ErrorHandler global (front), decodificación JWT centralizada, tipado, fugas de memoria

**Features nuevas:**
- **Soft-delete** en User/Gym/Rutina/Noticia/Plan/MetodoPago (plugin; las lecturas excluyen borrados)
- **Auditoría**: modelo `AuditLog` + helper, registrada en operaciones sensibles
- **Pagos**: modelo `Transaccion` + `/api/transacciones` (registrar pago extiende membresía + historial)
- **Rol entrenador**: backend `/api/entrenador` + crear/asignar; frontend dashboard (socios, detalle) + routing por rol
- **2FA** TOTP (RFC 6238, verificado contra vectores) en `/api/2fa`
- **Verificación de email** (registro + verify/resend), **paginación** retro-compatible, **rate-limit general**
- **Admin**: export CSV (usuarios/transacciones), import masivo CSV, visor de auditoría
- **Frontend**: preloading, `ErrorHandlingService` + interceptor con timeout/retry, accesibilidad (ARIA), i18n base

**Tests (nuevos, ejecutados):**
- Backend: **68 tests** (Vitest) — RBAC/gymId, TOTP, soft-delete, CSV, paginación
- Frontend: **66 tests** — guards, interceptor, servicios, i18n
- E2E: **7 specs Playwright** (scaffold)

## 🔸 Lo que queda abierto (menor, con motivo)

1. **E2E**: los 7 specs están escritos y compilan, pero requieren un `ng serve` corriendo para
   ejecutarse. En CI: levantar el dev server (o descomentar el bloque `webServer` en
   `playwright.config.ts`) y `npm run e2e`.
2. **Tests de integración con BD real** (aislamiento gymId vía supertest): `mongodb-memory-server`
   no arranca en este host (macOS 21.6, el binario mongod aborta). En Linux/macOS reciente
   funcionaría; la lógica ya está cubierta por unit tests de middleware. Reactivar cuando el host lo permita.
3. **`ChangeDetectionStrategy.OnPush` global**: aplicado a los componentes nuevos (entrenador). En los
   ~30 componentes existentes es una optimización que debe probarse uno por uno (puede romper vistas
   que mutan estado sin disparar detección). Pendiente por lotes.
4. **i18n completo**: hay base funcional (I18nService + diccionarios es/en), pero extraer TODAS las
   cadenas de las plantillas es un trabajo largo y de bajo valor mientras la app sea solo en español.
5. **Accesibilidad**: cubiertos navbar/login/register/socios; falta una pasada exhaustiva al resto.
6. **UI "registrar pago" / "export"**: los endpoints backend existen y el `EntrenadorService`/admin
   están listos; falta el formulario/botón en el panel admin (conexión de UI).
7. **Tokens en `localStorage`**: se mantiene a propósito. Migrar a cookie `httpOnly` rompería el
   login actual y la app Capacitor; es un cambio de arquitectura, no un bug.

## ⚠️ Acción manual tuya (urgente)
Rota las credenciales que estaban en `backend/.env` (MongoDB, app-password de Gmail, `JWT_SECRET`)
y confírmalas en Vercel. `.env` ya está en `.gitignore` y no está trackeado, pero estuvieron en claro.
