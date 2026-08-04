import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Detecta el gimnasio (tenant) a partir del subdominio de la URL.
 *
 * Convención: el slug del gym es el subdominio.
 *   https://sogafi.gimnasios.co  →  gym con slug "sogafi"
 *
 * Si el hostname no pertenece al dominio raíz configurado
 * (ej. gimnacio-app.vercel.app, localhost, la app Capacitor),
 * no hay tenant fijo y la app usa el selector de gimnasios de siempre.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  /** Slug del gym según el subdominio actual, o null si no aplica. */
  get slug(): string | null {
    if (typeof window === 'undefined') return null;
    return TenantService.slugDesdeHost(window.location.hostname);
  }

  /** true cuando la app corre en un subdominio de gimnasio. */
  get esSubdominio(): boolean {
    return this.slug !== null;
  }

  static slugDesdeHost(hostname: string): string | null {
    const raiz = environment.tenantRootDomain;
    if (!raiz || !hostname.toLowerCase().endsWith('.' + raiz)) return null;

    const sub = hostname.toLowerCase().slice(0, hostname.length - raiz.length - 1);
    // Sin subdominio, "www" o subdominios anidados → no es un tenant
    if (!sub || sub === 'www' || sub.includes('.')) return null;
    return sub;
  }
}
