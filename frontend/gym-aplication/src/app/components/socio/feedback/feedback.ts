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

  /**
   * A quien va el mensaje. Arranca sin elegir a proposito: si viniera con uno
   * puesto, el socio mandaria al gimnasio una queja de la app (o al reves) sin
   * darse cuenta, y el que la tiene que leer nunca se entera.
   */
  destino: 'gimnasio' | 'plataforma' | null = null;

  /** El nombre no se le muestra a quien lo lee. Ver paraLeer() en el backend. */
  anonimo = false;

  /** Cada destino pide cosas distintas, asi que el texto cambia con la eleccion. */
  get titulo(): string {
    if (this.destino === 'gimnasio')   return '¿Qué mejorarías del gimnasio?';
    if (this.destino === 'plataforma') return '¿Qué mejorarías de la app?';
    return '¿Qué podemos mejorar?';
  }

  get subtitulo(): string {
    if (this.destino === 'gimnasio') {
      return 'Lo lee el administrador de tu gimnasio: las clases, los horarios, las máquinas, la atención.';
    }
    if (this.destino === 'plataforma') {
      return 'Lo leemos los que hacemos la app: algo que no funciona, que cuesta usar o que te gustaría que tuviera.';
    }
    return 'Elegí primero de qué se trata, así llega a quien puede resolverlo.';
  }

  get marcador(): string {
    return this.destino === 'gimnasio'
      ? 'Contale a tu gimnasio qué mejorarías...'
      : 'Contanos qué mejorarías de la app...';
  }

  constructor(
    private feedbackService: FeedbackService,
    private gymService: GymService,
    private toast: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  get restantes(): number { return this.MAX - this.mensaje.length; }

  enviar() {
    if (!this.mensaje.trim() || !this.destino || this.enviando) return;
    this.enviando = true;
    const gymNombre = this.gymService.getGym()?.nombre;
    this.feedbackService.enviar(this.mensaje.trim(), gymNombre, this.destino!, this.anonimo).subscribe({
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
