import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SedeService } from './sede.service';

/** Socio devuelto por la búsqueda en recepción. */
export interface SocioBuscado {
  _id: string;
  nombre: string;
  email: string;
  fotoUrl?: string;
  codigoAcceso: string;
  /** Cédula del socio; vacía si no la tiene registrada. */
  identificacion?: string;
  diasRestantes: number;
}

/** Datos del socio tras un check-in exitoso. */
export interface SocioCheckin {
  _id: string;
  nombre: string;
  fotoUrl?: string;
  diasRestantes: number;
  estado: 'activo' | 'vencido';
  asistenciasMes: number;
}

/** Resultado del envío de WhatsApp asociado al check-in. */
export interface WhatsappCheckin {
  enviado: boolean;
  motivo?: string;
  link: string | null;
}

/** Respuesta completa del endpoint de check-in. */
export interface ResultadoCheckin {
  socio: SocioCheckin;
  yaRegistradoHoy: boolean;
  whatsapp: WhatsappCheckin;
}

/** Cuerpo aceptado por el check-in: por código o por usuarioId. */
export interface CheckinPayload {
  codigo?: string;
  usuarioId?: string;
  metodo?: 'qr' | 'codigo' | 'manual';
}

/** Socio embebido en una asistencia del día. */
export interface AsistenciaSocio {
  _id: string;
  nombre: string;
  fotoUrl?: string;
}

/** Asistencia registrada hoy. */
export interface AsistenciaHoy {
  _id: string;
  fecha: string;
  metodo: 'qr' | 'codigo' | 'manual';
  socio: AsistenciaSocio;
}

/** Código de acceso del socio logueado. */
export interface MiCodigo {
  codigoAcceso: string;
}

@Injectable({ providedIn: 'root' })
export class AsistenciaService {
  private url = `${environment.apiUrl}/api/asistencia`;

  constructor(private http: HttpClient, private sedes: SedeService) {}

  /** Busca socios por nombre, email, cédula o código para el check-in manual. */
  buscar(q: string): Observable<SocioBuscado[]> {
    const params = new HttpParams().set('q', q);
    return this.http.get<SocioBuscado[]>(`${this.url}/buscar`, { params });
  }

  /** Registra la asistencia de un socio (por código, usuarioId o manual). */
  checkin(payload: CheckinPayload): Observable<ResultadoCheckin> {
    // La sede viaja en el cuerpo: para el admin es la que tiene elegida en
    // la barra. Un empleado la tiene propia y el backend ignora esto.
    return this.http.post<ResultadoCheckin>(`${this.url}/checkin`, { ...payload, sede: this.sedes.parametro || undefined });
  }

  /** Lista las asistencias registradas en el día actual. */
  hoy(): Observable<AsistenciaHoy[]> {
    return this.http.get<AsistenciaHoy[]>(`${this.url}/hoy`, { params: this.sedes.comoParams() });
  }

  /** Obtiene el código de acceso del socio logueado (para generar su QR). */
  miCodigo(): Observable<MiCodigo> {
    return this.http.get<MiCodigo>(`${this.url}/mi-codigo`);
  }
}
