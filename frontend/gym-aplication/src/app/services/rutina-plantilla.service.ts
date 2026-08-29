import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RutinaPlantillaEjercicio {
  _id?: string;
  nombre: string;
  series: number;
  repeticiones: string;
  instrucciones?: string;
  imagenUrl?: string;
}

export interface RutinaPlantillaDia {
  _id?: string;
  dia: string;
  enfoque: string | null;
  ejercicios: RutinaPlantillaEjercicio[];
}

/** Una plantilla es una SEMANA: varios días, cada uno con sus ejercicios. */
export interface RutinaPlantilla {
  _id: string;
  nombre: string;
  dias: RutinaPlantillaDia[];
}

export interface DatosPlantilla {
  nombre?: string;
  dias?: RutinaPlantillaDia[];
}

/**
 * Plantillas de rutina semanal: catálogo reutilizable a nivel de gimnasio,
 * exclusivo del administrador — ver comentario del modelo RutinaPlantilla
 * (schema.prisma) para el porqué. El backend ya rechaza con 403 a cualquier
 * otro rol; acá solo se llama desde la pantalla de rutinas cuando el usuario
 * logueado es admin.
 */
@Injectable({ providedIn: 'root' })
export class RutinaPlantillaService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/rutina-plantillas`;

  listar(): Observable<RutinaPlantilla[]> {
    return this.http.get<RutinaPlantilla[]>(this.url);
  }

  crear(datos: DatosPlantilla): Observable<RutinaPlantilla> {
    return this.http.post<RutinaPlantilla>(this.url, datos);
  }

  actualizar(id: string, datos: DatosPlantilla): Observable<RutinaPlantilla> {
    return this.http.put<RutinaPlantilla>(`${this.url}/${id}`, datos);
  }

  /**
   * Crea de una todas las rutinas de la semana para ese socio. Sin
   * `sobrescribir` responde 409 si el socio ya tiene rutina en alguno de
   * esos días, con `diasEnConflicto` para poder preguntar antes de pisar.
   */
  aplicar(id: string, usuarioId: string, sobrescribir = false): Observable<{ mensaje: string; dias: string[] }> {
    return this.http.post<{ mensaje: string; dias: string[] }>(`${this.url}/${id}/aplicar`, { usuarioId, sobrescribir });
  }

  eliminar(id: string): Observable<any> {
    return this.http.delete(`${this.url}/${id}`);
  }
}
