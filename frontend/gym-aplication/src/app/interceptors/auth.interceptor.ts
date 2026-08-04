import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, retry, timeout } from 'rxjs/operators';
import { throwError, timer } from 'rxjs';
import { Router } from '@angular/router';
import { StorageService } from '../services/storage.service';

// Endpoints públicos de auth: un 401 aquí significa "credenciales inválidas",
// no "sesión expirada", así que no se debe cerrar sesión ni redirigir.
const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/register', '/api/auth/google', '/api/auth/forgot-password', '/api/auth/reset-password'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storageService = inject(StorageService);
  const router = inject(Router);
  const token = storageService.getToken();

  // El backend identifica al usuario por el JWT verificado; no se envía 'user-id'
  // controlable por el cliente (vector de suplantación/IDOR).
  const authReq = token
    ? req.clone({ setHeaders: { 'Authorization': `Bearer ${token}` } })
    : req;

  // Resiliencia solo para peticiones idempotentes (GET): timeout + reintentos
  // ante errores transitorios (sin respuesta o error de servidor).
  const esGet = req.method === 'GET';

  return next(authReq).pipe(
    timeout(20000),
    retry({
      count: esGet ? 2 : 0,
      delay: (error) => {
        const status = error?.status;
        const esTransitorio = status === 0 || status >= 500;
        if (esGet && esTransitorio) {
          return timer(800);
        }
        // No reintentar: propagar el error inmediatamente.
        return throwError(() => error);
      },
    }),
    catchError(err => {
      const esEndpointAuth = AUTH_ENDPOINTS.some(ep => req.url.includes(ep));
      // Solo cerrar sesión si había un token (sesión real) y no es un login fallido.
      if (err.status === 401 && token && !esEndpointAuth) {
        storageService.clearSessionPreservingData();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
