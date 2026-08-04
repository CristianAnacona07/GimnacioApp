import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantService } from '../services/tenant.service';
import { GymService } from '../services/gym.service';

/**
 * En un subdominio de gimnasio (ej. sogafi.gimnasios.co) el gym ya está
 * fijado por la URL, así que el selector de gimnasios no tiene sentido:
 * redirige directo al login del gym.
 *
 * El gym lo resuelve el APP_INITIALIZER (app.config.ts) antes de que el
 * router evalúe este guard. Si el slug no existe en la BD (initializer
 * falló), se deja pasar al selector como fallback.
 */
export const tenantGuard: CanActivateFn = () => {
  const tenant = inject(TenantService);
  const gymService = inject(GymService);
  const router = inject(Router);

  if (tenant.esSubdominio && gymService.getGym()?.slug === tenant.slug) {
    return router.parseUrl('/login');
  }
  return true;
};
