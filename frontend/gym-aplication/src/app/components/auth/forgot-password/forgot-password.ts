import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../services/toast.service';
import { GymService, Gym } from '../../../services/gym.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPassword {
  email = '';
  cargando = false;
  enviado = false;
  /** Gimnasio en uso: la cabecera muestra su logo, no el de la plataforma. */
  gym: Gym | null = null;

  constructor(
    private http: HttpClient,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    private gymService: GymService
  ) {
    this.gym = this.gymService.getGym();
  }

  enviar() {
    if (!this.email || this.cargando) return;
    this.cargando = true;

    this.http.post(`${environment.apiUrl}/api/auth/forgot-password`, { email: this.email }).subscribe({
      next: () => {
        this.cargando = false;
        this.enviado = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargando = false;
        this.toast.error(err.error?.mensaje || 'Error al enviar el correo');
        this.cdr.detectChanges();
      }
    });
  }
}
