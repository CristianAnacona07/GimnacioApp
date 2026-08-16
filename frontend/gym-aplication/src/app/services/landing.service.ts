import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Gym, Landing } from './gym.service';

// El contenido de la página vive en gym.service (es parte del gimnasio); aquí
// se re-exporta para que quien consuma este servicio no tenga que saberlo.
export type { Landing, FilaHorario, FotoGaleria } from './gym.service';
export { landingVacia } from './gym.service';

export interface PlanPublico {
  _id: string;
  nombre: string;
  precio: number;
  dias: number;
  descripcion: string;
  caracteristicas: string[];
}

export interface NoticiaPublica {
  _id: string;
  titulo: string;
  descripcion: string;
  imageUrl: string;
  createdAt: string;
}

/** Todo lo que la página pública necesita, en una sola respuesta. */
export interface DatosLanding {
  gym: Gym & { landing: Landing };
  planes: PlanPublico[];
  noticias: NoticiaPublica[];
}

@Injectable({ providedIn: 'root' })
export class LandingService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /** Contenido público de la página de un gimnasio (no requiere sesión). */
  obtener(slug: string): Observable<DatosLanding> {
    return this.http.get<DatosLanding>(`${this.apiUrl}/api/gym/${slug}/landing`);
  }

  /** Sube una imagen al almacén y devuelve su URL definitiva. */
  subirImagen(dataUrl: string, carpeta = 'landing'): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.apiUrl}/api/archivos/imagen`, { dataUrl, carpeta });
  }

  eliminarImagen(url: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/api/archivos/imagen`, { params: { url } });
  }
}
