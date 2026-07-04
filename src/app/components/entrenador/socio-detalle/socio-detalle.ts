import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { EntrenadorService, SocioDetalle as SocioDetalleModel } from '../../../services/entrenador.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-entrenador-socio-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './socio-detalle.html',
  styleUrl: './socio-detalle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocioDetalle implements OnInit {
  private route = inject(ActivatedRoute);
  private entrenadorService = inject(EntrenadorService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  socio: SocioDetalleModel | null = null;
  cargando = true;
  error = false;
  private socioId = '';

  ngOnInit() {
    this.socioId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.socioId) {
      this.cargando = false;
      this.error = true;
      return;
    }
    this.cargar();
  }

  cargar() {
    this.cargando = true;
    this.error = false;
    this.cdr.markForCheck();

    this.entrenadorService.socioDetalle(this.socioId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle: SocioDetalleModel) => {
          const rutinas = Array.isArray(detalle?.rutinas) ? detalle.rutinas : [];
          this.socio = { ...(detalle as SocioDetalleModel), rutinas };
          this.cargando = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.cargando = false;
          this.error = true;
          this.toast.error('No se pudo cargar el perfil del socio.');
          this.cdr.markForCheck();
        }
      });
  }

  avatar(): string {
    if (this.socio?.fotoUrl?.trim()) return this.socio.fotoUrl;
    const nombre = encodeURIComponent(this.socio?.nombre || 'Socio');
    return `https://ui-avatars.com/api/?name=${nombre}&background=random`;
  }

  onErrorFoto(event: Event) {
    const nombre = encodeURIComponent(this.socio?.nombre || 'Socio');
    (event.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${nombre}&background=random`;
  }
}
