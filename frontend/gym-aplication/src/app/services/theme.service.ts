import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GymService, Gym } from './gym.service';

export type Modo = 'claro' | 'oscuro';

/** Clave preservada al cerrar sesión: el modo es del dispositivo, no de la cuenta. */
const CLAVE_MODO = 'theme';

/** Fondo general en modo oscuro (el mismo que declara styles.css). */
const FONDO_OSCURO = '#0b1119';

const DEFAULTS = {
  primario:   '#f97316',
  secundario: '#1d4ed8',
  fondo:      '#eef3ff',
  navbar:     '#0f172a',
  menu:       '#1e293b',
  dias:       '#1d4ed8'
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private modoSubject = new BehaviorSubject<Modo>(this.modoGuardado());

  /** Modo claro/oscuro vigente; cambia cuando el usuario lo alterna. */
  readonly modo$: Observable<Modo> = this.modoSubject.asObservable();

  constructor(private gymService: GymService) {
    this.aplicarModo(this.modoSubject.value);
  }

  get modo(): Modo { return this.modoSubject.value; }

  /**
   * Modo elegido antes, o el del sistema operativo la primera vez: alguien que
   * tiene el teléfono en oscuro espera encontrarse la página en oscuro.
   */
  private modoGuardado(): Modo {
    const guardado = localStorage.getItem(CLAVE_MODO);
    if (guardado === 'claro' || guardado === 'oscuro') return guardado;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  }

  /**
   * El modo viaja como atributo del <html>, así el CSS lo lee sin JavaScript.
   *
   * A propósito NO se toca `color-scheme`: eso hace que el navegador dibuje los
   * campos de formulario (y el resaltado de autocompletado) en oscuro por toda
   * la app, que todavía es clara. Se activará cuando el resto de las pantallas
   * también tengan modo oscuro.
   */
  private aplicarModo(modo: Modo): void {
    document.documentElement.setAttribute('data-tema', modo);
  }

  cambiarModo(modo: Modo): void {
    localStorage.setItem(CLAVE_MODO, modo);
    this.aplicarModo(modo);
    this.modoSubject.next(modo);
    // Los colores del gimnasio se escriben como estilo en línea y ganan a
    // cualquier hoja de estilos, así que hay que recalcularlos con el modo nuevo.
    this.aplicar();
  }

  alternarModo(): void {
    this.cambiarModo(this.modo === 'oscuro' ? 'claro' : 'oscuro');
  }

  aplicar(gym?: Gym | null) {
    const colores = gym?.colores || this.gymService.getGym()?.colores || DEFAULTS;
    const root = document.documentElement;

    // Esquema simplificado: el color PRINCIPAL (navbar) rige también los botones
    // (primario), el menú lateral y los días de rutina — así toda la app se ve
    // coherente con un solo color, sin depender de valores viejos guardados.
    const principal = colores.navbar || DEFAULTS.navbar;

    root.style.setProperty('--color-navbar',     principal);
    root.style.setProperty('--color-primario',   principal);
    root.style.setProperty('--color-menu',       principal);
    root.style.setProperty('--color-dias',       principal);
    root.style.setProperty('--color-secundario', colores.secundario || DEFAULTS.secundario);

    // El fondo general es lo único de la paleta del gimnasio que sí depende del
    // modo: su color claro dejaría la app a medio apagar en modo oscuro.
    root.style.setProperty(
      '--color-fondo',
      this.modo === 'oscuro' ? FONDO_OSCURO : (colores.fondo || DEFAULTS.fondo)
    );
  }

  resetear() {
    const root = document.documentElement;
    root.style.setProperty('--color-primario',   DEFAULTS.primario);
    root.style.setProperty('--color-secundario', DEFAULTS.secundario);
    root.style.setProperty('--color-fondo',      DEFAULTS.fondo);
    root.style.setProperty('--color-navbar',     DEFAULTS.navbar);
    root.style.setProperty('--color-menu',       DEFAULTS.menu);
    root.style.setProperty('--color-dias',       DEFAULTS.dias);
  }
}
