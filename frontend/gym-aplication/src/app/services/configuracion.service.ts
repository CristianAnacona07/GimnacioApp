import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Gym } from './gym.service';

/** Lector de huella / torniquete dado de alta en el gimnasio. */
export interface Dispositivo {
  _id: string;
  nombre: string;
  serie: string;
  marca: string;
  activo: boolean;
  ultimaConexion: string | null;
  createdAt?: string;
  /** Solo viene en la respuesta de crear o regenerar: no se puede volver a leer después. */
  apiKey?: string;
}

/** Huella asociada a un socio, dentro de UN equipo puntual. */
export interface HuellaAsociada {
  _id: string;
  huellaId: number;
  socio: { _id: string; nombre: string; fotoUrl?: string };
}

/** Entrada del registro de auditoría. */
export interface RegistroAuditoria {
  _id: string;
  accion: string;
  recurso?: string;
  recursoId?: string;
  actorRole?: string;
  detalle?: any;
  ip?: string;
  createdAt: string;
}

/** Respuesta paginada genérica del backend (`?page=…`). */
export interface Pagina<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Resultado de importar socios desde un CSV. */
export interface ResultadoImportacion {
  creados: number;
  omitidos: number;
  errores?: string[];
}

/**
 * Todo lo que cuelga de la sección Configuración del admin: datos del gimnasio,
 * respaldo en CSV, auditoría, verificación en dos pasos y equipos de acceso.
 *
 * Agrupa endpoints que ya existían en el backend pero que ninguna pantalla
 * usaba, más los de dispositivos.
 */
@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  // ── Datos del gimnasio ────────────────────────────────────────────────
  /** Guarda nombre, logo, slogan, colores, módulos y playlist del gym. */
  guardarGimnasio(gymId: string, datos: Partial<Gym>): Observable<Gym> {
    return this.http.put<Gym>(`${this.api}/api/gym/${gymId}/configuracion`, datos);
  }

  // ── Respaldo en CSV ───────────────────────────────────────────────────
  /**
   * Los CSV se piden como blob (no como `<a href>`) porque la ruta exige el
   * token, y una descarga del navegador no pasaría por el interceptor.
   */
  exportarUsuarios(): Observable<Blob> {
    return this.http.get(`${this.api}/api/admin/export/usuarios`, { responseType: 'blob' });
  }

  exportarTransacciones(): Observable<Blob> {
    return this.http.get(`${this.api}/api/admin/export/transacciones`, { responseType: 'blob' });
  }

  importarUsuarios(csv: string): Observable<ResultadoImportacion> {
    return this.http.post<ResultadoImportacion>(`${this.api}/api/admin/import/usuarios`, { csv });
  }

  // ── Auditoría ─────────────────────────────────────────────────────────
  auditoria(page = 1, limit = 20): Observable<Pagina<RegistroAuditoria>> {
    return this.http.get<Pagina<RegistroAuditoria>>(`${this.api}/api/admin/audit`, {
      params: { page, limit }
    });
  }

  // ── Verificación en dos pasos ─────────────────────────────────────────
  iniciar2fa(): Observable<{ secret: string; otpauth: string }> {
    return this.http.post<{ secret: string; otpauth: string }>(`${this.api}/api/2fa/setup`, {});
  }

  activar2fa(code: string): Observable<{ ok: boolean; backupCodes: string[] }> {
    return this.http.post<{ ok: boolean; backupCodes: string[] }>(`${this.api}/api/2fa/enable`, { code });
  }

  desactivar2fa(code: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.api}/api/2fa/disable`, { code });
  }

  // ── Cuenta ────────────────────────────────────────────────────────────
  cambiarPassword(actual: string, nueva: string): Observable<{ mensaje: string }> {
    return this.http.put<{ mensaje: string }>(`${this.api}/api/auth/cambiar-password`, { actual, nueva });
  }

  actualizarPerfil(userId: string, datos: { nombre?: string }): Observable<any> {
    return this.http.put(`${this.api}/api/auth/actualizar-perfil/${userId}`, datos);
  }

  // ── Equipos de control de acceso ──────────────────────────────────────
  dispositivos(): Observable<Dispositivo[]> {
    return this.http.get<Dispositivo[]>(`${this.api}/api/dispositivos`);
  }

  crearDispositivo(datos: { nombre: string; serie: string; marca?: string }): Observable<Dispositivo> {
    return this.http.post<Dispositivo>(`${this.api}/api/dispositivos`, datos);
  }

  actualizarDispositivo(id: string, datos: { nombre?: string; activo?: boolean }): Observable<Dispositivo> {
    return this.http.put<Dispositivo>(`${this.api}/api/dispositivos/${id}`, datos);
  }

  eliminarDispositivo(id: string): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.api}/api/dispositivos/${id}`);
  }

  /** Invalida la clave actual del equipo y entrega una nueva (una sola vez). */
  regenerarClaveDispositivo(id: string): Observable<{ apiKey: string }> {
    return this.http.post<{ apiKey: string }>(`${this.api}/api/dispositivos/${id}/regenerar-clave`, {});
  }

  huellas(dispositivoId: string): Observable<HuellaAsociada[]> {
    return this.http.get<HuellaAsociada[]>(`${this.api}/api/dispositivos/${dispositivoId}/huellas`);
  }

  asociarHuella(dispositivoId: string, datos: { huellaId: number; usuarioId: string }): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.api}/api/dispositivos/${dispositivoId}/huellas`, datos);
  }

  desasociarHuella(dispositivoId: string, huellaId: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.api}/api/dispositivos/${dispositivoId}/huellas/${huellaId}`);
  }

  /** Dispara la descarga de un blob ya recibido, con el nombre indicado. */
  descargar(blob: Blob, nombreArchivo: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  }
}
