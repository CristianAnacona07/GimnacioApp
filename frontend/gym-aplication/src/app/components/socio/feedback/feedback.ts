import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FeedbackService } from '../../../services/feedback.service';
import { GymService } from '../../../services/gym.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback.html',
  styleUrl: './feedback.css'
})
export class FeedbackComponent {
  mensaje = '';
  enviando = false;
  enviado = false;
  readonly MAX = 1000;

  constructor(
    private feedbackService: FeedbackService,
    private gymService: GymService,
    private toast: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  get restantes(): number { return this.MAX - this.mensaje.length; }

  enviar() {
    if (!this.mensaje.trim() || this.enviando) return;
    this.enviando = true;
    const gymNombre = this.gymService.getGym()?.nombre;
    this.feedbackService.enviar(this.mensaje.trim(), gymNombre).subscribe({
      next: () => {
        this.enviando = false;
        this.enviado  = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.enviando = false;
        this.toast.error('Error al enviar. Intentá de nuevo.');
        this.cdr.detectChanges();
      }
    });
  }

  volver() { this.router.navigate(['/socio/noticias']); }
}
