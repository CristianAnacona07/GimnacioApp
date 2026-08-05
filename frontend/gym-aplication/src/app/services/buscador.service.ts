import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Persona encontrada por la lupa (socio, entrenador o admin del gym). */
export interface PersonaBuscada {
  _id: string;
  nombre: string;
  email: string;
  role: 'socio' | 'entrenador' | 'admin' | 'superadmin';
  fotoUrl: string;
  codigoAcceso: string;
  /** Cédula; vacía si no está registrada. */
  identificacion: string;
  /** Días de membresía: negativo = vencida, null = sin membresía. */
  diasRestantes: number | null;
}

/** Plan encontrado por la lupa. */
export interface PlanBuscado {
  _id: string;
  nombre: string;
  precio?: number;
  dias?: number;
}

export interface ResultadoBusqueda {
  personas: PersonaBuscada[];
  planes: PlanBuscado[];
}

/**
 * Búsqueda global del navbar. El backend ya recorta por rol, así que lo que
 * llegue aquí es exactamente lo que este usuario puede abrir.
 */
@Injectable({ providedIn: 'root' })
export class BuscadorService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  buscar(q: string): Observable<ResultadoBusqueda> {
    return this.http.get<ResultadoBusqueda>(`${this.api}/api/buscador`, {
      params: new HttpParams().set('q', q)
    });
  }
}
