import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../../services/auth';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';

@Component({
  selector: 'app-detalle-rutina',
  imports: [CommonModule],
  templateUrl: './detalle-rutina.html',
  styleUrl: './detalle-rutina.css',
})
export class DetalleRutina implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private destroy$ = new Subject<void>();

  usuarioId = '';
  rutinas: any[] = [];

  ngOnInit() {
    this.usuarioId = this.route.snapshot.paramMap.get('id') || '';
    this.cargarRutinas();
  }

  cargarRutinas() {
    this.authService.obtenerRutina(this.usuarioId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.rutinas = res;
          this.cdr.detectChanges();
        },
        error: () => this.toast.error('Error al cargar las rutinas del socio')
      });
  }

  editarRutina(rutina: any) {
    this.router.navigate(['/admin/rutinas', this.usuarioId], {
      queryParams: { rutinaId: rutina._id }
    });
  }

  async borrarRutina(idRutina: string) {
    const ok = await this.confirm.confirm('¿Estás seguro de eliminar esta rutina?');
    if (!ok) return;

    this.authService.eliminarRutina(idRutina)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Rutina eliminada correctamente');
          this.cargarRutinas();
        },
        error: () => this.toast.error('No se pudo eliminar la rutina.')
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
