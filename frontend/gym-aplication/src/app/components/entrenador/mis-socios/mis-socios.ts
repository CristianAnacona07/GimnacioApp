import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { EntrenadorService, Socio } from '../../../services/entrenador.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-entrenador-mis-socios',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mis-socios.html',
  styleUrl: './mis-socios.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisSocios implements OnInit {
  private entrenadorService = inject(EntrenadorService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  socios: Socio[] = [];
  cargando = true;
  error = false;

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargando = true;
    this.error = false;
    this.cdr.markForCheck();

    this.entrenadorService.misSocios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (socios) => {
          this.socios = Array.isArray(socios) ? socios : [];
          this.cargando = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.cargando = false;
          this.error = true;
          this.toast.error('No se pudieron cargar tus socios asignados.');
          this.cdr.markForCheck();
        }
      });
  }

  avatar(socio: Socio): string {
    if (socio.fotoUrl?.trim()) return socio.fotoUrl;
    const nombre = encodeURIComponent(socio.nombre || 'Socio');
    return `https://ui-avatars.com/api/?name=${nombre}&background=random`;
  }

  onErrorFoto(event: Event, socio: Socio) {
    const nombre = encodeURIComponent(socio.nombre || 'Socio');
    (event.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${nombre}&background=random`;
  }
}
