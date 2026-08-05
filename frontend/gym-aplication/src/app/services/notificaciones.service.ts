import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, of, timer } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AlertaService } from './alerta.service';
import { UserStateService } from './user-state.service';
import { StorageService } from './storage.service';

/** Aviso de la campanita. */
export interface Aviso {
  /** Identidad estable del aviso ('membresias-vencidas', 'mi-membresia'…). */
  id: string;
  /** Encabezado bajo el que se agrupa en el panel ('Clientes', 'Tu cuenta'…). */
  grupo: string;
  nivel: 'alta' | 'media' | 'info' | 'ok';
  icono: string;
  titulo: string;
  detalle: string;
  ruta: string;
  /** Cambia cuando cambia el contenido; es lo que marca el aviso como no leído. */
  firma: string;
}

/** Cada cuánto se vuelven a pedir los avisos mientras la app está abierta. */
const INTERVALO_MS = 5 * 60 * 1000;

/**
 * Avisos del navbar.
 *
 * El backend los recalcula en cada consulta, así que aquí no se guarda nada:
 * solo se recuerda qué firmas ya vio el usuario, para saber cuáles son nuevas.
 * Cuando aparece una firma que no estaba, se dispara el aviso sonoro — el mismo
 * timbre del cronómetro, y en el móvil además una notificación del sistema.
 *
 * Las firmas leídas van por usuario: en un equipo compartido (la tablet de
 * recepción, por ejemplo) el siguiente en entrar no hereda los avisos ya
 * leídos por el anterior.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private http = inject(HttpClient);
  private alerta = inject(AlertaService);
  private userState = inject(UserStateService);
  private storage = inject(StorageService);

  private readonly avisosSubject = new BehaviorSubject<Aviso[]>([]);
  private readonly noLeidosSubject = new BehaviorSubject<number>(0);

  /** Lista completa de avisos vigentes. */
  readonly avisos$: Observable<Aviso[]> = this.avisosSubject.asObservable();
  /** Cuántos de ellos el usuario todavía no ha visto (el número del globito). */
  readonly noLeidos$: Observable<number> = this.noLeidosSubject.asObservable();

  private leidas = new Set<string>();
  private sondeo?: Subscription;
  /** La primera carga no suena: al entrar, todo es "nuevo" y sería un ruido inútil. */
  private primeraCarga = true;

  /** Arranca el sondeo periódico. Idempotente: llamarlo dos veces no duplica. */
  iniciar(): void {
    if (this.sondeo) return;
    this.leidas = this.cargarLeidas();
    this.sondeo = timer(0, INTERVALO_MS)
      .pipe(
        switchMap(() => {
          // El sondeo se para solo cuando ya no hay sesión. Sin esto seguiría
          // vivo tras un logout o un token expirado (el servicio es singleton y
          // sobrevive al componente), y cada consulta acabaría en un 401 que el
          // interceptor traduce en otro salto a /login.
          if (!this.storage.getToken() || this.storage.isTokenExpired()) {
            this.detener();
            return of({ avisos: [] as Aviso[] });
          }
          return this.http
            .get<{ avisos: Aviso[] }>(`${environment.apiUrl}/api/notificaciones`)
            .pipe(catchError(() => of({ avisos: [] as Aviso[] })));
        })
      )
      .subscribe(res => this.procesar(res.avisos || []));
  }

  detener(): void {
    this.sondeo?.unsubscribe();
    this.sondeo = undefined;
    this.primeraCarga = true;
    this.avisosSubject.next([]);
    this.noLeidosSubject.next(0);
  }

  /** Marca todo lo visible como leído (al abrir el panel de la campana). */
  marcarTodoLeido(): void {
    this.avisosSubject.value.forEach(a => this.leidas.add(a.firma));
    this.guardarLeidas();
    this.noLeidosSubject.next(0);
  }

  esNoLeido(aviso: Aviso): boolean {
    return !this.leidas.has(aviso.firma);
  }

  private procesar(avisos: Aviso[]): void {
    const nuevos = avisos.filter(a => !this.leidas.has(a.firma));

    this.avisosSubject.next(avisos);
    this.noLeidosSubject.next(nuevos.length);

    // Solo se avisa de lo que apareció DESPUÉS de que el usuario ya estaba
    // dentro; si no, cada arranque de la app sonaría como una alarma.
    if (this.primeraCarga) {
      this.primeraCarga = false;
      if (nuevos.length > 0) this.alerta.pedirPermisos();
      return;
    }

    if (nuevos.length === 0) return;

    const principal = nuevos[0];
    const titulo = nuevos.length === 1 ? principal.titulo : `${nuevos.length} avisos nuevos`;
    const cuerpo = nuevos.length === 1 ? principal.detalle : principal.titulo;
    this.alerta.avisar(titulo, cuerpo);
  }

  // ── Firmas ya vistas ──────────────────────────────────────────────────────
  private get clave(): string {
    return `avisosLeidos:${this.userState.getUserId() || 'anon'}`;
  }

  private cargarLeidas(): Set<string> {
    try {
      const crudo = localStorage.getItem(this.clave);
      return new Set<string>(crudo ? JSON.parse(crudo) : []);
    } catch {
      return new Set<string>();
    }
  }

  private guardarLeidas(): void {
    try {
      // Solo se conservan las firmas de los avisos vigentes: las viejas ya no
      // pueden repetirse (llevan el número dentro) y solo harían crecer el
      // localStorage sin límite.
      const vigentes = this.avisosSubject.value.map(a => a.firma);
      const aGuardar = vigentes.filter(f => this.leidas.has(f));
      localStorage.setItem(this.clave, JSON.stringify(aGuardar));
    } catch {}
  }
}
