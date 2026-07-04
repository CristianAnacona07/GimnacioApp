import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { StorageService } from '../services/storage.service';

export const noAuthGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const storageService = inject(StorageService);
  const token = storageService.getToken();
  const gym   = storageService.getGym();

  if (token) {
    const payload = storageService.decodeTokenPayload(token);
    if (!payload) {
      storageService.clearSessionPreservingData();
      return true;
    }
    if (payload.exp * 1000 < Date.now()) {
      storageService.clearSessionPreservingData();
      return true;
    }
    // Sesión activa → redirigir según rol del token (única fuente de verdad).
    const role = payload.role?.toLowerCase().trim();
    if (role === 'superadmin') router.navigate(['/plataforma']);
    else if (role === 'admin') router.navigate(['/admin']);
    else router.navigate(['/socio']);
    return false;
  }

  // Sin gym y sin token → selector (excepto ruta de superadmin)
  if (!gym) {
    router.navigate(['/gimnasios']);
    return false;
  }

  return true;
};
