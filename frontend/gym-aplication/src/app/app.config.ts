import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideAppInitializer, isDevMode, inject, ErrorHandler, Injectable } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { TenantService } from './services/tenant.service';
import { GymService } from './services/gym.service';
import { ThemeService } from './services/theme.service';
import { ToastService } from './services/toast.service';

// Manejo centralizado de errores no capturados: los registra en consola
// y notifica al usuario mediante el toast existente para dar visibilidad.
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private toast = inject(ToastService);

  handleError(error: unknown): void {
    console.error('Error no controlado:', error);
    this.toast.error('Ocurrió un error inesperado. Inténtalo de nuevo.');
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },

    // Rescate de los APK ya atascados. Desactivar el service worker arriba
    // evita registrarlo de nuevo, pero NO toca el que un APK anterior ya dejó
    // instalado en el WebView, que seguiría sirviendo su bundle viejo para
    // siempre. Esto lo desregistra y le borra los cachés una vez; a partir de
    // ahí no hay ninguno que desregistrar y la función no hace nada.
    //
    // Solo en nativo: en el navegador el worker es la PWA y debe quedarse.
    provideAppInitializer(async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        const registros = await navigator.serviceWorker?.getRegistrations?.();
        if (!registros?.length) return;

        await Promise.all(registros.map(r => r.unregister()));
        // Sin borrar los cachés, el contenido viejo sigue en disco ocupando
        // sitio aunque ya nadie lo sirva.
        const claves = await caches.keys();
        await Promise.all(claves.map(k => caches.delete(k)));

        // La página actual se cargó a través del worker que acabamos de
        // desregistrar, así que sigue mostrando lo viejo hasta recargar.
        location.reload();
      } catch {
        // Sin service worker en este WebView no hay nada que limpiar.
      }
    }),

    // Multi-tenant por subdominio: si la URL es <slug>.gimnasios.co,
    // resuelve el gym por slug ANTES de que el router navegue.
    // En dominios sin tenant (vercel.app, localhost, Capacitor) no hace nada.
    provideAppInitializer(async () => {
      const tenant = inject(TenantService);
      const gymService = inject(GymService);
      const theme = inject(ThemeService);

      const slug = tenant.slug;
      if (!slug) return;                                // dominio normal → flujo de siempre
      if (gymService.getGym()?.slug === slug) return;   // gym ya cargado (app.ts lo refresca)

      try {
        const gym = await firstValueFrom(gymService.getBySlug(slug));
        gymService.guardarGym(gym);
        theme.aplicar(gym);
      } catch {
        // Slug inexistente o backend caído → se muestra el selector como fallback
      }
    }),

    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor])),
    // El service worker sirve para la PWA en el navegador, pero DENTRO DEL APK
    // solo estorba: Capacitor sirve la app desde https://localhost, y el caché
    // del worker vive en el WebView, no en el paquete, asi que sobrevive a
    // reinstalar. El resultado es que instalas un APK nuevo y la app te sigue
    // mostrando el bundle que se cacheo la primera vez, congelada para siempre
    // (y el aviso de "nueva version" no la rescata: compara contra los propios
    // archivos empaquetados, que nunca cambian sin reinstalar).
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !Capacitor.isNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
