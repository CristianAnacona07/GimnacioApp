import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Cita, CitasService, DIAS_SEMANA, Franja } from '../../../services/citas.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';
import { TiempoRealService } from '../../../services/tiempo-real.service';

/**
 * Lo que ve un profesional: las citas que tiene y el horario que ofrece.
 *
 * El horario es lo que hace que aparezca en la lista al agendar: sin franjas
 * publicadas, nadie puede reservarle.
 */
@Component({
  selector: 'app-agenda-profesional',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agenda.html',
  styleUrl: './agenda.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgendaProfesional implements OnInit {
  private citasService = inject(CitasService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private tiempoReal = inject(TiempoRealService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  readonly dias = DIAS_SEMANA;

  citas: Cita[] = [];
  horario: Franja[] = [];
  cargando = true;
  guardando = false;
  editandoHorario = false;

  ngOnInit(): void {
    this.cargarCitas();

    this.citasService.miHorario()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => { this.horario = res.disponibilidad || []; this.cdr.markForCheck(); },
        error: () => {}
      });

    // Una reserva nueva aparece en la agenda sin recargar.
    this.tiempoReal.conectar();
    this.tiempoReal.escuchar('cita:nueva')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.toast.info('Tenés una cita nueva');
        this.cargarCitas();
      });
    this.tiempoReal.escuchar('cita:cancelada')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarCitas());
  }

  private cargarCitas(): void {
    this.citasService.mias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (citas) => {
          this.citas = citas.filter(c => c.estado === 'agendada');
          this.cargando = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.cargando = false;
          this.toast.error('No se pudieron cargar las citas');
          this.cdr.markForCheck();
        }
      });
  }

  // ── Horario ───────────────────────────────────────────────────────────────
  agregarFranja(): void {
    this.horario = [...this.horario, { dia: 'Lunes', desde: '18:00', hasta: '20:00' }];
    this.cdr.markForCheck();
  }

  quitarFranja(i: number): void {
    this.horario = this.horario.filter((_, idx) => idx !== i);
    this.cdr.markForCheck();
  }

  guardarHorario(): void {
    if (this.guardando) return;
    this.guardando = true;
    this.citasService.guardarHorario(this.horario).subscribe({
      next: () => {
        this.guardando = false;
        this.editandoHorario = false;
        this.toast.success('Horario guardado');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.guardando = false;
        this.toast.error(err.error?.mensaje || 'No se pudo guardar el horario');
        this.cdr.markForCheck();
      }
    });
  }

  // ── Citas ─────────────────────────────────────────────────────────────────
  async marcar(cita: Cita, estado: 'cumplida' | 'ausente'): Promise<void> {
    const texto = estado === 'cumplida' ? 'como cumplida' : 'como ausente';
    const ok = await this.confirm.confirm(`¿Marcar la cita de ${cita.socioId.nombre} ${texto}?`);
    if (!ok) return;
    this.citasService.marcar(cita._id, estado).subscribe({
      next: () => { this.toast.success('Cita actualizada'); this.cargarCitas(); },
      error: () => this.toast.error('No se pudo actualizar')
    });
  }

  async cancelar(cita: Cita): Promise<void> {
    const ok = await this.confirm.confirm(
      `¿Cancelar la cita con ${cita.socioId.nombre}? Se le avisará al momento.`
    );
    if (!ok) return;
    this.citasService.cancelar(cita._id).subscribe({
      next: () => { this.toast.success('Cita cancelada'); this.cargarCitas(); },
      error: () => this.toast.error('No se pudo cancelar')
    });
  }

  // ── Presentación ──────────────────────────────────────────────────────────
  fechaLegible(fecha: string): string {
    const [a, m, d] = fecha.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  esHoy(fecha: string): boolean { return fecha === CitasService.hoy(); }

  /** Citas agrupadas por día, que es como se lee una agenda. */
  get porDia(): { fecha: string; citas: Cita[] }[] {
    const mapa = new Map<string, Cita[]>();
    for (const c of this.citas) {
      const lista = mapa.get(c.fecha);
      lista ? lista.push(c) : mapa.set(c.fecha, [c]);
    }
    return [...mapa.entries()].map(([fecha, citas]) => ({ fecha, citas }));
  }
}
