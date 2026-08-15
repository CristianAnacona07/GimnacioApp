import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { GymService, Gym } from '../../../../services/gym.service';
import { ConfiguracionService } from '../../../../services/configuracion.service';
import { CitasService, Profesional } from '../../../../services/citas.service';
import { ToastService } from '../../../../services/toast.service';

/** Valores por defecto para un gimnasio que aún no configuró la agenda. */
function agendaVacia() {
  return {
    activa: false,
    duracionMin: 60,
    precio: 0,
    horasMinimasReserva: 2,
    horasMinimasCancelacion: 4,
    diasVisibles: 14
  };
}

/**
 * Configuración de las sesiones personalizadas.
 *
 * El gimnasio decide cuánto duran y cuánto cuestan; el horario lo publica cada
 * profesional desde su propia pantalla. Aquí solo se muestra quién ya lo hizo,
 * porque es la causa más común de que un socio no pueda agendar.
 */
@Component({
  selector: 'app-configuracion-agenda',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './agenda.html',
  styleUrls: ['../configuracion.css', './agenda.css']
})
export class ConfiguracionAgenda implements OnInit {
  private gymService = inject(GymService);
  private config = inject(ConfiguracionService);
  private citasService = inject(CitasService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  gym: Gym | null = null;
  agenda = agendaVacia();
  profesionales: Profesional[] = [];
  guardando = false;

  ngOnInit(): void {
    const actual = this.gymService.getGym();
    this.gym = actual ? JSON.parse(JSON.stringify(actual)) : null;
    this.agenda = { ...agendaVacia(), ...((this.gym as any)?.agenda || {}) };

    this.citasService.profesionales().subscribe({
      next: (lista) => { this.profesionales = lista; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  guardar(): void {
    if (!this.gym?._id || this.guardando) return;
    if (this.agenda.duracionMin < 15) {
      this.toast.error('La duración mínima es de 15 minutos');
      return;
    }
    this.guardando = true;
    this.config.guardarGimnasio(this.gym._id, { agenda: this.agenda } as any).subscribe({
      next: (actualizado) => {
        this.guardando = false;
        this.gymService.guardarGym(actualizado);
        this.toast.success('Configuración guardada');
        this.cdr.detectChanges();
      },
      error: () => {
        this.guardando = false;
        this.toast.error('No se pudo guardar');
        this.cdr.detectChanges();
      }
    });
  }

  franjasDe(p: Profesional): string {
    return (p.disponibilidad || []).map(f => `${f.dia} ${f.desde}–${f.hasta}`).join(' · ');
  }
}
