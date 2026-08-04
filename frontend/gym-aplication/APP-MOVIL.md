# App móvil (Android) — Kodiak Gym

Documentación de la app nativa Android generada con **Capacitor**, que envuelve la
misma app Angular y añade funciones nativas (notificaciones locales, login de Google).

> iOS no está incluido todavía (requiere Mac con Xcode 16 / macOS 14+). En iPhone se
> usa la PWA web por ahora.

---

## 1. Resumen de lo añadido

- **Capacitor + plataforma Android** (`com.kodiak.gym`, app "Kodiak Gym").
- **Cronómetro con notificación nativa**: avisa con sonido y vibración a la hora exacta,
  **aunque la app esté cerrada o el teléfono bloqueado** (alarma local del sistema).
- **Login de Google híbrido**:
  - Android con servicios de Google → login **nativo** (Credential Manager).
  - Android **sin** servicios de Google (Huawei) → login de Google **por navegador**
    (Custom Tabs / AppAuth), como respaldo automático.
- **Icono y splash** con el logo del oso (Kodiak Strength Gym).
- Un **único APK** sirve para todos los Android (con o sin Google).

---

## 2. Datos de configuración (Google Cloud)

| Dato | Valor |
|---|---|
| Package name | `com.kodiak.gym` |
| Web Client ID | `976541861094-pcm89afbvhdi6fttf7si2cc7gbtuf2pn.apps.googleusercontent.com` |
| Android Client ID | `976541861094-rb07727og04jbtkrb3o07og0pnbjfbtr.apps.googleusercontent.com` |
| SHA-1 (keystore debug) | `2D:22:77:0D:64:87:D7:73:CB:36:15:BC:85:74:19:44:DB:71:AE:33` |
| Redirect navegador (AppAuth) | `com.googleusercontent.apps.976541861094-rb07727og04jbtkrb3o07og0pnbjfbtr:/` |

En **Google Cloud Console → Credenciales** debe existir un cliente OAuth de tipo
**Android** con ese package y esa SHA-1 (para el login nativo y el de navegador).

> Si en el futuro se firma un **APK release** con otra clave, hay que registrar también
> la SHA-1 de esa clave, o el login de Google fallará (`DEVELOPER_ERROR`).

---

## 3. Requisitos para compilar el APK

- **Node** + dependencias del proyecto (`npm install`).
- **JDK 21** (Temurin). En este equipo está en: `~/jdk21/jdk-21.0.11+10/Contents/Home`.
- **Android SDK** (command-line tools). En este equipo: `/usr/local/share/android-commandlinetools`
  con `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`.
- `android/local.properties` con `sdk.dir=/usr/local/share/android-commandlinetools`.

> Nota: el JDK del sistema (Java 25) es demasiado nuevo para Gradle; por eso se usa JDK 21.

---

## 4. Cómo regenerar el APK

```bash
cd frontend/gym-aplication

# 1) Compilar la web y sincronizar con Android
npm run android:sync          # = ng build && npx cap sync android

# 2) Compilar el APK (debug)
cd android
export JAVA_HOME="$HOME/jdk21/jdk-21.0.11+10/Contents/Home"
export ANDROID_HOME="/usr/local/share/android-commandlinetools"
export PATH="$JAVA_HOME/bin:$PATH"
./gradlew assembleDebug --no-daemon

# 3) APK resultante:
#    android/app/build/outputs/apk/debug/app-debug.apk
```

Alternativa con Android Studio: `npm run android:open` (compila, sincroniza y abre el
proyecto en Android Studio para Build → Build APK).

---

## 5. Cómo repartir el APK

- Es un APK **debug** (firmado con la clave de depuración): sirve para instalar y probar
  sin límite. Se reparte por WhatsApp / Drive / Telegram, etc.
- En el teléfono hay que permitir **"instalar de orígenes desconocidos"**.
- **No se actualiza solo** (no es Google Play): cada cambio = nuevo APK que se reinstala.
- Mantener la **misma clave de firma** entre versiones; si cambia, hay que desinstalar antes.

---

## 6. Notificaciones del cronómetro

- En el APK se programa una **notificación local nativa** a la hora exacta del fin
  (plugin `@capacitor/local-notifications`). Salta aunque la app esté cerrada.
- En el navegador (PWA) se usa el método web (solo con la app abierta).
- Permisos en el manifest: `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`,
  `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`.
- **Icono de la notificación** (barra de estado): silueta blanca del oso `ic_stat_kodiak`
  (en `res/drawable-*dpi/`) con tinte dorado (`iconColor: '#D4AF37'`). Android exige que el
  icono pequeño sea una silueta monocroma; se generó desde el logo con `sharp`
  (recorte de la cabeza del oso + umbral). Para regenerarlo, ver el script en el commit
  o repetir el proceso de recorte/umbral sobre `public/icons/LogoGym.jpg`.

**En el teléfono**, para que llegue con la app cerrada:
- Activar Notificaciones y "Alarmas y recordatorios" de la app.
- Quitarla del ahorro de batería.
- **Huawei**: además, Ajustes → Batería → Inicio de apps → activar inicio automático y
  ejecución en segundo plano (su "asesino de apps" las bloquea por defecto).

---

## 7. Login de Google (híbrido)

Código en [src/app/components/auth/login/login.ts](src/app/components/auth/login/login.ts):

- `loginGoogleNativo()` → plugin `@capgo/capacitor-social-login` (necesita servicios de Google).
- Si falla (Huawei/sin GMS) → `loginGoogleNavegador()` → `@capacitor-community/generic-oauth2`
  abre Google en el navegador y devuelve el token.
- En ambos casos el token se manda al backend `POST /api/auth/google`, que lo verifica.

> Google bloquea su login dentro de WebViews embebidos; por eso se usa el plugin nativo o
> el navegador del sistema (Custom Tabs), nunca el WebView de la app.

---

## 8. Icono y splash

- Fuente: `assets/logo.png` (logo Kodiak, 1024×1024).
- Generación de iconos/splash:
  ```bash
  npx @capacitor/assets generate --android \
    --iconBackgroundColor '#13294e' --iconBackgroundColorDark '#13294e'
  ```
- Genera todos los `mipmap-*` (icono adaptativo) y los `splash` en `android/app/src/main/res`.
- Para cambiar el logo: reemplaza `assets/logo.png` y vuelve a ejecutar el comando.

---

## 9. Backend relacionado

- **CORS**: el backend permite los orígenes de la app Capacitor
  (`https://localhost` en Android, `capacitor://localhost` en iOS) además de `*.vercel.app`.
- **Variables de entorno** obligatorias en producción (Vercel): `JWT_SECRET`, `MONGO_URI`,
  `GOOGLE_CLIENT_ID`, `EMAIL_USER`, `EMAIL_PASS`, etc.

---

## 9b. Nota sobre alarmas exactas y Google Play

El cronómetro usa **alarmas exactas** (`SCHEDULE_EXACT_ALARM` + `USE_EXACT_ALARM`) para
saltar en el segundo justo. Esto funciona perfecto para **distribución por APK** (sideload).

⚠️ **Google Play**: `USE_EXACT_ALARM` está restringido a apps cuya función central es
alarma/reloj/calendario. Si algún día se publica en Play Store, habría que **quitar
`USE_EXACT_ALARM`** y, o bien pedir el permiso `SCHEDULE_EXACT_ALARM` al usuario en runtime,
o cambiar a una notificación no-exacta. Para el APK actual no hay problema.

## 9c. Reproductor de Spotify

Componente [spotify-player](src/app/components/shared/spotify-player/spotify-player.ts)
(visible en rutas de socio):

- **Mini-player embebido** (iframe oficial de Spotify) con una playlist de entrenamiento.
  No requiere login; reproduce previews (o completo si el usuario tiene sesión de Spotify).
- Botón **"Abrir app"** que abre la app nativa de Spotify vía deep link
  (`spotify:playlist:ID`, plugin `@capacitor/app-launcher`) y cae al enlace web si no está
  instalada. En navegador abre la pestaña web.
- Playlist por defecto en `DEFAULT_PLAYLIST`; se puede sobreescribir por gym si se añade
  el campo `spotifyPlaylist` a la config del gimnasio (futuro).

## 10. Pendiente / futuro

- **APK release firmado** + Google Play (para actualizaciones automáticas; $25 único).
- **iOS**: requiere actualizar macOS (Sonoma+) e instalar Xcode; luego `npx cap add ios`.
- **Notificación cerrada en iPhone / Web Push**: requiere servidor de push + programador
  (QStash o Firebase Cloud Tasks).
