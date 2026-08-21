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

    // Enlace de "primera vez" (enviarPasswordTemporal en el backend) reusado
    // con la sesión de esa misma activación todavía viva: no lo mandamos
    // adentro en silencio — el propio Login lo dice explícitamente y ofrece
    // ir al panel, en vez de que este guard lo redirija sin avisar.
    if (route.queryParamMap.get('email')) return true;

    // Sesión activa → redirigir según rol del token (única fuente de verdad).
    // El superadmin puede quedarse en el login para entrar como miembro de un
    // gimnasio (al iniciar sesión se sobrescribe su sesión). No lo redirigimos.
    const role = payload.role?.toLowerCase().trim();
    if (role === 'superadmin') return true;
    if (role === 'admin') router.navigate(['/admin']);
    else router.navigate(['/socio']);
    return false;
  }

  // Sin token → al login universal; no hace falta gimnasio elegido.
  return true;
};
