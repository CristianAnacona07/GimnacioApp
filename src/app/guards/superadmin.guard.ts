import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { StorageService } from '../services/storage.service';

export const superAdminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const storage = inject(StorageService);
  const token = storage.getToken();
  if (!token) { router.navigate(['/login']); return false; }

  const payload = storage.decodeTokenPayload(token);
  if (payload) {
    const expirado = !payload.exp || payload.exp * 1000 < Date.now();
    if (!expirado && payload.role?.toLowerCase().trim() === 'superadmin') return true;
  }

  // Token presente pero inválido/expirado/sin permiso: limpiar sesión obsoleta.
  storage.clearSessionPreservingData();
  router.navigate(['/login']);
  return false;
};
