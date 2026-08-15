import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, of, timer } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AlertaService } from './alerta.service';
import { UserStateService } from './user-state.service';
import { StorageService } from './storage.service';
import { TiempoRealService } from './tiempo-real.service';

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

  private tiempoReal = inject(TiempoRealService);
  private escuchaTiempoReal?: Subscription;

  private leidas = new Set<string>();
  /**
   * Firmas por las que ya sonó el aviso en esta sesión. Sin esto, un aviso que
   * el usuario todavía no abrió volvería a sonar en cada sondeo (cada 5 min):
   * "no leído" y "ya notificado" son estados distintos.
   */
  private notificadas = new Set<string>();
  private sondeo?: Subscription;
  /** Usuario para el que corre el sondeo actual. */
  private usuarioSondeo = '';
  /** La primera carga no suena: al entrar, todo es "nuevo" y sería un ruido inútil. */
  private primeraCarga = true;

  /**
   * Arranca el sondeo periódico. Idempotente: llamarlo dos veces no duplica.
   *
   * El sondeo cada 5 minutos se mantiene como respaldo; lo normal es que el
   * aviso llegue por el canal en tiempo real en cuanto ocurre el cambio.
   */
  iniciar(): void {
    const usuario = this.userState.getUserId() || 'anon';
    // Si cambió la cuenta sin recargar la página (logout → login), el sondeo
    // vivo seguiría usando las firmas leídas del usuario anterior: se reinicia.
    if (this.sondeo && usuario === this.usuarioSondeo) return;
    this.detener();
    this.usuarioSondeo = usuario;
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

    // El servidor avisa cuando cambió algo que afecta a los avisos (una noticia
    // nueva, una membresía renovada) y aquí se piden de inmediato.
    this.tiempoReal.conectar();
    this.escuchaTiempoReal = this.tiempoReal.escuchar('avisos:revisar')
      .subscribe(() => this.refrescar());
  }

  /** Pide los avisos ahora mismo, sin esperar al siguiente sondeo. */
  private refrescar(): void {
    if (!this.storage.getToken() || this.storage.isTokenExpired()) return;
    this.http.get<{ avisos: Aviso[] }>(`${environment.apiUrl}/api/notificaciones`)
      .pipe(catchError(() => of({ avisos: [] as Aviso[] })))
      .subscribe(res => this.procesar(res.avisos || []));
  }

  detener(): void {
    this.sondeo?.unsubscribe();
    this.sondeo = undefined;
    this.escuchaTiempoReal?.unsubscribe();
    this.escuchaTiempoReal = undefined;
    this.tiempoReal.desconectar();
    this.primeraCarga = true;
    this.notificadas.clear();
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

    // Cada firma suena una sola vez por sesión, aunque siga sin leerse en los
    // sondeos siguientes. El globito sí sigue mostrando el total no leído.
    const porNotificar = nuevos.filter(a => !this.notificadas.has(a.firma));
    nuevos.forEach(a => this.notificadas.add(a.firma));

    // Solo se avisa de lo que apareció DESPUÉS de que el usuario ya estaba
    // dentro; si no, cada arranque de la app sonaría como una alarma.
    if (this.primeraCarga) {
      this.primeraCarga = false;
      if (nuevos.length > 0) this.alerta.pedirPermisos();
      return;
    }

    if (porNotificar.length === 0) return;

    const principal = porNotificar[0];
    const titulo = porNotificar.length === 1 ? principal.titulo : `${porNotificar.length} avisos nuevos`;
    const cuerpo = porNotificar.length === 1 ? principal.detalle : principal.titulo;
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
