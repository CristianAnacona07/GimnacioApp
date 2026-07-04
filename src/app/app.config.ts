import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideAppInitializer, isDevMode, inject, ErrorHandler, Injectable } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
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

    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
