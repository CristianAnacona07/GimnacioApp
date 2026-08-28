import { Injectable } from '@angular/core';

/**
 * Servicio centralizado para gestión de localStorage
 * Evita pérdida de datos importantes (cronómetro, preferencias) al limpiar la sesión
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  // Claves que se preservan al limpiar la sesión de autenticación
  private readonly PRESERVED_KEYS = [
    'gymActual',           // Gym seleccionado
    'crono_endTime',       // Estado del cronómetro
    'crono_total',
    'crono_paused',
    'crono_series',        // Series contadas del ejercicio en curso
    'theme',               // Tema dark/light
    'ultimoResetRutina',   // Control de reset diario
    'progreso_formIdx',    // Formulario de progreso abierto
    'progreso_formData',   // Datos del formulario de progreso
    'progreso_ejercicio'   // Ejercicio del formulario
  ];

  // Prefijos de claves dinámicas (una por usuario) que también se preservan.
  // Las firmas de avisos leídos llevan el userId en la clave, así que guardarlas
  // entre sesiones no filtra nada entre cuentas — y si se borraran, la campana
  // volvería a marcar como nuevos avisos ya revisados en cada login.
  private readonly PRESERVED_PREFIXES = ['avisosLeidos:'];

  // Claves relacionadas con autenticación que se deben eliminar
  private readonly AUTH_KEYS = [
    'token',
    'usuario',
    'userId',
    'role',
    'nombre'
  ];

  /**
   * Limpia SOLO los datos de autenticación, preservando cronómetro y preferencias
   */
  clearAuthSession(): void {
    this.AUTH_KEYS.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Parseo seguro de un valor JSON de localStorage (nunca lanza).
   */
  static safeParse<T = any>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * Decodifica el payload de un JWT (base64url) sin lanzar.
   * Centraliza el decodificado usado por los guards para evitar duplicación.
   * NOTA: no verifica la firma (el servidor es la fuente autoritativa);
   * es solo para lectura de claims en el cliente.
   */
  decodeTokenPayload(token: string | null): any | null {
    if (!token) return null;
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(part));
    } catch {
      return null;
    }
  }

  /**
   * Limpia la sesión completa pero preserva claves específicas.
   * No usa localStorage.clear() (regla del proyecto): elimina toda clave
   * que no esté en la lista de preservadas, de forma robusta ante nuevas claves.
   */
  clearSessionPreservingData(): void {
    const preserved = new Set(this.PRESERVED_KEYS);
    Object.keys(localStorage)
      .filter(key => !preserved.has(key) && !this.PRESERVED_PREFIXES.some(p => key.startsWith(p)))
      .forEach(key => localStorage.removeItem(key));
  }

  /**
   * Obtiene el token actual
   */
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Obtiene el gym seleccionado (slug/valor almacenado en 'gymActual').
   * Centraliza el acceso a localStorage para que los guards no lo lean directo.
   */
  getGym(): string | null {
    return localStorage.getItem('gymActual');
  }

  /**
   * Guarda el token
   */
  setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  /**
   * La cuenta arrancó con contraseña temporal (superadmin/recepción la
   * generaron) y todavía no la cambió: el guard usa esto para no dejarla
   * entrar a ninguna otra pantalla hasta que lo haga.
   */
  getDebeCambiarPassword(): boolean {
    return localStorage.getItem('debeCambiarPassword') === '1';
  }

  setDebeCambiarPassword(valor: boolean): void {
    localStorage.setItem('debeCambiarPassword', valor ? '1' : '0');
  }

  /**
   * Verifica si el token está expirado
   */
  isTokenExpired(): boolean {
    const payload = this.decodeTokenPayload(this.getToken());
    if (!payload?.exp) return true;
    return payload.exp * 1000 < Date.now();
  }

  /**
   * Obtiene el tiempo restante del token en milisegundos
   */
  getTokenTimeRemaining(): number {
    const payload = this.decodeTokenPayload(this.getToken());
    if (!payload?.exp) return 0;
    return Math.max(0, payload.exp * 1000 - Date.now());
  }

  /**
   * Verifica si el token expira pronto (menos de 30 minutos).
   * El token vive 8h, por lo que el umbral debe ser corto.
   */
  isTokenExpiringSoon(): boolean {
    const remaining = this.getTokenTimeRemaining();
    const THIRTY_MIN_MS = 30 * 60 * 1000;
    return remaining > 0 && remaining < THIRTY_MIN_MS;
  }
}
