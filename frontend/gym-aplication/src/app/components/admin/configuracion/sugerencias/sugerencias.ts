import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FeedbackService, Feedback } from '../../../../services/feedback.service';
import { ToastService } from '../../../../services/toast.service';

/**
 * Lo que los socios escribieron SOBRE ESTE GIMNASIO.
 *
 * Lo que escribieron sobre la aplicación no llega acá: lo lee el superadmin.
 * La separación la hace el backend a partir del rol del token, así que esta
 * pantalla pide la lista sin filtro y recibe solo la que le corresponde —
 * tampoco hay forma de pedir la de otro gimnasio cambiando la URL.
 */
@Component({
  selector: 'app-configuracion-sugerencias',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sugerencias.html',
  styleUrl: '../configuracion.css'
})
export class ConfiguracionSugerencias implements OnInit {
  private feedbackService = inject(FeedbackService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  mensajes: Feedback[] = [];
  cargando = false;

  get sinLeer(): number {
    return this.mensajes.filter(m => !m.leido).length;
  }

  ngOnInit(): void {
    this.cargando = true;
    this.feedbackService.getAll().subscribe({
      next: (data) => {
        this.mensajes = data || [];
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.toast.error('No se pudieron cargar las sugerencias');
        this.cdr.detectChanges();
      }
    });
  }

  marcarLeido(m: Feedback): void {
    if (m.leido || !m._id) return;
    this.feedbackService.marcarLeido(m._id).subscribe({
      next: () => { m.leido = true; this.cdr.detectChanges(); },
      error: () => this.toast.error('No se pudo marcar como leído')
    });
  }
}
