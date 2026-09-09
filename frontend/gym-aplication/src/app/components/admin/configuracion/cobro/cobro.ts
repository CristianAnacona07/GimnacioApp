import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { GymService, Gym } from '../../../../services/gym.service';
import { ConfiguracionService } from '../../../../services/configuracion.service';
import { ToastService } from '../../../../services/toast.service';
import { environment } from '../../../../../environments/environment';

interface EstadoWompi {
  publicKey: string;
  tieneIntegridad: boolean;
  tieneEventos: boolean;
  urlEventos: string;
  conectado: boolean;
}

/**
 * Cobro en línea: el gimnasio conecta su propia cuenta de Wompi.
 *
 * Las llaves son de cada gimnasio y no de la plataforma: la plata cae directo
 * en la cuenta del dueño y nadie queda de intermediario de pagos ajenos.
 *
 * Los dos secretos nunca vuelven del servidor — se muestran como "guardado" y
 * los campos quedan en blanco. Dejar uno vacío no lo borra: solo se reemplaza
 * lo que se escriba.
 */
@Component({
  selector: 'app-configuracion-cobro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cobro.html',
  styleUrl: './cobro.css'
})
export class ConfiguracionCobro implements OnInit {
  private gymService = inject(GymService);
  private config = inject(ConfiguracionService);
  private toast = inject(ToastService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  gym: Gym | null = null;
  estado: EstadoWompi | null = null;
  cargando = true;
  guardando = false;

  /** Lo que se escribe. Los secretos arrancan vacíos siempre. */
  form = { wompiPublicKey: '', wompiIntegritySecret: '', wompiEventsSecret: '' };

  ngOnInit(): void {
    this.gym = this.gymService.getGym();
    if (!this.gym?._id) { this.cargando = false; return; }

    this.http.get<EstadoWompi>(`${environment.apiUrl}/api/gym/${this.gym._id}/wompi`).subscribe({
      next: (e) => {
        this.estado = e;
        this.form.wompiPublicKey = e.publicKey || '';
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => { this.cargando = false; this.cdr.detectChanges(); }
    });
  }

  /** La dirección que hay que pegar en el panel de Wompi. */
  get urlEventos(): string {
    return this.estado?.urlEventos && this.estado.urlEventos.startsWith('http')
      ? this.estado.urlEventos
      : `${environment.apiUrl}/api/wompi/eventos`;
  }

  copiar(texto: string): void {
    navigator.clipboard?.writeText(texto)
      .then(() => this.toast.success('Copiado'))
      .catch(() => this.toast.error('No se pudo copiar'));
  }

  guardar(): void {
    if (!this.gym?._id || this.guardando) return;
    this.guardando = true;

    // Solo se manda lo que el admin escribió: un campo en blanco no pisa lo
    // que ya estaba guardado.
    const cambios: any = {};
    for (const campo of ['wompiPublicKey', 'wompiIntegritySecret', 'wompiEventsSecret'] as const) {
      const valor = this.form[campo].trim();
      if (valor) cambios[campo] = valor;
    }
    if (!Object.keys(cambios).length) {
      this.guardando = false;
      this.toast.info('No cambiaste nada');
      return;
    }

    this.config.guardarGimnasio(this.gym._id, cambios).subscribe({
      next: () => {
        this.guardando = false;
        this.form.wompiIntegritySecret = '';
        this.form.wompiEventsSecret = '';
        this.toast.success('Cobro en línea actualizado');
        this.ngOnInit();
      },
      error: () => {
        this.guardando = false;
        this.toast.error('No se pudo guardar');
        this.cdr.detectChanges();
      }
    });
  }

  /** Desconectar: se manda null explícito, que sí borra. */
  desconectar(): void {
    if (!this.gym?._id) return;
    this.guardando = true;
    this.config.guardarGimnasio(this.gym._id, {
      wompiPublicKey: null, wompiIntegritySecret: null, wompiEventsSecret: null
    } as any).subscribe({
      next: () => {
        this.guardando = false;
        this.form = { wompiPublicKey: '', wompiIntegritySecret: '', wompiEventsSecret: '' };
        this.toast.success('Cobro en línea desconectado');
        this.ngOnInit();
      },
      error: () => {
        this.guardando = false;
        this.toast.error('No se pudo desconectar');
        this.cdr.detectChanges();
      }
    });
  }
}
