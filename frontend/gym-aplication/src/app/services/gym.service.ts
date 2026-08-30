import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StorageService } from './storage.service';

/** Una franja de la tabla de horarios de la página pública. */
export interface FilaHorario { dias: string; horas: string; }
/**
 * Una tarjeta dentro de una sección de la página pública.
 *
 * Solo la imagen es obligatoria: una tarjeta puede ser una foto sola (una
 * galería), una foto con nombre (un catálogo) o las cuatro cosas (un servicio
 * con precio). La plantilla muestra únicamente los campos con contenido.
 */
export interface TarjetaSeccion {
  imagen: string;
  titulo?: string;
  descripcion?: string;
  precio?: string;
}

/**
 * Una sección que el gimnasio crea a mano. Su `nombre` es a la vez el título
 * del bloque y el texto del botón que aparece en el menú de la página: crear
 * la sección crea el botón, no hay que configurarlo aparte.
 */
export interface SeccionLanding {
  id: string;
  nombre: string;
  tarjetas: TarjetaSeccion[];
}

/**
 * Contenido de la página pública del gimnasio. Vive dentro del gym porque es
 * suyo: se edita con el resto de su configuración y viaja en la misma consulta.
 */
export interface Landing {
  activa: boolean;
  portada: {
    imagen: string;
    titulo: string;
    subtitulo: string;
    textoBoton: string;
    /**
     * Qué parte de la foto queda a la vista, como `object-position`. La portada
     * tiene alto fijo y la foto se recorta para llenarla: esto elige qué se
     * conserva. '50% 50%' es el centro.
     */
    posicion: string;
    /**
     * Pixeles que la foto baja mas alla de su tope, hasta la linea del menu.
     * El hueco que deja arriba no se ve: ahi esta la barra fija tapando.
     */
    desplazamiento: number;
    /**
     * Color del titulo y de la frase sobre la portada. El texto va encima de
     * la foto que elige el gimnasio, asi que el blanco fijo de antes se perdia
     * sobre cualquier imagen clara. Vacio = lo decide el CSS (blanco con foto).
     */
    colorTitulo: string;
    colorSubtitulo: string;
  };
  /** Las que crea el gimnasio. Vacío = la página solo tiene lo fijo. */
  secciones: SeccionLanding[];
  /** Bloque fijo, como horarios y contacto: siempre está. */
  sobreNosotros: { titulo: string; texto: string; imagen: string };
  horarios: { activo?: boolean; titulo: string; filas: FilaHorario[] };
  planes: { activo: boolean; titulo: string };
  noticias: { activo: boolean; titulo: string };
  contacto: {
    activo?: boolean; direccion: string; telefono: string; whatsapp: string;
    email: string; instagram: string; facebook: string; mapaUrl: string;
  };
}

/** Página recién estrenada: apagada, con todas las secciones listas y vacías. */
export function landingVacia(): Landing {
  return {
    activa: false,
    portada: {
      imagen: '', titulo: '', subtitulo: '', textoBoton: '',
      posicion: '50% 50%', desplazamiento: 0,
      // Vacíos a propósito: sin elegir, el CSS sigue poniendo el blanco de
      // siempre, así que las páginas ya publicadas no cambian de aspecto.
      colorTitulo: '', colorSubtitulo: ''
    },
    secciones: [],
    sobreNosotros: { titulo: '', texto: '', imagen: '' },
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
 * después. Sin esto, leer `landing.horarios.filas` de un documento viejo rompe
 * la página entera, así que todo lo que la lee pasa antes por aquí.
 */
export function normalizarLanding(guardada: Partial<Landing> | undefined | null): Landing {
  const base = landingVacia();
  if (!guardada) return base;
  return {
    activa: !!guardada.activa,
    portada:       { ...base.portada,       ...(guardada.portada || {}) },
    // Cada sección se completa a su vez: una guardada a medias (sin tarjetas)
    // no debe romper la página entera.
    secciones: (guardada.secciones || []).map((s) => ({
      id: s?.id || Math.random().toString(36).slice(2, 10),
      nombre: s?.nombre || '',
      tarjetas: (s?.tarjetas || []).map((t) => ({
        imagen: t?.imagen || '',
        titulo: t?.titulo || '',
        descripcion: t?.descripcion || '',
        precio: t?.precio || ''
      }))
    })),
    sobreNosotros: { ...base.sobreNosotros, ...(guardada.sobreNosotros || {}) },
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
    return slug ? `/g/${slug}` : '/login';
  }

  moduloActivo(nombre: keyof Gym['modulos']): boolean {
    const gym = this.gym$.getValue();
    if (!gym) return true;
    return gym.modulos?.[nombre] !== false;
  }
}
