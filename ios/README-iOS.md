# App iOS (Capacitor) — Kodiak Gym

Plataforma iOS generada con Capacitor 8 (usa **Swift Package Manager**, no CocoaPods).
Bundle id: `com.kodiak.gym` · Nombre: **Kodiak Gym**.

## Qué ya está configurado
- Proyecto Xcode en `ios/App/App.xcodeproj` con scheme **App** compartido (para CI).
- `Info.plist`: nombre de la app + permisos de **fotos** y **cámara** (subida de foto de
  perfil / logo).
- Workflow `.github/workflows/ios-build.yml`: compila iOS en un runner macOS de GitHub
  (build sin firma, verifica que todo compila) **sin necesidad de un Mac compatible**.

## ⚠️ Importante sobre tu Mac (macOS 12 Monterey)
No puedes compilar ni publicar iOS localmente: Apple exige **Xcode 15+** (macOS 13+) para
subir a la App Store, y Xcode 16 requiere macOS 14+. Opciones reales de distribución:

1. **GitHub Actions (ya montado)** — verifica compilación en la nube en cada push. Para
   generar un `.ipa` firmado / TestFlight, añade los secretos de firma (ver abajo).
2. **Servicios de build en la nube con firma incluida** — la vía más fácil sin Mac:
   [Codemagic](https://codemagic.io), [EAS Build](https://expo.dev) o
   [Ionic Appflow](https://ionic.io/appflow). Suben tu repo, firman y entregan el `.ipa`.
3. **Actualizar macOS a 13/14** (si tu hardware lo soporta) para usar Xcode local.
4. **Mac en la nube** (MacStadium, MacinCloud) por horas.

En todos los casos necesitas una **cuenta Apple Developer** (99 USD/año) para instalar en
dispositivos reales o publicar.

## Login con Google en iOS (opcional)
El login con **correo/contraseña funciona sin nada extra**. Para el botón de Google nativo
en iOS:
1. En Google Cloud Console → Credenciales, crea un **OAuth client ID de tipo iOS** con el
   bundle `com.kodiak.gym`.
2. Añade el **reversed client ID** como URL scheme en `Info.plist`:
   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array>
         <string>com.googleusercontent.apps.TU_IOS_CLIENT_ID</string>
       </array>
     </dict>
   </array>
   ```
3. En el backend, añade ese client ID iOS a `GOOGLE_AUDIENCES` (variable
   `GOOGLE_IOS_CLIENT_ID`) para que valide el token — hoy solo acepta web y Android.

## Iconos y splash
Regenera desde el logo con:
```bash
npx @capacitor/assets generate --ios
```
(coloca el logo en `assets/` según la doc de @capacitor/assets).

## Desarrollo local (requiere un Mac compatible con Xcode)
```bash
npm run build
npx cap sync ios
npx cap open ios     # abre Xcode
```

## Firma para TestFlight/App Store (cuando tengas cuenta Apple)
Descomenta el job `build-signed` en `.github/workflows/ios-build.yml` y añade como
**secretos del repo**: certificado de distribución (`.p12`), perfil de aprovisionamiento,
y clave de App Store Connect API. Luego el workflow archiva y sube a TestFlight solo.
