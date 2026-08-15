import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { DatosLanding, LandingService } from '../../services/landing.service';
import { GymService, normalizarLanding } from '../../services/gym.service';
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
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
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
    if (!slug) { this.router.navigate(['/gimnasios']); return; }

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
  get color(): string { return this.gym?.colores?.navbar || '#0f172a'; }
  get acento(): string { return this.gym?.colores?.primario || '#f97316'; }

  /** Texto del usuario, o el de reserva si lo dejó vacío. */
  texto(valor: string | undefined, reserva: string): string {
    return (valor || '').trim() || reserva;
  }

  get haySecciones(): boolean {
    return !!(this.l?.sobreNosotros?.activo || this.l?.galeria?.activo ||
      this.l?.horarios?.activo || this.hayPlanes || this.hayNoticias || this.l?.contacto?.activo);
  }

  get hayPlanes(): boolean { return !!this.l?.planes?.activo && !!this.datos?.planes?.length; }
  get hayNoticias(): boolean { return !!this.l?.noticias?.activo && !!this.datos?.noticias?.length; }
  get hayGaleria(): boolean { return !!this.l?.galeria?.activo && !!this.l?.galeria?.fotos?.length; }
  get hayHorarios(): boolean { return !!this.l?.horarios?.activo && !!this.l?.horarios?.filas?.length; }

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
