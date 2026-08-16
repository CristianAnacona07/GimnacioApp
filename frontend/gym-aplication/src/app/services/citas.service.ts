import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Una franja del horario semanal de un profesional. */
export interface Franja { dia: string; desde: string; hasta: string; }

export interface Profesional {
  _id: string;
  nombre: string;
  fotoUrl?: string;
  role: string;
  cargo?: string | null;
  disponibilidad: Franja[];
}

/** Un día con sus horas libres. */
export interface DiaLibre { fecha: string; dia: string; horas: string[]; }

export interface ConfigAgenda {
  activa: boolean;
  duracionMin: number;
  precio: number;
  horasMinimasReserva: number;
  horasMinimasCancelacion: number;
  diasVisibles: number;
}

export interface Cita {
  _id: string;
  fecha: string;
  hora: string;
  duracionMin: number;
  estado: 'agendada' | 'cumplida' | 'cancelada' | 'ausente';
  precio: number;
  nota: string;
  socioId: { _id: string; nombre: string; fotoUrl?: string };
  profesionalId: { _id: string; nombre: string; fotoUrl?: string };
}

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

@Injectable({ providedIn: 'root' })
export class CitasService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/api/citas`;

  /** Fecha de HOY según el reloj del dispositivo, en formato YYYY-MM-DD.
   *  No se usa la del servidor: corre en UTC y correría el día. */
  static hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  static ahora(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  profesionales(): Observable<Profesional[]> {
    return this.http.get<Profesional[]>(`${this.api}/profesionales`);
  }

  /** Huecos libres de un profesional; se le manda el hoy y ahora del dispositivo. */
  libres(profesionalId: string): Observable<{ dias: DiaLibre[]; config: ConfigAgenda }> {
    return this.http.get<{ dias: DiaLibre[]; config: ConfigAgenda }>(
      `${this.api}/libres/${profesionalId}`,
      { params: { hoy: CitasService.hoy(), ahora: CitasService.ahora() } }
    );
  }

  agendar(datos: { profesionalId: string; fecha: string; hora: string; nota?: string }): Observable<any> {
    return this.http.post(this.api, datos);
  }

  mias(desde = CitasService.hoy()): Observable<Cita[]> {
    return this.http.get<Cita[]>(`${this.api}/mias`, { params: { desde } });
  }

  todas(desde = CitasService.hoy()): Observable<Cita[]> {
    return this.http.get<Cita[]>(this.api, { params: { desde } });
  }

  cancelar(id: string): Observable<any> {
    return this.http.patch(`${this.api}/${id}/cancelar`, {});
  }

  marcar(id: string, estado: 'cumplida' | 'ausente'): Observable<any> {
    return this.http.patch(`${this.api}/${id}/estado`, { estado });
  }

  miHorario(): Observable<{ disponibilidad: Franja[] }> {
    return this.http.get<{ disponibilidad: Franja[] }>(`${this.api}/disponibilidad`);
  }

  guardarHorario(disponibilidad: Franja[]): Observable<any> {
    return this.http.put(`${this.api}/disponibilidad`, { disponibilidad });
  }

  guardarHorarioDe(profesionalId: string, disponibilidad: Franja[]): Observable<any> {
    return this.http.put(`${this.api}/disponibilidad/${profesionalId}`, { disponibilidad });
  }
}
