import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StorageService } from './storage.service';

/** Una franja de la tabla de horarios de la página pública. */
export interface FilaHorario { dias: string; horas: string; }
/** Una foto de la galería de la página pública. */
export interface FotoGaleria { url: string; descripcion?: string; }

/**
 * Contenido de la página pública del gimnasio. Vive dentro del gym porque es
 * suyo: se edita con el resto de su configuración y viaja en la misma consulta.
 */
export interface Landing {
  activa: boolean;
  portada: { imagen: string; titulo: string; subtitulo: string; textoBoton: string };
  sobreNosotros: { activo: boolean; titulo: string; texto: string; imagen: string };
  galeria: { activo: boolean; titulo: string; fotos: FotoGaleria[] };
  horarios: { activo: boolean; titulo: string; filas: FilaHorario[] };
  planes: { activo: boolean; titulo: string };
  noticias: { activo: boolean; titulo: string };
  contacto: {
    activo: boolean; direccion: string; telefono: string; whatsapp: string;
    email: string; instagram: string; facebook: string; mapaUrl: string;
  };
}

/** Página recién estrenada: apagada, con todas las secciones listas y vacías. */
export function landingVacia(): Landing {
  return {
    activa: false,
    portada: { imagen: '', titulo: '', subtitulo: '', textoBoton: '' },
    sobreNosotros: { activo: true, titulo: '', texto: '', imagen: '' },
    galeria: { activo: true, titulo: '', fotos: [] },
    horarios: { activo: true, titulo: '', filas: [] },
    planes: { activo: true, titulo: '' },
    noticias: { activo: true, titulo: '' },
    contacto: {
      activo: true, direccion: '', telefono: '', whatsapp: '',
      email: '', instagram: '', facebook: '', mapaUrl: ''
    }
  };
}

/**
 * Completa una landing a medias con los valores por defecto.
 *
 * Lo guardado puede venir incompleto por muchas vías: un gimnasio creado antes
 * de que existiera la página, una edición parcial, o un campo nuevo añadido
 * después. Sin esto, leer `landing.galeria.fotos` de un documento viejo rompe
 * la página entera, así que todo lo que la lee pasa antes por aquí.
 */
export function normalizarLanding(guardada: Partial<Landing> | undefined | null): Landing {
  const base = landingVacia();
  if (!guardada) return base;
  return {
    activa: !!guardada.activa,
    portada:       { ...base.portada,       ...(guardada.portada || {}) },
    sobreNosotros: { ...base.sobreNosotros, ...(guardada.sobreNosotros || {}) },
    galeria:       { ...base.galeria,       ...(guardada.galeria || {}), fotos: guardada.galeria?.fotos || [] },
    horarios:      { ...base.horarios,      ...(guardada.horarios || {}), filas: guardada.horarios?.filas || [] },
    planes:        { ...base.planes,        ...(guardada.planes || {}) },
    noticias:      { ...base.noticias,      ...(guardada.noticias || {}) },
    contacto:      { ...base.contacto,      ...(guardada.contacto || {}) }
  };
}

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
  /** Ausente en los gimnasios creados antes de existir la página pública. */
  landing?: Landing;
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

  /**
   * A dónde va alguien que sale de la app: la página pública de su gimnasio.
   *
   * Es un único sitio a propósito — el cierre de sesión está repartido por el
   * menú, el panel del entrenador, la configuración y el vencimiento del token,
   * y todos deben coincidir. Si el gimnasio no publicó su página, la propia
   * landing manda al login, así que no hace falta comprobarlo aquí.
   */
  rutaSalida(): string {
    const slug = this.getGym()?.slug;
    return slug ? `/g/${slug}` : '/gimnasios';
  }

  moduloActivo(nombre: keyof Gym['modulos']): boolean {
    const gym = this.gym$.getValue();
    if (!gym) return true;
    return gym.modulos?.[nombre] !== false;
  }
}
