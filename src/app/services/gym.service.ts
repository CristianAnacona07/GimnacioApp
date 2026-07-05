import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StorageService } from './storage.service';

export interface Gym {
  _id: string;
  nombre: string;
  slug: string;
  logo: string | null;
  slogan: string;
  colores: { primario: string; secundario: string; fondo: string; navbar: string; menu: string; dias: string };
  modulos: {
    rutinas: boolean; progreso: boolean; medidas: boolean;
    pagos: boolean; noticias: boolean; cronometro: boolean;
  };
  spotifyPlaylist?: string;
}

const GYM_KEY = 'gymActual';

@Injectable({ providedIn: 'root' })
export class GymService {
  private apiUrl = `${environment.apiUrl}/api/gym`;
  private gym$ = new BehaviorSubject<Gym | null>(this.getGym());

  constructor(private http: HttpClient) {}

  get gymCambio$(): Observable<Gym | null> {
    return this.gym$.asObservable();
  }

  buscar(q: string): Observable<Gym[]> {
    return this.http.get<Gym[]>(`${this.apiUrl}/buscar`, { params: { q } });
  }

  getBySlug(slug: string): Observable<Gym> {
    return this.http.get<Gym>(`${this.apiUrl}/${slug}`);
  }

  guardarGym(gym: Gym): void {
    localStorage.setItem(GYM_KEY, JSON.stringify(gym));
    this.gym$.next(gym);
  }

  getGym(): Gym | null {
    return StorageService.safeParse<Gym | null>(localStorage.getItem(GYM_KEY), null);
  }

  getGymId(): string | null {
    return this.getGym()?._id || null;
  }

  limpiarGym(): void {
    localStorage.removeItem(GYM_KEY);
    this.gym$.next(null);
  }

  moduloActivo(nombre: keyof Gym['modulos']): boolean {
    const gym = this.gym$.getValue();
    if (!gym) return true;
    return gym.modulos?.[nombre] !== false;
  }
}
