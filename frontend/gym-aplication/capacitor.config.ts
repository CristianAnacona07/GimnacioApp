import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kodiak.gym',
  appName: 'Snake Gym',
  webDir: 'dist/frontend/browser',
  // La web va empaquetada dentro del APK.
  //
  // Antes se cargaba en vivo desde snakegym.cloud (`server.url`), lo que hacía
  // que cualquier cambio de interfaz llegara sin instalar nada. El costo era
  // invisible hasta que hizo falta algo nativo: con `server.url` remoto el
  // puente de Capacitor no se inyecta bien — la plataforma se reporta como
  // "web" y los plugins fallan — y encima el service worker de la PWA lo
  // rompe por su cuenta. Sin puente no hay huella, ni lector nativo, ni nada
  // que hable con Android.
  //
  // Lo que se perdía se recupera con `CapacitorUpdater`: la app busca al
  // arrancar si hay una versión nueva de la web y la baja sola. O sea, se
  // sigue actualizando sin APK; solo un plugin nativo nuevo obliga a sacar uno.
  plugins: {
    CapacitorUpdater: {
      // El propio servidor del gimnasio publica el paquete en cada despliegue.
      // Nada de servicios de terceros: la app ya vive en este dominio.
      updateUrl: 'https://snakegym.cloud/app/updates.json',
      // Se aplica al volver a abrir la app, no en medio de una sesión: nadie
      // quiere que la pantalla se recargue mientras está registrando un pago.
      directUpdate: false,
      // Si la versión nueva no logra arrancar, vuelve sola a la anterior.
      autoUpdate: true,
      resetWhenUpdate: true
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#191c22',
      androidScaleType: 'CENTER_INSIDE',
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
