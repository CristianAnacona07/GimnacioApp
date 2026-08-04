import { Component, OnDestroy, OnInit, HostListener, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { IndexedDBService } from '../../../services/indexed-db.service';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

interface ConfettiPieza {
  id: number;
  left: number;
  delay: number;
  color: string;
  size: number;
  duration: number;
  isCircle: boolean;
}

const KEY_END  = 'crono_endTime';
const KEY_TOTAL = 'crono_total';
const KEY_PAUSE = 'crono_paused';
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
  ];

  tiempoTotal = 60;
  tiempoRestante = 60;
  activo = false;
  terminado = false;
  minimizado = true;
  confettiPiezas: ConfettiPieza[] = [];
  enRutaSocio = false;
  permisoNotif: NotificationPermission = 'default';
  ultimoPresetUsado = 60; // Guardar último preset para reinicio rápido

  private intervalo: any = null;
  private routeSub: any = null;
  private notifTimeout: any = null;
  private audioCtx: AudioContext | null = null;
  private readonly esNativo = Capacitor.isNativePlatform();
  private readonly COLORES = ['#cc0000','#22c55e','#3b82f6','#f97316','#a855f7','#eab308','#ec4899'];

  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible') this.sincronizarDesdeStorage();
  };

  private indexedDB = inject(IndexedDBService);

  constructor(private cdr: ChangeDetectorRef, private router: Router) {}

  async ngOnInit() {
    this.enRutaSocio = this.router.url.startsWith('/socio');
    this.routeSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.enRutaSocio = e.urlAfterRedirects.startsWith('/socio');
        this.cdr.detectChanges();
      });

    this.pedirPermisosNotificacion();

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
  get dashOffset(): number { return this.circunferencia * (1 - this.progreso); }
  get minutos(): string { return String(Math.floor(this.tiempoRestante / 60)).padStart(2, '0'); }
  get segundosDisplay(): string { return String(this.tiempoRestante % 60).padStart(2, '0'); }
  get casiTerminado(): boolean { return this.tiempoRestante <= 10 && this.activo && !this.terminado; }

  abrir(event: MouseEvent) { event.stopPropagation(); this.minimizado = false; }

  seleccionarPreset(segundos: number) {
    this.detener();
    this.tiempoTotal = segundos;
    this.tiempoRestante = segundos;
    this.terminado = false;
    this.confettiPiezas = [];
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
    this.confettiPiezas = [];
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
          smallIcon: 'ic_stat_kodiak',   // silueta del oso en la barra de estado
          iconColor: '#D4AF37'           // tinte dorado
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
      icon: '/icons/LogoGym.jpg',
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

  private generarConfetti() {
    this.confettiPiezas = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: 5 + Math.random() * 90,
      delay: Math.random() * 0.8,
      color: this.COLORES[Math.floor(Math.random() * this.COLORES.length)],
      size: 6 + Math.random() * 10,
      duration: 2.0 + Math.random() * 1.8,
      isCircle: Math.random() > 0.5
    }));
  }

  private alTerminar() {
    this.detener(false); // no cancelar la notificación nativa que debe sonar ahora
    this.terminado = true;

    // Confetti siempre (animación breve en el fondo)
    this.generarConfetti();

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
      // En rutina: reinicio automático al mismo preset
      setTimeout(() => {
        if (this.terminado) {
          this.tiempoTotal = this.ultimoPresetUsado;
          this.tiempoRestante = this.ultimoPresetUsado;
          this.terminado = false;
          this.confettiPiezas = [];
          this.minimizado = true; // Mantener minimizado
          this.cdr.detectChanges();
        }
      }, 3000); // 3 segundos para leer "¡Listo! Toca para repetir"
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
    clearInterval(this.intervalo);
    clearTimeout(this.notifTimeout);
    this.routeSub?.unsubscribe();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.audioCtx?.close().catch(() => {});
  }
}
