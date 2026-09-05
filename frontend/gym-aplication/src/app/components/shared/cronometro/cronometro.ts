import { Component, OnDestroy, OnInit, HostListener, ChangeDetectorRef, ElementRef, NgZone, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { IndexedDBService } from '../../../services/indexed-db.service';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Una chispa de los fuegos artificiales del final. El cohete sube hasta
 * `destinoY` y ahí se convierte en brasas, que caen con gravedad.
 */
interface Chispa {
  tipo: 'cohete' | 'brasa';
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  radio: number;
  vida: number;
  maxVida: number;
  destinoY?: number;
}

const KEY_END  = 'crono_endTime';
const KEY_TOTAL = 'crono_total';
const KEY_PAUSE = 'crono_paused';
const KEY_SERIES = 'crono_series';
const NOTIF_ID = 9001; // id fijo de la notificación nativa del cronómetro

@Component({
  selector: 'app-cronometro',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cronometro.html',
  styleUrl: './cronometro.css'
})
export class Cronometro implements OnInit, OnDestroy {
  presets = [
    { label: '30s', segundos: 30 },
    { label: '60s', segundos: 60 },
    { label: '90s', segundos: 90 },
    { label: '2min', segundos: 120 },
    { label: '3min', segundos: 180 },
    { label: '5min', segundos: 300 },
  ];

  tiempoTotal = 60;
  tiempoRestante = 60;
  activo = false;
  terminado = false;
  minimizado = true;
  enRutaSocio = false;
  permisoNotif: NotificationPermission = 'default';
  ultimoPresetUsado = 60; // Guardar último preset para reinicio rápido

  /**
   * Series completadas del ejercicio en curso. Sube UNA vez cada vez que
   * termina un descanso — o sea "hice la serie, descansé, va una" — no al
   * arrancar el cronómetro: si contara al arrancar, un descanso empezado por
   * error y cancelado ya habría sumado.
   *
   * Sin meta a propósito: cuenta libre (1, 2, 3, 4, 5…) y el socio la vuelve
   * a cero al pasar al siguiente ejercicio.
   */
  series = 0;

  private intervalo: any = null;
  private routeSub: any = null;
  private notifTimeout: any = null;
  private audioCtx: AudioContext | null = null;
  private readonly esNativo = Capacitor.isNativePlatform();
  private readonly COLORES = ['#cc0000','#22c55e','#3b82f6','#f97316','#a855f7','#eab308','#ec4899'];

  // ── Fuegos artificiales del final ───────────────────────────────────────
  // En canvas y no con divs animados: son unas doscientas chispas, y como
  // elementos del DOM cada cuadro obligaría al navegador a recalcular la
  // página entera.
  private fxCtx: CanvasRenderingContext2D | null = null;
  private fxChispas: Chispa[] = [];
  private fxRaf = 0;
  private fxCohetes: any[] = [];
  private fxAnterior = 0;

  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible') this.sincronizarDesdeStorage();
  };

  private indexedDB = inject(IndexedDBService);

  /** Llega cuando el canvas entra en pantalla, y otra vez (vacío) al salir. */
  @ViewChild('lienzoFx') private set lienzoFx(ref: ElementRef<HTMLCanvasElement> | undefined) {
    if (ref?.nativeElement) this.lanzarFuegos(ref.nativeElement);
    else this.detenerFuegos();
  }

  constructor(private cdr: ChangeDetectorRef, private router: Router, private zona: NgZone) {}

  async ngOnInit() {
    this.enRutaSocio = this.router.url.startsWith('/socio');
    this.routeSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.enRutaSocio = e.urlAfterRedirects.startsWith('/socio');
        this.cdr.detectChanges();
      });

    this.pedirPermisosNotificacion();

    // La cuenta de series se restaura ANTES que el temporizador: si al abrir
    // la app el descanso ya había vencido, la restauración llama a
    // alTerminar() y esa serie tiene que sumarse sobre las anteriores, no
    // sobre cero.
    this.series = Number(localStorage.getItem(KEY_SERIES)) || 0;

    // Primero intentar restaurar desde IndexedDB (más confiable)
    await this.restaurarDesdeIndexedDB();

    // Luego restaurar desde localStorage (por si IndexedDB falla)
    this.restaurarDeStorage();

    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('app-cronometro')) this.minimizado = true;
  }

  onClickInterno(event: MouseEvent) { event.stopPropagation(); }

  get progreso(): number {
    return this.tiempoTotal > 0 ? this.tiempoRestante / this.tiempoTotal : 1;
  }
  get circunferencia(): number { return 2 * Math.PI * 44; }
  get dashOffset(): number {
    // Al terminar el anillo se dibuja entero en vez de quedar vacío: ahora que
    // el panel se queda abierto, un círculo completo acompaña al "¡Listo!"
    // mejor que el aro apagado que dejaba el 0 de tiempo restante.
    if (this.terminado) return 0;
    return this.circunferencia * (1 - this.progreso);
  }
  get minutos(): string { return String(Math.floor(this.tiempoRestante / 60)).padStart(2, '0'); }
  get segundosDisplay(): string { return String(this.tiempoRestante % 60).padStart(2, '0'); }
  get casiTerminado(): boolean { return this.tiempoRestante <= 10 && this.activo && !this.terminado; }

  abrir(event: MouseEvent) { event.stopPropagation(); this.minimizado = false; }

  seleccionarPreset(segundos: number) {
    this.detener();
    this.tiempoTotal = segundos;
    this.tiempoRestante = segundos;
    this.terminado = false;
    this.detenerFuegos();
    this.ultimoPresetUsado = segundos; // Guardar para reinicio rápido
    this.limpiarStorage();
  }

  toggleTimer() {
    if (this.terminado) { this.reiniciar(); return; }
    this.activo ? this.pausar() : this.iniciar();
  }

  private iniciar() {
    this.activo = true;
    this.terminado = false;

    // Desbloquear el audio aquí (es un gesto del usuario): así el sonido
    // podrá reproducirse cuando el cronómetro termine, también en móvil.
    this.prepararAudio();

    const endTime = Date.now() + this.tiempoRestante * 1000;
    localStorage.setItem(KEY_END, String(endTime));
    localStorage.setItem(KEY_TOTAL, String(this.tiempoTotal));
    localStorage.removeItem(KEY_PAUSE);

    // Guardar también en IndexedDB para mayor seguridad
    this.indexedDB.saveTimerState({
      endTime,
      total: this.tiempoTotal
    }).catch(err => console.warn('No se pudo guardar en IndexedDB:', err));

    this.programarAviso(endTime);
    this.lanzarIntervalo();
  }

  private lanzarIntervalo() {
    clearInterval(this.intervalo);
    this.intervalo = setInterval(() => {
      const endTime = Number(localStorage.getItem(KEY_END));
      if (endTime) {
        this.tiempoRestante = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      }
      if (this.tiempoRestante <= 0) {
        this.tiempoRestante = 0;
        this.alTerminar();
      }
      this.cdr.detectChanges();
    }, 500);
  }

  private pausar() {
    this.activo = false;
    clearInterval(this.intervalo);
    this.cancelarAviso();
    localStorage.removeItem(KEY_END);
    localStorage.setItem(KEY_PAUSE, String(this.tiempoRestante));

    // Guardar estado pausado en IndexedDB
    this.indexedDB.saveTimerState({
      paused: this.tiempoRestante,
      total: this.tiempoTotal
    }).catch(err => console.warn('No se pudo guardar en IndexedDB:', err));
  }

  private detener(cancelarNotif = true) {
    this.activo = false;
    clearInterval(this.intervalo);
    if (cancelarNotif) {
      this.cancelarAviso();
    } else {
      // Fin natural del cronómetro: NO cancelar la notificación nativa,
      // justo es la que debe dispararse en este instante.
      clearTimeout(this.notifTimeout);
    }
    this.limpiarStorage();
  }

  reiniciar() {
    this.detener();
    this.tiempoRestante = this.tiempoTotal;
    this.terminado = false;
    this.detenerFuegos();
  }

  /**
   * Vuelve la cuenta de series a cero — al pasar al siguiente ejercicio.
   * Aparte del ↺ del tiempo a propósito: reiniciar el descanso en medio de un
   * ejercicio es normal y no debería borrar las series que ya hizo.
   */
  reiniciarSeries(event?: MouseEvent) {
    event?.stopPropagation();
    this.series = 0;
    localStorage.removeItem(KEY_SERIES);
    this.cdr.detectChanges();
  }

  private sincronizarDesdeStorage() {
    const endTime = Number(localStorage.getItem(KEY_END));
    if (!endTime) return;

    const restante = Math.ceil((endTime - Date.now()) / 1000);
    if (restante <= 0) {
      this.tiempoRestante = 0;
      // Timer terminó mientras estaba en segundo plano → avisar al volver
      this.alTerminar();
    } else if (this.activo) {
      this.tiempoRestante = restante;
    }
    this.cdr.detectChanges();
  }

  private restaurarDeStorage() {
    const endTime = Number(localStorage.getItem(KEY_END));
    const total   = Number(localStorage.getItem(KEY_TOTAL));
    const paused  = Number(localStorage.getItem(KEY_PAUSE));

    if (endTime && total) {
      const restante = Math.ceil((endTime - Date.now()) / 1000);
      this.tiempoTotal = total;

      if (restante <= 0) {
        this.tiempoRestante = 0;
        this.limpiarStorage();
        this.alTerminar();
      } else {
        this.tiempoRestante = restante;
        this.activo = true;
        this.terminado = false;
        this.programarAviso(endTime); // web o nativo segun plataforma
        this.lanzarIntervalo();
      }
    } else if (paused && total) {
      this.tiempoTotal    = total;
      this.tiempoRestante = paused;
    }
  }

  private limpiarStorage() {
    localStorage.removeItem(KEY_END);
    localStorage.removeItem(KEY_TOTAL);
    localStorage.removeItem(KEY_PAUSE);

    // Limpiar también de IndexedDB
    this.indexedDB.clearTimerState().catch(err => console.warn('No se pudo limpiar IndexedDB:', err));
  }

  /**
   * Restaura el estado del cronómetro desde IndexedDB
   */
  private async restaurarDesdeIndexedDB(): Promise<void> {
    try {
      const state = await this.indexedDB.getTimerState();
      if (!state) return;

      const { endTime, total, paused } = state;

      // Si hay un timer activo
      if (endTime && total) {
        const restante = Math.ceil((endTime - Date.now()) / 1000);
        this.tiempoTotal = total;

        if (restante <= 0) {
          this.tiempoRestante = 0;
          this.limpiarStorage();
          this.alTerminar();
        } else {
          this.tiempoRestante = restante;
          this.activo = true;
          this.terminado = false;

          // Sincronizar con localStorage
          localStorage.setItem(KEY_END, String(endTime));
          localStorage.setItem(KEY_TOTAL, String(total));

          this.programarAviso(endTime);
          this.lanzarIntervalo();
        }
      }
      // Si hay un timer pausado
      else if (paused && total) {
        this.tiempoTotal = total;
        this.tiempoRestante = paused;

        // Sincronizar con localStorage
        localStorage.setItem(KEY_TOTAL, String(total));
        localStorage.setItem(KEY_PAUSE, String(paused));
      }
    } catch (error) {
      console.warn('Error al restaurar desde IndexedDB:', error);
    }
  }

  async pedirPermisosNotificacion() {
    // En el APK (Capacitor) se piden los permisos nativos de notificación.
    if (this.esNativo) {
      try {
        const estado = await LocalNotifications.checkPermissions();
        if (estado.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }
      } catch {}
      return;
    }
    // En navegador, permiso de notificaciones web.
    if (!('Notification' in window)) return;
    this.permisoNotif = Notification.permission;
    if (Notification.permission === 'default') {
      this.permisoNotif = await Notification.requestPermission();
    }
  }

  /**
   * Programa el aviso de fin: notificación nativa en el APK (salta a la hora
   * exacta aunque la app esté cerrada) o setTimeout web en el navegador.
   */
  private programarAviso(endTime: number) {
    if (this.esNativo) {
      this.programarNotificacionNativa(endTime);
    } else {
      const restante = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      this.programarNotificacion(restante);
    }
  }

  /** Cancela el aviso pendiente (web y nativo). */
  private cancelarAviso() {
    clearTimeout(this.notifTimeout);
    if (this.esNativo) {
      LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] }).catch(() => {});
    }
  }

  /**
   * Agenda una notificación local nativa para la hora exacta de fin.
   * El sistema operativo la dispara aunque la app esté cerrada.
   */
  private async programarNotificacionNativa(endTime: number) {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] }).catch(() => {});
      await LocalNotifications.schedule({
        notifications: [{
          id: NOTIF_ID,
          title: '¡Tiempo de descanso terminado! 💪',
          body: '¡A darle con todo, guerrero!',
          schedule: { at: new Date(endTime), allowWhileIdle: true },
          // Silueta de la serpiente. Android ignora los colores de este icono
          // (usa solo el alfa y lo pinta con iconColor), por eso el archivo es
          // blanco sobre transparente y no el logo naranja.
          smallIcon: 'ic_stat_snake',
          iconColor: '#F97316'           // naranja de la marca
        }]
      });
    } catch (e) {
      console.warn('No se pudo programar la notificación nativa:', e);
    }
  }

  private programarNotificacion(segundos: number) {
    clearTimeout(this.notifTimeout);
    // setTimeout funciona mientras la pestaña está activa.
    // Si el browser pausa JS en segundo plano, la notificación se
    // dispara igual cuando el usuario vuelve (via visibilitychange).
    this.notifTimeout = setTimeout(() => {
      this.mostrarNotificacion();
    }, segundos * 1000);
  }

  /**
   * Crea/reanuda el AudioContext. Debe llamarse desde un gesto del usuario
   * (los navegadores móviles bloquean el audio iniciado por temporizadores).
   */
  private prepararAudio() {
    try {
      if (!this.audioCtx) {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AC) this.audioCtx = new AC();
      }
      if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
    } catch {}
  }

  /**
   * Reproduce un timbre de 3 notas ascendentes al terminar el cronómetro.
   * Usa Web Audio API (sin archivos de audio).
   */
  private reproducirSonido() {
    const ctx = this.audioCtx;
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const ahora = ctx.currentTime;
      const notas = [880, 1108.73, 1318.51]; // La5 - Do#6 - Mi6 (acorde alegre)
      notas.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ahora + i * 0.18;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      });
    } catch {}
  }

  private async mostrarNotificacion() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const titulo = '¡Tiempo de descanso terminado! 💪';
    const opciones: NotificationOptions = {
      body: '¡A darle con todo, guerrero!',
      icon: '/icons/LogoGym.png',
      tag: 'cronometro-fin',
      requireInteraction: true
    };

    // ServiceWorker showNotification es más confiable en mobile
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(titulo, opciones);
        return;
      } catch {}
    }
    new Notification(titulo, opciones);
  }

  /**
   * Tres cohetes escalonados que suben y estallan. Corre fuera de la zona de
   * Angular: si no, cada cuadro dispararía la detección de cambios de toda la
   * aplicación sesenta veces por segundo.
   */
  private lanzarFuegos(lienzo: HTMLCanvasElement): void {
    this.detenerFuegos();

    // Quien pidió menos movimiento se queda con el sonido y la vibración.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = lienzo.getContext('2d');
    if (!ctx) return;

    const ancho = lienzo.clientWidth || window.innerWidth;
    const alto = lienzo.clientHeight || window.innerHeight;
    // Tope de 2: en un celular con densidad 3 se pintarían más del doble de
    // píxeles sin que se note la diferencia.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    lienzo.width = Math.round(ancho * dpr);
    lienzo.height = Math.round(alto * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.fxCtx = ctx;

    const azar = (a: number, b: number) => a + Math.random() * (b - a);

    [0, 380, 760].forEach(retraso => {
      this.fxCohetes.push(setTimeout(() => {
        const x = ancho * azar(0.22, 0.78);
        const destinoY = alto * azar(0.16, 0.42);
        this.fxChispas.push({
          tipo: 'cohete', x, y: alto + 12,
          vx: 0, vy: -(alto + 12 - destinoY) / 0.8,
          destinoY, radio: 2.6,
          color: this.COLORES[Math.floor(Math.random() * this.COLORES.length)],
          vida: 0, maxVida: 1.2
        });
        this.fxCohetes.shift();
      }, retraso));
    });

    this.zona.runOutsideAngular(() => {
      this.fxAnterior = performance.now();
      this.fxRaf = requestAnimationFrame(t => this.pintarFuegos(t, ancho, alto));
    });
  }

  private pintarFuegos(ahora: number, ancho: number, alto: number): void {
    const ctx = this.fxCtx;
    if (!ctx) return;

    const dt = Math.min((ahora - this.fxAnterior) / 1000, 0.05);
    this.fxAnterior = ahora;
    ctx.clearRect(0, 0, ancho, alto);

    const nuevas: Chispa[] = [];
    for (const c of this.fxChispas) {
      c.vida += dt;
      const resto = 1 - c.vida / c.maxVida;

      if (c.tipo === 'cohete') {
        c.y += c.vy * dt;
        ctx.fillStyle = c.color;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radio * 3, 0, Math.PI * 2); // el resplandor
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radio, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.fillRect(c.x - 1.5, c.y, 3, 30); // la estela
        if (c.y <= (c.destinoY ?? 0)) {
          c.vida = c.maxVida + 1; // el cohete muere y deja las brasas
          for (let i = 0; i < 70; i++) {
            const ang = Math.random() * Math.PI * 2;
            const v = 60 + Math.random() * 240;
            nuevas.push({
              tipo: 'brasa', x: c.x, y: c.y,
              vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
              color: Math.random() > 0.75 ? '#fbbf24' : c.color,
              radio: 1.8 + Math.random() * 1.8,
              vida: 0, maxVida: 1 + Math.random() * 0.9
            });
          }
        }
        continue;
      }

      c.vy += 260 * dt;             // gravedad
      c.vx *= 0.985; c.vy *= 0.985; // el aire las frena
      c.x += c.vx * dt; c.y += c.vy * dt;
      // El parpadeo es lo que las hace leer como brasas y no como puntos.
      const brillo = Math.max(resto, 0) * (0.6 + 0.4 * Math.sin(c.vida * 40));
      const r = c.radio * Math.max(resto, 0.25);
      ctx.fillStyle = c.color;
      ctx.globalAlpha = brillo * 0.25;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * 3, 0, Math.PI * 2); // el resplandor alrededor
      ctx.fill();
      ctx.globalAlpha = brillo;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    this.fxChispas = this.fxChispas.filter(c => c.vida < c.maxVida).concat(nuevas);

    if (this.fxChispas.length || this.fxCohetes.length) {
      this.zona.runOutsideAngular(() => {
        this.fxRaf = requestAnimationFrame(t => this.pintarFuegos(t, ancho, alto));
      });
    } else {
      this.fxRaf = 0;
    }
  }

  private detenerFuegos(): void {
    if (this.fxRaf) cancelAnimationFrame(this.fxRaf);
    this.fxRaf = 0;
    this.fxCohetes.forEach(t => clearTimeout(t));
    this.fxCohetes = [];
    this.fxChispas = [];
    this.fxCtx = null;
  }

  private alTerminar() {
    this.detener(false); // no cancelar la notificación nativa que debe sonar ahora
    this.terminado = true;

    // Único punto por el que pasa un descanso completado, venga del intervalo
    // en pantalla, de volver a la app con el temporizador ya vencido
    // (sincronizarDesdeStorage) o de reabrirla directamente
    // (restaurarDeStorage / restaurarDesdeIndexedDB). Contar acá es lo que
    // evita que la cuenta se desincronice si el celular quedó bloqueado a
    // mitad del descanso. No hay riesgo de contar dos veces: detener() borra
    // el estado guardado, así que las otras vías ya no encuentran nada.
    this.series++;
    localStorage.setItem(KEY_SERIES, String(this.series));

    // Los fuegos artificiales arrancan solos: el canvas aparece junto con
    // `terminado` y su setter los lanza.

    // Sonido + vibración fuerte + notificación
    this.reproducirSonido();
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
    // En el APK la notificación nativa ya está programada y salta sola
    // (también con la app cerrada); en web la mostramos aquí.
    if (!this.esNativo) this.mostrarNotificacion();

    // Comportamiento diferente según si está en ruta de socio
    if (this.enRutaSocio) {
      // En rutina: reinicio automático al mismo preset, listo para la serie
      // siguiente. NO se toca `minimizado`: si el socio lo tenía abierto se
      // queda abierto (antes se minimizaba solo y había que reabrirlo entre
      // serie y serie); si lo tenía minimizado, sigue minimizado.
      setTimeout(() => {
        if (this.terminado) {
          this.tiempoTotal = this.ultimoPresetUsado;
          this.tiempoRestante = this.ultimoPresetUsado;
          this.terminado = false;
          this.cdr.detectChanges();
        }
      }, 5000); // 5 segundos para ver el "¡Listo!" antes de rearmarse
    } else {
      // Fuera de rutina: comportamiento normal
      setTimeout(() => {
        if (this.terminado) {
          this.reiniciar();
          this.cdr.detectChanges();
        }
      }, 3000);
    }
  }

  ngOnDestroy() {
    this.detenerFuegos();
    clearInterval(this.intervalo);
    clearTimeout(this.notifTimeout);
    this.routeSub?.unsubscribe();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.audioCtx?.close().catch(() => {});
  }
}
