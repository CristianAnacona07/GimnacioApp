import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Cita, CitasService, DIAS_SEMANA, Franja } from '../../../services/citas.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';
import { TiempoRealService } from '../../../services/tiempo-real.service';
import { ActivatedRoute, RouterModule } from '@angular/router';

/**
 * Lo que ve un profesional: las citas que tiene y el horario que ofrece.
 *
 * El horario es lo que hace que aparezca en la lista al agendar: sin franjas
 * publicadas, nadie puede reservarle.
 */
@Component({
  selector: 'app-agenda-profesional',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
  private ruta = inject(ActivatedRoute);

  /**
   * De quién es la agenda que se está editando. Vacío = la propia.
   *
   * El admin abre la de un empleado desde la lista de Empleados: hay gente
   * (un nutricionista, alguien que no se maneja con la app) que necesita
   * tener horario publicado sin cargarlo ella misma.
   */
  profesionalId = '';
  nombreProfesional = '';

  get editandoAOtro(): boolean { return !!this.profesionalId; }

  get tituloCitas(): string {
    return this.editandoAOtro ? `Turnos que le reservaron a ${this.nombreProfesional}` : 'Tus turnos';
  }

  get vacioCitas(): string {
    return this.editandoAOtro ? 'Todavía no le reservaron ningún turno' : 'No tenés citas agendadas';
  }

  readonly dias = DIAS_SEMANA;

  citas: Cita[] = [];
  horario: Franja[] = [];
  cargando = true;
  guardando = false;
  editandoHorario = false;


  // ── Calendario del mes ────────────────────────────────────────────────
  // La disponibilidad se carga día por día: el profesional marca cuándo
  // puede, en vez de un patrón semanal que después hay que corregir.

  /** Mes que se está mirando, 'YYYY-MM'. */
  mes = new Date().toISOString().slice(0, 7);
  /** Las franjas ya publicadas de ese mes, por fecha. */
  private franjasDelMes: Record<string, Franja[]> = {};

  diaAbierto: string | null = null;
  franjasDelDia: Franja[] = [];

  private get hoy(): string { return new Date().toISOString().slice(0, 10); }

  get etiquetaMes(): string {
    const [a, m] = this.mes.split('-').map(Number);
    const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${nombres[m - 1]} ${a}`;
  }

  /**
   * Cuántas casillas vacías van antes del día 1 para que caiga bajo su día de
   * la semana. La semana empieza en lunes, no en domingo.
   */
  get huecosIniciales(): number[] {
    const [a, m] = this.mes.split('-').map(Number);
    const dow = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();   // 0 = domingo
    return Array((dow + 6) % 7).fill(0);
  }

  get diasDelMes(): { fecha: string; numero: number; franjas: Franja[]; esHoy: boolean; pasado: boolean }[] {
    const [a, m] = this.mes.split('-').map(Number);
    const cuantos = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const dias = [];
    for (let d = 1; d <= cuantos; d++) {
      const fecha = `${this.mes}-${String(d).padStart(2, '0')}`;
      dias.push({
        fecha,
        numero: d,
        franjas: this.franjasDelMes[fecha] || [],
        esHoy: fecha === this.hoy,
        // Un día que ya pasó no se puede abrir: nadie va a reservarlo.
        pasado: fecha < this.hoy
      });
    }
    return dias;
  }

  get tituloDiaAbierto(): string {
    if (!this.diaAbierto) return '';
    const [, m, d] = this.diaAbierto.split('-').map(Number);
    const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${d} de ${nombres[m - 1]}`;
  }

  private cargarMes(): void {
    this.citasService.disponibilidadMes(this.mes, this.profesionalId || undefined).subscribe({
      next: (res) => {
        this.franjasDelMes = res.dias || {};
        this.nombreProfesional = res.profesional?.nombre || '';
        this.cdr.markForCheck();
      },
      error: () => { this.franjasDelMes = {}; this.cdr.markForCheck(); }
    });
  }

  mesAnterior(): void { this.moverMes(-1); }
  mesSiguiente(): void { this.moverMes(1); }

  private moverMes(paso: number): void {
    const [a, m] = this.mes.split('-').map(Number);
    const t = new Date(Date.UTC(a, m - 1 + paso, 1));
    this.mes = t.toISOString().slice(0, 7);
    this.diaAbierto = null;
    this.cargarMes();
  }

  abrirDia(dia: { fecha: string; franjas: Franja[] }): void {
    this.diaAbierto = dia.fecha;
    // Copia, no la misma referencia: si cancela, lo del calendario no se toca.
    this.franjasDelDia = dia.franjas.map(f => ({ ...f }));
    if (!this.franjasDelDia.length) this.agregarFranjaDia();
  }

  agregarFranjaDia(): void {
    this.franjasDelDia = [...this.franjasDelDia, { desde: '08:00', hasta: '12:00' } as Franja];
  }

  quitarFranjaDia(i: number): void {
    this.franjasDelDia = this.franjasDelDia.filter((_, idx) => idx !== i);
  }

  guardarDia(): void {
    if (!this.diaAbierto || this.guardando) return;
    const fecha = this.diaAbierto;
    // Sin franjas se manda la lista vacía a propósito: así se cierra un día
    // que antes estaba abierto.
    const franjas = this.franjasDelDia.filter(f => f.desde && f.hasta);

    this.guardando = true;
    this.citasService.guardarDia(fecha, franjas, this.profesionalId || undefined).subscribe({
      next: () => {
        this.guardando = false;
        this.diaAbierto = null;
        this.franjasDelMes = { ...this.franjasDelMes, [fecha]: franjas };
        if (!franjas.length) delete this.franjasDelMes[fecha];
        this.toast.success(franjas.length ? 'Día guardado' : 'Día cerrado');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.guardando = false;
        this.toast.error(err.error?.mensaje || 'No se pudo guardar el día');
        this.cdr.markForCheck();
      }
    });
  }

  ngOnInit(): void {
    this.profesionalId = this.ruta.snapshot.paramMap.get('profesionalId') || '';

    this.cargarCitas();
    this.cargarMes();

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
    // El admin que abre la agenda de un empleado quiere ver los turnos que le
    // reservaron: ahí es donde los busca, no en una pantalla aparte.
    const fuente = this.editandoAOtro
      ? this.citasService.todas(undefined, this.profesionalId)
      : this.citasService.mias();
    fuente
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
