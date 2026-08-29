import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GymService, Gym } from './gym.service';

export type Modo = 'claro' | 'oscuro';

/** Clave preservada al cerrar sesión: el modo es del dispositivo, no de la cuenta. */
const CLAVE_MODO = 'theme';

/** Fondos generales: fijos por modo, ya no los elige el gimnasio. */
const FONDO_OSCURO = '#0b1119';
const FONDO_CLARO = '#eef3ff';

const DEFAULTS = {
  primario:   '#f97316',
  secundario: '#1d4ed8',
  fondo:      '#eef3ff',
  navbar:     '#0f172a',
  menu:       '#1e293b',
  dias:       '#1d4ed8'
};

/**
 * Los dos colores de marca pintan los botones, y encima de un boton va texto.
 * El gimnasio elige libre (amarillo, lima, celeste), asi que el contraste NO
 * puede quedar en manos de esa eleccion: se calcula.
 *
 * Todo esto es aritmetica pura sobre el hex, sin dependencias.
 */

function aRgb(hex: string): [number, number, number] {
  const h = (hex || '').replace('#', '').trim();
  const largo = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(largo.slice(0, 6) || '000000', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function aHex([r, g, b]: [number, number, number]): string {
  const dos = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + dos(r) + dos(g) + dos(b);
}

/** Luminancia relativa segun WCAG: lo que decide si algo se lee o no. */
function luminancia(hex: string): number {
  const [r, g, b] = aRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Punto medio de los dos colores: lo que "se siente" debajo del texto. */
export function mezclar(a: string, b: string): string {
  const [ra, ga, ba] = aRgb(a);
  const [rb, gb, bb] = aRgb(b);
  return aHex([(ra + rb) / 2, (ga + gb) / 2, (ba + bb) / 2]);
}

/** Negro o blanco, el que mejor se lea sobre ese fondo. */
export function textoSobre(fondo: string): string {
  return contraste(fondo, '#0f172a') >= contraste(fondo, '#ffffff') ? '#0f172a' : '#ffffff';
}

/**
 * El mismo color, movido hasta que se lea sobre el fondo de la pagina.
 *
 * Hace falta porque el color de marca tambien pinta titulos, enlaces y bordes
 * (--color-secundario, ~59 sitios): un amarillo crudo ahi borra media app. En
 * claro se oscurece, en oscuro se aclara, y si ya contrasta no se toca.
 */
export function colorLegible(hex: string, fondo: string, minimo = 4.5): string {
  let actual = hex;
  const haciaNegro = luminancia(fondo) > 0.4;
  for (let i = 0; i < 24 && contraste(actual, fondo) < minimo; i++) {
    const rgb = aRgb(actual);
    actual = aHex(rgb.map((v) => (haciaNegro ? v * 0.9 : v + (255 - v) * 0.12)) as [number, number, number]);
  }
  return actual;
}

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
    const oscuro = this.modo === 'oscuro';
    const fondo = oscuro ? FONDO_OSCURO : FONDO_CLARO;

    // Los dos colores de marca del gimnasio. Pintan los botones de accion
    // principal, degradado del uno al otro. La barra, el menu y el fondo NO
    // dependen de ellos: son fijos por modo, para que el contraste este
    // garantizado pase lo que pase (ver los tokens --barra-* en styles.css).
    const uno = colores.primario || DEFAULTS.primario;
    const dos = colores.secundario || DEFAULTS.secundario;

    root.style.setProperty('--btn-degradado', 'linear-gradient(135deg, ' + uno + ' 0%, ' + dos + ' 100%)');
    // El texto del boton se calcula sobre la mezcla de ambos: un boton amarillo
    // lleva letra negra y uno azul oscuro la lleva blanca, sin que nadie elija.
    root.style.setProperty('--btn-texto', textoSobre(mezclar(uno, dos)));

    root.style.setProperty('--color-primario', uno);
    root.style.setProperty('--color-dias', uno);
    // Version corregida para texto: el mismo color de marca, oscurecido (o
    // aclarado en modo oscuro) lo justo para leerse sobre el fondo.
    root.style.setProperty('--color-secundario', colorLegible(dos, fondo));

    root.style.setProperty('--color-fondo', fondo);
  }

  resetear() {
    const root = document.documentElement;
    root.style.setProperty('--color-primario',   DEFAULTS.primario);
    root.style.setProperty('--color-secundario', DEFAULTS.secundario);
    root.style.setProperty('--color-dias',       DEFAULTS.dias);
    root.style.setProperty('--color-fondo',      this.modo === 'oscuro' ? FONDO_OSCURO : FONDO_CLARO);
    root.style.setProperty('--btn-degradado',
      'linear-gradient(135deg, ' + DEFAULTS.primario + ' 0%, ' + DEFAULTS.secundario + ' 100%)');
    root.style.setProperty('--btn-texto', '#ffffff');
  }
}
