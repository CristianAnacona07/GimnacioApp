# Despliegue y apps móviles — Kodiak Gym

Guía única de cómo se construye y despliega todo: **web (Docker)**, **Android (APK)** e
**iOS**. Todos los builds pesados corren **en la nube (GitHub Actions)** — no necesitas
Docker, Android Studio ni un Mac compatible en tu equipo.

Repos:
- Frontend (Angular + apps móviles): `CristianAnacona/GimnacioApp`
- Backend (API Express): `CristianAnacona/GimnacioApp-backend`

Regla general: **haces `git push` a `main` → GitHub construye**. Los resultados quedan en la
pestaña **Actions** de cada repo (imágenes en Packages, APK/artefactos en cada run).

---

## 1. Web con Docker (backend + frontend)

MongoDB sigue en **Atlas** (la nube); no hay contenedor de base de datos.

**Archivos**
- `backend/Dockerfile`, `backend/server.js` (entrypoint que escucha el puerto),
  `backend/.dockerignore`, `backend/docker-compose.yml`
- `frontend/gym-aplication/Dockerfile` (Angular → Nginx), `nginx.conf`, `.dockerignore`
- Workflows `docker-publish.yml` en cada repo → publican en **GHCR**

**Cómo se construye:** `git push` a cada repo. Las imágenes quedan en:
- `ghcr.io/cristiananacona/gimnacioapp-backend:latest`
- `ghcr.io/cristiananacona/gimnacioapp:latest`

(La primera vez los paquetes salen privados; para descargarlos sin login: *GitHub →
Packages → el paquete → Package settings → Change visibility → Public*.)

**Cómo se despliega (en un servidor con Docker):**
```bash
# crea un .env junto al docker-compose.yml con MONGO_URI, JWT_SECRET, GOOGLE_CLIENT_ID, etc.
docker compose pull
docker compose up -d      # backend en :10000, frontend en :8080
```

**Ojo (Angular hornea la URL del backend en build):** el frontend llama a la `apiUrl` de
`environment.prod.ts` (hoy el backend de Vercel). Si quieres que el frontend contenerizado
hable con el backend contenerizado, cambia esa `apiUrl` antes de hacer push.

---

## 2. Android — APK

**Estado:** plataforma Capacitor lista (`android/`, `applicationId = com.kodiak.gym`,
Gradle 8.14 / AGP 8.13 / SDK 36). Config de Google/keystore documentada en
[frontend/gym-aplication/APP-MOVIL.md](../frontend/gym-aplication/APP-MOVIL.md).

**Build en la nube (recomendado — no necesitas Android Studio):**
- Workflow `.github/workflows/android-build.yml` (runner Linux, JDK 21).
- `git push` → pestaña **Actions** → run "Build APK Android" → sección **Artifacts** →
  descarga `kodiak-gym-debug-apk` → instálalo en cualquier Android (permitir orígenes
  desconocidos). Es un **APK debug**: instalable, no apto para Play Store.

**Build local (si tienes Android Studio):**
```bash
cd frontend/gym-aplication
npm run android:open        # ng build + cap sync + abre Android Studio
```

**APK/AAB firmado para Google Play:** descomenta el job `build-release` del workflow y sube
como secretos del repo tu keystore (`ANDROID_KEYSTORE_B64`) y contraseñas. Genera un `.aab`
firmado listo para Play Console.

---

## 3. iOS

**Estado:** plataforma Capacitor añadida (`ios/App/`, Swift Package Manager, bundle
`com.kodiak.gym`, "Kodiak Gym"). Iconos y splash generados desde `assets/logo.png`.
Detalle completo en [frontend/gym-aplication/ios/README-iOS.md](../frontend/gym-aplication/ios/README-iOS.md).

**⚠️ Límite de tu Mac (macOS 12 Monterey):** no puedes compilar/publicar iOS localmente.
Apple exige Xcode 15+ (macOS 13+) para la App Store. Por eso el build va en la nube.

**Build en la nube:**
- Workflow `.github/workflows/ios-build.yml` (runner **macOS**, Xcode incluido).
- `git push` → **Actions** → "Build iOS (nube)". Hace un build **sin firma** que verifica
  que la app iOS compila (no necesita cuenta de Apple).

**Para un `.ipa` instalable / TestFlight / App Store necesitas cuenta Apple Developer
(99 USD/año).** Opciones sin Mac compatible:
1. Descomentar el job `build-signed` del workflow y añadir los secretos de firma.
2. Servicios que firman por ti: **Codemagic**, **EAS Build**, **Ionic Appflow**.
3. Actualizar macOS a 13/14 (si el hardware lo soporta), o un Mac en la nube.

**Login con Google en iOS (opcional):** el login por correo funciona sin nada. Para el
botón de Google nativo:
1. Google Cloud Console → crea un **OAuth client ID tipo iOS** (bundle `com.kodiak.gym`).
2. Añade su **reversed client ID** como URL scheme en `ios/App/App/Info.plist`.
3. Define en el backend la env `GOOGLE_IOS_CLIENT_ID` (el código ya la acepta como
   audience válida).

---

## 4. Variables de entorno del backend (checklist)

En Vercel/servidor/compose, el backend necesita:

| Variable | Obligatoria | Nota |
|---|---|---|
| `MONGO_URI` | ✅ | Cadena de Atlas |
| `JWT_SECRET` | ✅ | Clave larga aleatoria |
| `GOOGLE_CLIENT_ID` | ✅ (login Google web) | Sin fallback hardcodeado |
| `GOOGLE_ANDROID_CLIENT_ID` | login Google Android | |
| `GOOGLE_IOS_CLIENT_ID` | login Google iOS | Opcional |
| `EMAIL_USER` / `EMAIL_PASS` | reset/verificación email | App-password de Gmail |
| `FRONTEND_URL` | ✅ | Para enlaces de correo y CORS |
| `TENANT_ROOT_DOMAIN` | subdominios por gym | Opcional |
| `PORT` | contenedor | Por defecto 10000 |

> ⚠️ Pendiente tuyo: **rotar** las credenciales que estuvieron en claro en `.env`
> (MongoDB, Gmail, `JWT_SECRET`) y definirlas en Vercel.
