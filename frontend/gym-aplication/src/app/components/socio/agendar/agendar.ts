import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Cita, CitasService, ConfigAgenda, DiaLibre, Profesional } from '../../../services/citas.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';
import { TiempoRealService } from '../../../services/tiempo-real.service';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/**
 * Agendar una sesión personalizada.
 *
 * Tres pasos en una sola pantalla: elegir profesional, elegir día, elegir hora.
 * Los huecos los calcula el servidor cruzando el horario del profesional con lo
 * ya reservado, así que aquí solo se muestran horas realmente libres.
 */
@Component({
  selector: 'app-agendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agendar.html',
  styleUrl: './agendar.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Agendar implements OnInit {
  private citasService = inject(CitasService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private tiempoReal = inject(TiempoRealService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  profesionales: Profesional[] = [];
  elegido: Profesional | null = null;

  dias: DiaLibre[] = [];
  diaAbierto: string | null = null;
  config: ConfigAgenda | null = null;

  misCitas: Cita[] = [];
  nota = '';
  cargando = true;
  buscandoHoras = false;
  reservando = false;

  ngOnInit(): void {
    this.citasService.profesionales()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lista) => {
          this.profesionales = lista;
          this.cargando = false;
          // Con un solo profesional no tiene sentido hacer elegir: se abre solo.
          if (lista.length === 1) this.elegir(lista[0]);
          this.cdr.markForCheck();
        },
        error: () => {
          this.cargando = false;
          this.toast.error('No se pudieron cargar los profesionales');
          this.cdr.markForCheck();
        }
      });

    this.cargarMisCitas();

    // Si alguien reserva o cancela, las horas libres cambian: se recalculan.
    this.tiempoReal.conectar();
    this.tiempoReal.escuchar('cita:cancelada')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.cargarMisCitas(); if (this.elegido) this.cargarHoras(this.elegido); });
  }

  // ── Paso 1: profesional ───────────────────────────────────────────────────
  elegir(p: Profesional): void {
    this.elegido = p;
    this.diaAbierto = null;
    this.cargarHoras(p);
  }

  volverALista(): void {
    this.elegido = null;
    this.dias = [];
    this.cdr.markForCheck();
  }

  private cargarHoras(p: Profesional): void {
    this.buscandoHoras = true;
    this.cdr.markForCheck();
    this.citasService.libres(p._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.dias = res.dias || [];
          this.config = res.config;
          this.buscandoHoras = false;
          // Se abre el primer día con huecos para ahorrar un toque.
          // No se abre ningún día solo: el calendario muestra cuáles hay y
          // el socio toca el que quiere.
          this.diaAbierto = null;
          this.cdr.markForCheck();
        },
        error: () => {
          this.buscandoHoras = false;
          this.toast.error('No se pudieron cargar los horarios');
          this.cdr.markForCheck();
        }
      });
  }

  // ── Paso 2 y 3: día y hora ────────────────────────────────────────────────
  abrirDia(fecha: string): void {
    this.diaAbierto = this.diaAbierto === fecha ? null : fecha;
    this.cdr.markForCheck();
  }


  // ── Calendario del mes ────────────────────────────────────────────────
  // El socio ve el mes entero y toca un día; recién ahí aparecen las horas.
  // Antes era una lista de días, que con dos semanas ya no entraba en una
  // pantalla de celular.

  /** Mes que se está mirando, 'YYYY-MM'. Arranca en el de hoy. */
  mes = new Date().toISOString().slice(0, 7);

  private get hoyISO(): string { return new Date().toISOString().slice(0, 10); }

  get etiquetaMes(): string {
    const [a, m] = this.mes.split('-').map(Number);
    return `${MESES[m - 1]} ${a}`;
  }

  /** Casillas vacías antes del día 1: la semana empieza en lunes. */
  get huecosIniciales(): number[] {
    const [a, m] = this.mes.split('-').map(Number);
    const dow = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
    return Array((dow + 6) % 7).fill(0);
  }

  get diasDelMes(): { fecha: string; numero: number; horas: string[]; esHoy: boolean }[] {
    const [a, m] = this.mes.split('-').map(Number);
    const cuantos = new Date(Date.UTC(a, m, 0)).getUTCDate();
    // Lo que devuelve el servidor son solo los días CON horas libres; el resto
    // del mes se dibuja igual, apagado.
    const libres = new Map(this.dias.map(d => [d.fecha, d.horas]));
    const salida = [];
    for (let d = 1; d <= cuantos; d++) {
      const fecha = `${this.mes}-${String(d).padStart(2, '0')}`;
      salida.push({ fecha, numero: d, horas: libres.get(fecha) || [], esHoy: fecha === this.hoyISO });
    }
    return salida;
  }

  get horasDelDiaAbierto(): string[] {
    return this.dias.find(d => d.fecha === this.diaAbierto)?.horas || [];
  }

  mesAnterior(): void { this.moverMes(-1); }
  mesSiguiente(): void { this.moverMes(1); }

  private moverMes(paso: number): void {
    const [a, m] = this.mes.split('-').map(Number);
    this.mes = new Date(Date.UTC(a, m - 1 + paso, 1)).toISOString().slice(0, 7);
    this.diaAbierto = null;
  }

  /** Reserva la hora del día que está abierto. */
  reservarHora(hora: string): void {
    const dia = this.dias.find(d => d.fecha === this.diaAbierto);
    if (dia) this.reservar(dia, hora);
  }

  async reservar(dia: DiaLibre, hora: string): Promise<void> {
    if (this.reservando || !this.elegido) return;
    const precio = this.config?.precio ? ` (${this.formatearPrecio(this.config.precio)})` : '';
    const ok = await this.confirm.confirm(
      `¿Agendar con ${this.elegido.nombre} el ${this.diaLegible(dia)} a las ${hora}${precio}?`
    );
    if (!ok) return;

    this.reservando = true;
    this.cdr.markForCheck();
    this.citasService.agendar({
      profesionalId: this.elegido._id,
      fecha: dia.fecha,
      hora,
      nota: this.nota.trim()
    }).subscribe({
      next: () => {
        this.reservando = false;
        this.nota = '';
        this.toast.success('¡Cita agendada!');
        this.cargarMisCitas();
        if (this.elegido) this.cargarHoras(this.elegido);
      },
      error: (err) => {
        this.reservando = false;
        this.toast.error(err.error?.mensaje || 'No se pudo agendar');
        // Si el hueco lo tomó otro, la lista se refresca para no insistir.
        if (err.status === 409 && this.elegido) this.cargarHoras(this.elegido);
        this.cdr.markForCheck();
      }
    });
  }

  // ── Mis citas ─────────────────────────────────────────────────────────────
  private cargarMisCitas(): void {
    this.citasService.mias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (citas) => {
          this.misCitas = citas.filter(c => c.estado === 'agendada');
          this.cdr.markForCheck();
        },
        error: () => {}
      });
  }

  async cancelar(cita: Cita): Promise<void> {
    const ok = await this.confirm.confirm(
      `¿Cancelar la cita del ${this.fechaLegible(cita.fecha)} a las ${cita.hora}?`
    );
    if (!ok) return;
    this.citasService.cancelar(cita._id).subscribe({
      next: () => {
        this.toast.success('Cita cancelada');
        this.cargarMisCitas();
        if (this.elegido) this.cargarHoras(this.elegido);
      },
      error: (err) => this.toast.error(err.error?.mensaje || 'No se pudo cancelar')
    });
  }

  // ── Presentación ──────────────────────────────────────────────────────────
  /** 'Martes 12 de agosto' a partir de 'YYYY-MM-DD', sin correr el día. */
  fechaLegible(fecha: string): string {
    const [a, m, d] = fecha.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }

  diaLegible(dia: DiaLibre): string {
    const hoy = CitasService.hoy();
    if (dia.fecha === hoy) return 'hoy';
    return this.fechaLegible(dia.fecha);
  }

  esHoy(fecha: string): boolean { return fecha === CitasService.hoy(); }

  formatearPrecio(valor: number): string {
    return valor.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  }

  cargoLegible(p: Profesional): string {
    if (p.role === 'entrenador') return 'Entrenador';
    const cargos: Record<string, string> = { nutricionista: 'Nutricionista', recepcionista: 'Recepción', limpieza: 'Mantenimiento' };
    return cargos[p.cargo || ''] || 'Profesional';
  }

  inicial(nombre: string): string { return (nombre || '?')[0].toUpperCase(); }
}
