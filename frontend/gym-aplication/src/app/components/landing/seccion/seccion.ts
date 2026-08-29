import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { DatosLanding, LandingService } from '../../../services/landing.service';
import { GymService, SeccionLanding, normalizarLanding } from '../../../services/gym.service';
import { ThemeService, mezclar, textoSobre } from '../../../services/theme.service';

/**
 * Todas las tarjetas de una sección, la pantalla a la que lleva "Ver más".
 *
 * La página pública solo muestra las primeras seis de cada sección para no
 * volverse interminable; acá está el listado completo. Reusa el mismo endpoint
 * público que la landing, así que tampoco necesita sesión.
 */
@Component({
  selector: 'app-landing-seccion',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './seccion.html',
  styleUrl: '../landing.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingSeccion implements OnInit {
  private ruta = inject(ActivatedRoute);
  private router = inject(Router);
  private landingService = inject(LandingService);
  private gymService = inject(GymService);
  private theme = inject(ThemeService);
  private cdr = inject(ChangeDetectorRef);

  datos: DatosLanding | null = null;
  seccion: SeccionLanding | null = null;
  cargando = true;

  ngOnInit(): void {
    const slug = this.ruta.snapshot.paramMap.get('slug');
    const id = this.ruta.snapshot.paramMap.get('id');
    if (!slug || !id) { this.router.navigate(['/login']); return; }

    this.landingService.obtener(slug).subscribe({
      next: (datos) => {
        const landing = normalizarLanding(datos.gym.landing);
        this.datos = { ...datos, gym: { ...datos.gym, landing } };
        this.seccion = landing.secciones.find((s) => s.id === id) || null;
        this.cargando = false;
        this.theme.aplicar(datos.gym);
        // Sección borrada o enlace viejo: mejor la página que un vacío.
        if (!this.seccion) this.router.navigate(['/g', slug]);
        this.cdr.markForCheck();
      },
      error: () => {
        this.cargando = false;
        this.router.navigate(['/login']);
      }
    });
  }

  get gym() { return this.datos?.gym ?? null; }
  get acento(): string { return this.gym?.colores?.primario || '#f97316'; }
  get textoAcento(): string { return textoSobre(this.acento); }
  get degradadoMarca(): string {
    const uno = this.gym?.colores?.primario || '#f97316';
    const dos = this.gym?.colores?.secundario || '#1d4ed8';
    return `linear-gradient(135deg, ${uno} 0%, ${dos} 100%)`;
  }
  get textoPortada(): string {
    return textoSobre(mezclar(this.gym?.colores?.primario || '#f97316', this.gym?.colores?.secundario || '#1d4ed8'));
  }
}
