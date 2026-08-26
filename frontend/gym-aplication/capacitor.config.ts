import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kodiak.gym',
  appName: 'Snake Gym',
  webDir: 'dist/frontend/browser',
  // El APK no lleva la web empaquetada adentro: carga la app en vivo desde
  // producción, igual que el navegador. Así cualquier cambio que se suba a
  // snakegym.cloud lo ve el socio la próxima vez que abra la app, sin tener
  // que instalar un APK nuevo — antes cada cambio de UI quedaba "congelado"
  // en la versión que tenía instalada hasta que alguien se lo reinstalara a
  // mano. webDir sigue haciendo falta para que `cap sync` copie los assets
  // nativos (ícono, splash), aunque su index.html ya no se use en runtime.
  server: {
    url: 'https://snakegym.cloud',
    androidScheme: 'https'
  },
  plugins: {
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
