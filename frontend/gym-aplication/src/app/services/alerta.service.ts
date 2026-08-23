import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Avisa al usuario de algo que acaba de pasar: sonido, vibración y — en el
 * móvil — una notificación del sistema.
 *
 * El timbre es el mismo acorde de tres notas del cronómetro, generado con Web
 * Audio en vez de un archivo de sonido: así no hay descarga que esperar ni
 * asset que se quede fuera del APK, y suena idéntico en web y en Android.
 *
 * Un detalle que parece un bug y no lo es: los navegadores móviles bloquean
 * cualquier audio que no nazca de un gesto del usuario. Por eso el
 * `AudioContext` se crea en el primer toque de pantalla (`despertarAudio`) y se
 * queda listo; si nunca hubo un toque, `sonar()` no hace nada en lugar de
 * fallar.
 */

/** Rango propio de ids para no pisar la notificación del cronómetro. */
const NOTIF_ID_BASE = 8100;

@Injectable({ providedIn: 'root' })
export class AlertaService {
  private readonly esNativo = Capacitor.isNativePlatform();
  private audioCtx: AudioContext | null = null;
  private permisosPedidos = false;
  private siguienteId = NOTIF_ID_BASE;

  constructor() {
    this.engancharPrimerGesto();
  }

  /**
   * Avisa de un evento nuevo. En el móvil sale una notificación del sistema
   * (que trae su propio sonido y aparece aunque la app esté en segundo plano);
   * en el navegador se emite el timbre y se vibra.
   */
  async avisar(titulo: string, cuerpo: string): Promise<void> {
    this.vibrar();

    if (this.esNativo) {
      await this.notificacionNativa(titulo, cuerpo);
      return;
    }

    this.sonar();
    this.notificacionWeb(titulo, cuerpo);
  }

  /** Pide permiso de notificaciones. Se llama una sola vez por sesión. */
  async pedirPermisos(): Promise<void> {
    if (this.permisosPedidos) return;
    this.permisosPedidos = true;

    if (this.esNativo) {
      try {
        const estado = await LocalNotifications.checkPermissions();
        if (estado.display !== 'granted') await LocalNotifications.requestPermissions();
      } catch {}
      return;
    }

    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
  }

  /**
   * Timbre de tres notas ascendentes (La5 · Do#6 · Mi6), el mismo del
   * cronómetro. Silencioso si el audio nunca llegó a desbloquearse.
   */
  sonar(): void {
    const ctx = this.audioCtx;
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const ahora = ctx.currentTime;
      [880, 1108.73, 1318.51].forEach((freq, i) => {
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

  private vibrar(): void {
    try {
      if ('vibrate' in navigator) navigator.vibrate([120, 60, 120]);
    } catch {}
  }

  private async notificacionNativa(titulo: string, cuerpo: string): Promise<void> {
    try {
      // Ids rotativos dentro de un rango corto: así dos avisos seguidos no se
      // pisan, pero tampoco se acumulan cien notificaciones en la bandeja.
      this.siguienteId = NOTIF_ID_BASE + ((this.siguienteId - NOTIF_ID_BASE + 1) % 20);
      await LocalNotifications.schedule({
        notifications: [{
          id: this.siguienteId,
          title: titulo,
          body: cuerpo,
          smallIcon: 'ic_stat_kodiak',
          iconColor: '#D4AF37'
        }]
      });
    } catch {
      // Si el usuario negó el permiso queda al menos la vibración.
    }
  }

  private notificacionWeb(titulo: string, cuerpo: string): void {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      new Notification(titulo, {
        body: cuerpo,
        icon: '/icons/LogoGym.png',
        tag: 'aviso-gym'
      });
    } catch {}
  }

  /**
   * Deja el audio listo en el primer toque/tecla del usuario. Se desengancha
   * solo, así que no queda ningún listener vivo después.
   */
  private engancharPrimerGesto(): void {
    const desbloquear = () => {
      try {
        if (!this.audioCtx) {
          const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AC) this.audioCtx = new AC();
        }
        if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
      } catch {}
    };
    const opciones = { once: true, passive: true } as AddEventListenerOptions;
    document.addEventListener('pointerdown', desbloquear, opciones);
    document.addEventListener('keydown', desbloquear, opciones);
  }
}
