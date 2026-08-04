import { Component, OnInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgresoService } from '../../../services/progreso.service';
import { MedidasService } from '../../../services/medidas.service';
import { UserStateService } from '../../../services/user-state.service';
import { ToastService } from '../../../services/toast.service';
import { GymService } from '../../../services/gym.service';

interface Punto { fecha: string; peso: number | null; reps: number | null; }
interface RegistroPeso { fecha: string; pesoKg: number; _id?: string; fechaISO: string; }

@Component({
  selector: 'app-progreso',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './progreso.html',
  styleUrl: './progreso.css'
})
export class Progreso implements OnInit {
  @ViewChild('chartScroll')     chartScroll!:     ElementRef<HTMLDivElement>;
  @ViewChild('pesoChartScroll') pesoChartScroll!: ElementRef<HTMLDivElement>;

  usuarioId = '';
  ejercicios: string[] = [];
  ejercicioSeleccionado = '';
  historial: Punto[] = [];
  cargando = false;
  modo: 'peso' | 'reps' = 'peso';

  pesoActual: number | null = null;
  altura: number | null = null;

  // --- Tabs ---
  tabActiva: 'peso' | 'ejercicios' = 'peso';

  // --- Historial de peso corporal ---
  pesosHistorial: RegistroPeso[] = [];
  nuevoPeso: number | null = null;
  nuevaFecha = '';
  guardandoPeso = false;
  mostrarFormPeso = false;
  cargandoPeso = false;

  // SVG config
  readonly PUNTO_ANCHO = 52;
  readonly H = 180;
  readonly PAD = { top: 16, right: 24, bottom: 36, left: 44 };

  get colorPrimario():   string { return this.gymService.getGym()?.colores?.primario   || '#f97316'; }
  get colorSecundario(): string { return this.gymService.getGym()?.colores?.secundario || '#1d4ed8'; }

  constructor(
    private progresoService: ProgresoService,
    private medidasService: MedidasService,
    private userState: UserStateService,
    private toast: ToastService,
    private gymService: GymService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const user = this.userState.getCurrentUser();
    const datos = user?.datosPersonales;
    this.pesoActual = datos?.pesoActual || user?.pesoActual || null;
    this.altura     = datos?.altura     || user?.altura     || null;
    if (user?._id) {
      this.usuarioId = user._id;
      this.cargarEjercicios();
      this.cargarHistorialPeso();
    }
    this.nuevaFecha = new Date().toISOString().split('T')[0];
  }

  // ─── Ejercicios ───────────────────────────────────────────────────────────

  cargarEjercicios() {
    this.progresoService.getEjercicios(this.usuarioId).subscribe({
      next: (data) => { this.ejercicios = data; this.cdr.detectChanges(); },
      error: () => this.toast.error('Error al cargar los ejercicios')
    });
  }

  seleccionarEjercicio(nombre: string) {
    this.ejercicioSeleccionado = nombre;
    this.cargando = true;
    this.progresoService.getHistorial(this.usuarioId, nombre).subscribe({
      next: (data) => {
        this.historial = data.map(r => ({
          fecha: this.formatFecha(r.fecha),
          peso: r.pesoKg,
          reps: r.repeticiones
        }));
        this.cargando = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          if (this.chartScroll?.nativeElement)
            this.chartScroll.nativeElement.scrollLeft = this.chartScroll.nativeElement.scrollWidth;
        }, 50);
      },
      error: () => { this.cargando = false; }
    });
  }

  // ─── Historial de peso corporal ───────────────────────────────────────────

  cargarHistorialPeso() {
    this.cargandoPeso = true;
    this.medidasService.getHistorial(this.usuarioId).subscribe({
      next: (data) => {
        this.pesosHistorial = data
          .filter(m => m.peso != null)
          .map(m => ({
            fechaISO: m.fecha.split('T')[0],
            fecha: this.formatFecha(m.fecha),
            pesoKg: m.peso!,
            _id: m._id
          }))
          .sort((a, b) => a.fechaISO.localeCompare(b.fechaISO));

        // Si no hay registros pero el perfil tiene peso, mostrarlo como punto inicial
        if (this.pesosHistorial.length === 0 && this.pesoActual) {
          const hoy = new Date().toISOString().split('T')[0];
          this.pesosHistorial = [{
            fechaISO: hoy,
            fecha: this.formatFecha(hoy),
            pesoKg: this.pesoActual
          }];
        }

        this.cargandoPeso = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          if (this.pesoChartScroll?.nativeElement)
            this.pesoChartScroll.nativeElement.scrollLeft = this.pesoChartScroll.nativeElement.scrollWidth;
        }, 50);
      },
      error: () => { this.cargandoPeso = false; }
    });
  }

  guardarPeso() {
    if (!this.nuevoPeso || !this.nuevaFecha || this.guardandoPeso) return;
    this.guardandoPeso = true;
    this.medidasService.guardar({
      usuarioId: this.usuarioId,
      fecha: this.nuevaFecha,
      peso: this.nuevoPeso
    }).subscribe({
      next: () => {
        this.guardandoPeso = false;
        this.nuevoPeso = null;
        this.mostrarFormPeso = false;
        this.nuevaFecha = new Date().toISOString().split('T')[0];
        this.cargarHistorialPeso();
        this.toast.info('Peso registrado');
      },
      error: () => {
        this.guardandoPeso = false;
        this.toast.error('Error al guardar el peso');
      }
    });
  }

  get pesosHistorialReverso(): RegistroPeso[] {
    return [...this.pesosHistorial].reverse();
  }

  get pesoPrimero(): number | null { return this.pesosHistorial[0]?.pesoKg ?? null; }
  get pesoUltimo():  number | null { return this.pesosHistorial[this.pesosHistorial.length - 1]?.pesoKg ?? null; }

  get mejoraPeso(): string {
    if (this.pesosHistorial.length < 2 || !this.pesoPrimero) return '';
    const diff = (this.pesoUltimo ?? 0) - this.pesoPrimero;
    return diff >= 0 ? `+${diff.toFixed(1)} kg` : `${diff.toFixed(1)} kg`;
  }

  // ─── SVG helpers — ejercicio ──────────────────────────────────────────────

  private formatFecha(fechaStr: string): string {
    const [y, m, d] = fechaStr.split('T')[0].split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es', { day: '2-digit', month: 'short' });
  }

  get datos(): (number | null)[] {
    return this.historial.map(p => this.modo === 'peso' ? p.peso : p.reps);
  }

  get valoresValidos(): number[] {
    return this.datos.filter(v => v !== null) as number[];
  }

  get minVal(): number { return this.valoresValidos.length ? Math.min(...this.valoresValidos) : 0; }
  get maxVal(): number { return this.valoresValidos.length ? Math.max(...this.valoresValidos) : 10; }

  get dataW(): number {
    return this.PAD.right + Math.max(1, this.historial.length) * this.PUNTO_ANCHO;
  }

  get innerH(): number { return this.H - this.PAD.top - this.PAD.bottom; }

  xPos(i: number): number {
    if (this.historial.length <= 1) return this.PUNTO_ANCHO / 2;
    return i * this.PUNTO_ANCHO + this.PUNTO_ANCHO / 2;
  }

  yPos(val: number | null): number {
    if (val === null) return this.PAD.top + this.innerH / 2;
    const rng = this.maxVal - this.minVal || 1;
    return this.PAD.top + this.innerH - ((val - this.minVal) / rng) * this.innerH;
  }

  get polyline(): string {
    return this.historial.map((_, i) => `${this.xPos(i)},${this.yPos(this.datos[i])}`).join(' ');
  }

  get areaPath(): string {
    if (!this.historial.length) return '';
    const pts = this.historial.map((_, i) => `${this.xPos(i)},${this.yPos(this.datos[i])}`).join(' ');
    const last = this.historial.length - 1;
    return `M0,${this.PAD.top + this.innerH} L${pts.split(' ').join(' L')} L${this.xPos(last)},${this.PAD.top + this.innerH} Z`;
  }

  yLabels(): { val: string; y: number }[] {
    const rng = this.maxVal - this.minVal || 1;
    return [0, 0.5, 1].map(f => ({
      val: (this.minVal + rng * f).toFixed(0),
      y: this.PAD.top + this.innerH - f * this.innerH
    }));
  }

  get mejora(): string {
    const v = this.valoresValidos;
    if (v.length < 2) return '';
    const diff = v[v.length - 1] - v[0];
    const pct = ((diff / v[0]) * 100).toFixed(0);
    return diff >= 0 ? `+${pct}%` : `${pct}%`;
  }

  get mejoraPositiva(): boolean {
    const v = this.valoresValidos;
    return v.length >= 2 && v[v.length - 1] >= v[0];
  }

  get historialReverso(): typeof this.historial { return [...this.historial].reverse(); }

  // ─── SVG helpers — peso corporal ──────────────────────────────────────────

  get pesoDataW(): number {
    return this.PAD.right + Math.max(1, this.pesosHistorial.length) * this.PUNTO_ANCHO;
  }

  get pesoMin(): number {
    const vals = this.pesosHistorial.map(p => p.pesoKg);
    return vals.length ? Math.min(...vals) : 0;
  }

  get pesoMax(): number {
    const vals = this.pesosHistorial.map(p => p.pesoKg);
    return vals.length ? Math.max(...vals) : 100;
  }

  pesoXPos(i: number): number {
    if (this.pesosHistorial.length <= 1) return this.PUNTO_ANCHO / 2;
    return i * this.PUNTO_ANCHO + this.PUNTO_ANCHO / 2;
  }

  pesoYPos(val: number): number {
    const rng = this.pesoMax - this.pesoMin || 1;
    return this.PAD.top + this.innerH - ((val - this.pesoMin) / rng) * this.innerH;
  }

  get pesoPolyline(): string {
    return this.pesosHistorial.map((p, i) => `${this.pesoXPos(i)},${this.pesoYPos(p.pesoKg)}`).join(' ');
  }

  get pesoAreaPath(): string {
    if (!this.pesosHistorial.length) return '';
    const pts = this.pesosHistorial.map((p, i) => `${this.pesoXPos(i)},${this.pesoYPos(p.pesoKg)}`).join(' ');
    const last = this.pesosHistorial.length - 1;
    return `M0,${this.PAD.top + this.innerH} L${pts.split(' ').join(' L')} L${this.pesoXPos(last)},${this.PAD.top + this.innerH} Z`;
  }

  pesoYLabels(): { val: string; y: number }[] {
    const rng = this.pesoMax - this.pesoMin || 1;
    return [0, 0.5, 1].map(f => ({
      val: (this.pesoMin + rng * f).toFixed(1),
      y: this.PAD.top + this.innerH - f * this.innerH
    }));
  }
}
