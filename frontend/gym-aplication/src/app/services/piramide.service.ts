import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Una serie de la pirámide. Ambos campos pueden quedar vacíos. */
export interface SeriePiramide {
  peso: number | null;
  reps: number | null;
}

export interface Piramide {
  _id?: string;
  ejercicioNombre: string;
  series: SeriePiramide[];
  nota: string | null;
  updatedAt?: string;
}

/**
 * La pirámide que el socio anota para un ejercicio.
 *
 * No lleva usuarioId en ninguna llamada: el backend lo saca del token, así que
 * nadie puede leer ni pisar la de otro cambiando la URL.
 */
@Injectable({ providedIn: 'root' })
export class PiramideService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/piramides`;

  /** Devuelve null si el socio todavía no anotó ninguna. */
  obtener(ejercicio: string): Observable<Piramide | null> {
    return this.http.get<Piramide | null>(`${this.apiUrl}/${encodeURIComponent(ejercicio)}`);
  }

  /** Reemplaza por completo la pirámide guardada. */
  guardar(ejercicio: string, series: SeriePiramide[], nota: string | null): Observable<Piramide> {
    return this.http.put<Piramide>(`${this.apiUrl}/${encodeURIComponent(ejercicio)}`, { series, nota });
  }

  eliminar(ejercicio: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${encodeURIComponent(ejercicio)}`);
  }
}
