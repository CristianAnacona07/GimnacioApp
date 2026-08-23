import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kodiak.gym',
  appName: 'Snake Gym',
  webDir: 'dist/frontend/browser',
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
