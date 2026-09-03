import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap, filter, switchMap, catchError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Sede {
  _id: string;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
  activa: boolean;
  /** La casa matriz: parado en ella se ven todas las sedes. */
  esPrincipal?: boolean;
  /** Quién administra este local. Nulo si nadie quedó a cargo. */
  admin?: { nombre: string; email: string } | null;
}

/** Valor de reposo cuando el gimnasio no tiene sedes cargadas. */
export const TODAS_LAS_SEDES = 'todas';

/**
 * Las sedes del gimnasio y cuál está mirando el administrador.
 *
 * La sede elegida NO va en el token: es un filtro adentro del mismo gimnasio,
 * no una frontera (esa sigue siendo el gymId). Por eso cambiar de sede no
 * reemite nada ni cierra la sesión — viaja como un parámetro más de cada
 * consulta, y el backend comprueba que sea del gimnasio del token.
 */
@Injectable({ providedIn: 'root' })
export class SedeService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/sedes`;

  private sedesSubject = new BehaviorSubject<Sede[]>([]);
  /** Las sedes activas del gimnasio. Vacío mientras no se hayan pedido. */
  sedes$ = this.sedesSubject.asObservable();

  // Arranca en null a propósito: hasta que no se sepan las sedes del gimnasio
  // no hay respuesta correcta, y una pantalla que consulte antes pediría sin
  // filtro y mostraría los socios de TODAS las sedes por un instante.
  private activaSubject = new BehaviorSubject<string | null>(null);

  /** Emite recién cuando se sabe qué sede corresponde. Nunca antes. */
  sedeActiva$ = this.activaSubject.pipe(
    filter((v): v is string => v !== null)
  ) as Observable<string>;

  private cargadas = false;
  /** La sede a la que pertenece quien está usando la app. */
  private miSedeId: string | null = null;

  get sedes(): Sede[] { return this.sedesSubject.value; }
  get sedeActiva(): string { return this.activaSubject.value ?? TODAS_LAS_SEDES; }

  /**
   * El selector sólo tiene sentido con dos locales o más Y para quien maneja
   * la casa matriz. El administrador de una sede está anclado a la suya: su
   * local es aparte y no tiene por qué ver los demás.
   */
  get tieneVariasSedes(): boolean {
    if (this.sedesSubject.value.length < 2) return false;
    if (!this.miSedeId) return true;              // sin sede propia, puede mirar
    return !!this.miSede?.esPrincipal;
  }

  get nombreActiva(): string {
    return this.sedesSubject.value.find(s => s._id === this.sedeActiva)?.nombre || 'Sin sede';
  }

  get matriz(): Sede | undefined {
    return this.sedesSubject.value.find(s => s.esPrincipal);
  }

  /**
   * Si el admin está parado en la casa matriz. Desde ahí ve todas las sedes y
   * puede administrar permisos y configuración; desde un local común, no.
   */
  get enLaMatriz(): boolean {
    if (!this.sedesSubject.value.length) return true;   // gimnasio de un solo local
    return !!this.matriz && this.sedeActiva === this.matriz._id;
  }

  /**
   * Está mirando un local que no es el suyo: puede ver, pero no tocar. Cada
   * sede se maneja aparte, con su propio administrador, así que modificar o
   * borrar lo del local de al lado no le corresponde.
   */
  get soloLectura(): boolean {
    if (!this.sedesSubject.value.length) return false;   // gimnasio de un solo local
    if (!this.miSedeId) return false;                    // sin sede propia no se restringe
    return this.sedeActiva !== this.miSedeId;
  }

  get miSede(): Sede | undefined {
    return this.sedesSubject.value.find(s => s._id === this.miSedeId);
  }

  /**
   * El parámetro que hay que mandarle al backend, o null si no hay que filtrar.
   * Un gimnasio de un solo local nunca filtra, y así sus consultas quedan
   * exactamente como antes de que existieran las sedes.
   */
  get parametro(): string | null {
    return this.sedeActiva === TODAS_LAS_SEDES ? null : this.sedeActiva;
  }

  /**
   * Los `params` de una petición: `{ sede }` o vacío. Se devuelve vacío en vez
   * de `sede=todas` para que la URL de un gimnasio de un solo local quede
   * idéntica a la de antes.
   */
  comoParams(): Record<string, string> {
    const p = this.parametro;
    return p ? { sede: p } : {};
  }

  /** Se pide una vez por sesión; `forzar` la recarga tras crear o editar. */
  cargar(forzar = false): Observable<Sede[]> {
    if (this.cargadas && !forzar) return of(this.sedesSubject.value);
    // La sede propia se pide PRIMERO y se espera: sin ella no se sabe en qué
    // local pararse, y arrancar en el equivocado hace que todo lo que se dé
    // de alta caiga en la sede que no es.
    return this.http.get<{ sedeId: string | null }>(`${this.apiUrl}/mia`).pipe(
      catchError(() => of({ sedeId: null })),
      tap(r => { this.miSedeId = r?.sedeId || null; }),
      switchMap(() => this.http.get<Sede[]>(this.apiUrl)),
      tap({
        next: (sedes) => {
          const lista = sedes || [];
          this.sedesSubject.next(lista);
          this.cargadas = true;
          this.restaurarElegida(lista);
        },
        // Si la consulta falla hay que emitir igual: si no, las pantallas se
        // quedan esperando una sede que nunca llega y no cargan nada.
        error: () => this.restaurarElegida([])
      })
    );
  }

  elegir(sedeId: string): void {
    this.activaSubject.next(sedeId || TODAS_LAS_SEDES);
    try {
      localStorage.setItem(this.clave(), this.sedeActiva);
    } catch {
      // Modo incógnito o almacenamiento lleno: la elección vale para esta
      // pantalla igual, sólo no sobrevive a recargar.
    }
  }

  /**
   * `admin` es opcional: si viene, se crea el administrador de esa sede y se le
   * manda su clave temporal por correo. Sin él la sede queda sin responsable y
   * la maneja quien la creó.
   */
  crear(datos: {
    nombre: string; direccion?: string; telefono?: string;
    admin?: { nombre: string; email: string };
  }): Observable<any> {
    return this.http.post<any>(this.apiUrl, datos);
  }

  editar(id: string, datos: Partial<Sede>): Observable<Sede> {
    return this.http.put<Sede>(`${this.apiUrl}/${id}`, datos);
  }

  /** Mueve a una persona de sede. null la deja sin sede. */
  asignar(usuarioId: string, sedeId: string | null): Observable<any> {
    return this.http.put(`${this.apiUrl}/asignar/${usuarioId}`, { sedeId });
  }

  desactivar(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  /** Al cerrar sesión o cambiar de gimnasio, el estado no puede quedar pegado. */
  limpiar(): void {
    this.sedesSubject.next([]);
    this.activaSubject.next(TODAS_LAS_SEDES);
    this.cargadas = false;
  }

  // La elección se guarda por gimnasio: la misma persona puede ser admin en dos
  // y las sedes de uno no existen en el otro.
  private leerGuardada(): string {
    try { return localStorage.getItem(this.clave()) || ''; } catch { return ''; }
  }

  private clave(): string {
    let gymId = '';
    try {
      gymId = JSON.parse(localStorage.getItem('gymActual') || '{}')?._id || '';
    } catch { /* dato corrupto: se cae en la clave sin gimnasio */ }
    return `sedeActiva:${gymId}`;
  }

  private restaurarElegida(sedes: Sede[]): void {
    // Sin sedes cargadas no hay nada que elegir y el gimnasio funciona como
    // siempre: el parámetro queda vacío y ninguna consulta filtra.
    if (!sedes.length) { this.activaSubject.next(TODAS_LAS_SEDES); return; }

    // Cada uno arranca en SU local. El administrador de una sede entra y está
    // en la suya, sin elegir nada: si arrancara en la matriz, todo lo que diera
    // de alta caería en la sede equivocada.
    //
    // Se usa la sede propia aunque no esté en la lista: si la desactivaron, lo
    // correcto es que siga viendo la suya (vacía o no), no que caiga en la
    // matriz y termine viendo un local que no le corresponde.
    if (this.miSedeId) {
      const guardadaPropia = this.leerGuardada();
      const puedeElegir = !!this.miSede?.esPrincipal;
      const vale = puedeElegir && sedes.some(s => s._id === guardadaPropia);
      this.activaSubject.next(vale ? guardadaPropia : this.miSedeId);
      return;
    }

    let guardada = '';
    try { guardada = localStorage.getItem(this.clave()) || ''; } catch { /* sin almacenamiento */ }

    // Si lo guardado ya no existe (desactivaron la sede, o es de otro gimnasio)
    // se cae a la matriz, que muestra todo, en vez de dejar una lista vacía sin
    // explicación.
    const vale = sedes.some(s => s._id === guardada);
    const matriz = sedes.find(s => s.esPrincipal) || sedes[0];
    this.activaSubject.next(vale ? guardada : matriz._id);
  }
}
