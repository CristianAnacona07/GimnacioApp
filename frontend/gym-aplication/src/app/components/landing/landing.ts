import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { DatosLanding, LandingService } from '../../services/landing.service';
import { GymService, normalizarLanding } from '../../services/gym.service';
import { mezclar, textoSobre } from '../../services/theme.service';
import { TenantService } from '../../services/tenant.service';
import { ThemeService } from '../../services/theme.service';

/**
 * Página pública de un gimnasio: lo que ve alguien que todavía no tiene cuenta.
 *
 * Llega por dos caminos que muestran lo mismo:
 *   kodiak.midominio.com   → el subdominio fija el gimnasio
 *   midominio.com/g/kodiak → el slug va en la ruta
 *
 * Al cargar guarda el gimnasio como el activo, de modo que "Iniciar sesión"
 * entre directo a su login sin pasar por el selector.
 */
/** Cuántas tarjetas de cada sección se ven en la página antes del "Ver más". */
const TARJETAS_EN_PORTADA = 6;

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Landing implements OnInit {
  private ruta = inject(ActivatedRoute);
  private router = inject(Router);
  private landingService = inject(LandingService);
  private gymService = inject(GymService);
  private tenant = inject(TenantService);
  private theme = inject(ThemeService);
  private cdr = inject(ChangeDetectorRef);

  datos: DatosLanding | null = null;
  cargando = true;
  menuAbierto = false;
  /** El encabezado se vuelve sólido al bajar; sobre la portada va transparente. */
  desplazado = false;

  ngOnInit(): void {
    const slug = this.ruta.snapshot.paramMap.get('slug') || this.tenant.slug;
    if (!slug) { this.router.navigate(['/login']); return; }

    this.landingService.obtener(slug).subscribe({
      next: (datos) => {
        // Se completa con los valores por defecto: una página guardada a medias
        // no debe romper la vista de nadie.
        this.datos = { ...datos, gym: { ...datos.gym, landing: normalizarLanding(datos.gym.landing) } };
        this.cargando = false;
        // El gimnasio queda seleccionado: el botón de iniciar sesión ya sabe
        // a cuál entrar, y la app se pinta con sus colores.
        this.gymService.guardarGym(datos.gym);
        this.theme.aplicar(datos.gym);
        this.cdr.markForCheck();
      },
      error: () => {
        this.cargando = false;
        // Sin página publicada no hay nada que enseñar: al login de siempre.
        this.router.navigate(['/login']);
      }
    });
  }

  @HostListener('window:scroll')
  alDesplazar(): void {
    const ahora = window.scrollY > 40;
    if (ahora !== this.desplazado) {
      this.desplazado = ahora;
      this.cdr.markForCheck();
    }
  }

  // ── Atajos de lectura para la plantilla ───────────────────────────────────
  get gym() { return this.datos?.gym ?? null; }
  get l() { return this.datos?.gym?.landing ?? null; }
  get acento(): string { return this.gym?.colores?.primario || '#f97316'; }

  /** Letra legible sobre el acento: un acento amarillo pedia texto negro. */
  get textoAcento(): string { return textoSobre(this.acento); }

  /**
   * La portada sin foto se pinta con los dos colores de marca, los mismos que
   * los botones de la app. Antes usaba `colores.navbar`, un campo que ya nadie
   * edita, y encima escribia el texto en blanco fijo: un gimnasio con color
   * claro (amarillo, lima) se quedaba con un titulo ilegible sobre su propio
   * fondo. Ahora el color de la letra se calcula por contraste.
   *
   * Con foto no aplica: ahi manda el velo oscuro que pone el CSS, y el texto
   * va blanco como en cualquier portada con imagen.
   */
  get degradadoMarca(): string {
    const uno = this.gym?.colores?.primario || '#f97316';
    const dos = this.gym?.colores?.secundario || '#1d4ed8';
    return `linear-gradient(135deg, ${uno} 0%, ${dos} 100%)`;
  }

  get textoPortada(): string {
    const uno = this.gym?.colores?.primario || '#f97316';
    const dos = this.gym?.colores?.secundario || '#1d4ed8';
    return textoSobre(mezclar(uno, dos));
  }

  /** Texto del usuario, o el de reserva si lo dejó vacío. */
  texto(valor: string | undefined, reserva: string): string {
    return (valor || '').trim() || reserva;
  }

  /** Sobre nosotros, horarios y contacto son fijos: siempre hay algo debajo. */
  readonly haySecciones = true;

  get hayPlanes(): boolean { return !!this.l?.planes?.activo && !!this.datos?.planes?.length; }
  get hayNoticias(): boolean { return !!this.l?.noticias?.activo && !!this.datos?.noticias?.length; }
  /** Las secciones que el gimnasio creó y tienen algo que mostrar. */
  get secciones() {
    return (this.l?.secciones || []).filter((s) => s.nombre?.trim() && s.tarjetas?.length);
  }

  /** Solo las primeras 6: el resto se ve en la pantalla propia de la sección. */
  tarjetasVisibles(seccion: { tarjetas: any[] }) {
    return seccion.tarjetas.slice(0, TARJETAS_EN_PORTADA);
  }

  hayMas(seccion: { tarjetas: any[] }): boolean {
    return seccion.tarjetas.length > TARJETAS_EN_PORTADA;
  }
  get hayHorarios(): boolean { return !!this.l?.horarios?.filas?.length; }

  get whatsappUrl(): string {
    const numero = (this.l?.contacto?.whatsapp || '').replace(/[^0-9]/g, '');
    if (!numero) return '';
    const mensaje = encodeURIComponent(`Hola, quiero información para inscribirme en ${this.gym?.nombre || 'el gimnasio'}.`);
    return `https://wa.me/${numero}?text=${mensaje}`;
  }

  // ── Modo claro / oscuro ───────────────────────────────────────────────────
  get esOscuro(): boolean { return this.theme.modo === 'oscuro'; }

  alternarTema(): void {
    this.theme.alternarModo();
    this.cdr.markForCheck();
  }

  // ── Navegación ────────────────────────────────────────────────────────────
  irA(id: string): void {
    this.menuAbierto = false;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  entrar(): void {
    this.router.navigate(['/login']);
  }
}
