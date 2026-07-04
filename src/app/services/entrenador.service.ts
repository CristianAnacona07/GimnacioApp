import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Socio {
  _id: string;
  nombre?: string;
  email?: string;
  fotoUrl?: string;
  role?: string;
  fechaVencimiento?: string;
  racha?: number;
  asistenciasMes?: number;
  datosPersonales?: {
    identificacion?: string;
    fechaNacimiento?: string;
    sexo?: string;
    pesoActual?: number;
    altura?: number;
    telefono?: string;
  };
}

export interface EjercicioLite {
  nombre: string;
  series?: number | string;
  repeticiones?: number | string;
  instrucciones?: string;
  imagenUrl?: string;
  completado?: boolean;
}

export interface RutinaLite {
  _id: string;
  usuarioId?: string;
  nombre?: string;
  dia?: string;
  enfoque?: string;
  ejercicios?: EjercicioLite[];
}

export interface SocioDetalle extends Socio {
  rutinas: RutinaLite[];
}

export interface NuevaRutina {
  nombre: string;
  dia: string;
  ejercicios: EjercicioLite[];
  enfoque?: string;
}

@Injectable({ providedIn: 'root' })
export class EntrenadorService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/entrenador`;

  // Socios asignados al entrenador autenticado.
  misSocios(): Observable<Socio[]> {
    return this.http.get<Socio[]>(`${this.url}/mis-socios`);
  }

  // Perfil del socio + sus rutinas.
  socioDetalle(id: string): Observable<SocioDetalle> {
    return this.http.get<SocioDetalle>(`${this.url}/socio/${id}`);
  }

  // Crea una rutina para un socio.
  crearRutina(socioId: string, rutina: NuevaRutina): Observable<RutinaLite> {
    return this.http.post<RutinaLite>(`${this.url}/socio/${socioId}/rutina`, rutina);
  }

  // Marca/desmarca un ejercicio de una rutina como completado.
  toggleEjercicio(rutinaId: string, idx: number, completado: boolean): Observable<RutinaLite> {
    return this.http.patch<RutinaLite>(`${this.url}/rutina/${rutinaId}/ejercicio/${idx}`, { completado });
  }
}
