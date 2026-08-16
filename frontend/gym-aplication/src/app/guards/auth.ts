import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { StorageService } from '../services/storage.service';
import { GymService } from '../services/gym.service';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const storageService = inject(StorageService);
  const gymService = inject(GymService);
  const token = storageService.getToken();
  const gym   = storageService.getGym();

  // Sin gym en memoria → al login universal (al entrar, la respuesta del
  // servidor trae el gimnasio de la cuenta y lo deja fijado).
  if (!gym) {
    router.navigate(['/login']);
    return false;
  }

  // Quien llega aquí sin sesión válida sale a la página pública del gimnasio,
  // el mismo destino que al cerrar sesión (allí tiene el botón de entrar).
  const salir = () => {
    router.navigateByUrl(gymService.rutaSalida());
    return false;
  };

  if (!token) return salir();

  if (storageService.isTokenExpired()) {
    storageService.clearSessionPreservingData();
    return salir();
  }

  const payload = storageService.decodeTokenPayload(token);
  if (!payload) {
    storageService.clearSessionPreservingData();
    return salir();
  }

  const role = payload.role?.toLowerCase().trim();

  // Root del panel según rol: se usa para redirigir cuando alguien entra
  // a una zona que no le corresponde.
  const rootPorRol = (r?: string): string => {
    if (r === 'admin' || r === 'superadmin') return '/admin';
    if (r === 'entrenador') return '/entrenador';
    if (r === 'empleado') return '/empleado';
    return '/socio';
  };

  // Zona admin: solo admin o superadmin.
  if (state.url.startsWith('/admin') && role !== 'admin' && role !== 'superadmin') {
    router.navigate([rootPorRol(role)]);
    return false;
  }

  // Zona entrenador: solo entrenador (admin/superadmin/socio a su propio panel).
  if (state.url.startsWith('/entrenador') && role !== 'entrenador') {
    router.navigate([rootPorRol(role)]);
    return false;
  }

  // Zona empleado: solo empleados (recepcionista, limpieza, nutricionista).
  if (state.url.startsWith('/empleado') && role !== 'empleado') {
    router.navigate([rootPorRol(role)]);
    return false;
  }

  // Zona socio: solo socio (admin/superadmin/entrenador tienen su propio panel).
  if (state.url.startsWith('/socio') && role !== 'socio') {
    router.navigate([rootPorRol(role)]);
    return false;
  }

  return true;
};
