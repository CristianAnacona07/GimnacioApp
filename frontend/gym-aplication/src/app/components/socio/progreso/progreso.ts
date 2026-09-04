import { Component, OnInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgresoService } from '../../../services/progreso.service';
import { MedidasService } from '../../../services/medidas.service';
import { UserStateService } from '../../../services/user-state.service';
import { ToastService } from '../../../services/toast.service';
import { GymService } from '../../../services/gym.service';
import { ConfirmService } from '../../../services/confirm.service';
import { CATALOGO_EJERCICIOS } from '../../../../data/ejercicios-catalogo';

interface Punto { _id: string; fecha: string; peso: number | null; reps: number | null; }
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
  /** El músculo elegido. Vacío hasta que llegan los registros. */
  categoriaSeleccionada = '';

  ejercicioSeleccionado = '';
  historial: Punto[] = [];
  cargando = false;
  modo: 'peso' | 'reps' = 'peso';

  // --- Edición inline del historial de ejercicio ---
  editandoId: string | null = null;
  editPeso: number | null = null;
  editReps: number | null = null;
  guardandoEdicion = false;

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
  // top: 28 y no 16 — el punto mas alto llega al techo del grafico y su
  // numero se dibuja 13px por encima, asi que con 16 quedaba cortado contra
  // el borde de arriba: se veia solo la mitad de la cifra.
  readonly PAD = { top: 28, right: 24, bottom: 36, left: 44 };

  get colorPrimario():   string { return this.gymService.getGym()?.colores?.primario   || '#f97316'; }
  get colorSecundario(): string { return this.gymService.getGym()?.colores?.secundario || '#1d4ed8'; }

  constructor(
    private progresoService: ProgresoService,
    private medidasService: MedidasService,
    private userState: UserStateService,
    private toast: ToastService,
    private gymService: GymService,
    private confirm: ConfirmService,
    private cdr: ChangeDetectorRef,
    private location: Location
  ) {}

  volver(): void {
    this.location.back();
  }

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
      next: (data) => {
        this.ejercicios = data || [];
        // Igual que las rutinas abren en el día de hoy: acá se abre en el
        // músculo que la persona entrenó última.
        const primera = this.porCategoria[0];
        if (primera && !this.categoriaSeleccionada) this.elegirCategoria(primera.nombre);
        this.cdr.detectChanges();
      },
      error: () => this.toast.error('Error al cargar los ejercicios')
    });
  }

  /**
   * Los ejercicios registrados, agrupados por músculo. Con muchos registros
   * una sola fila de píldoras se vuelve ilegible, sobre todo en el celular.
   * Lo que no está en el catálogo (cargado a mano) cae en "Otros".
   */
  get porCategoria(): { nombre: string; ejercicios: string[] }[] {
    const mapa = new Map<string, string[]>();
    for (const ej of this.ejercicios) {
      const cat = CATALOGO_EJERCICIOS.find(
        e => e.nombre.toLowerCase() === ej.toLowerCase()
      )?.categoria || 'Otros';
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(ej);
    }
    // El orden del Map es el de inserción, y `ejercicios` viene del más
    // reciente al más viejo: el músculo entrenado último queda primero.
    return [...mapa].map(([nombre, ejercicios]) => ({ nombre, ejercicios }));
  }

  get ejerciciosDeLaCategoria(): string[] {
    return this.porCategoria.find(c => c.nombre === this.categoriaSeleccionada)?.ejercicios || [];
  }

  elegirCategoria(nombre: string) {
    this.categoriaSeleccionada = nombre;
    // Ningún ejercicio se abre solo: se muestran los del músculo y el socio
    // elige. Y se limpia lo anterior, o quedaría en pantalla el gráfico del
    // músculo que acaba de dejar.
    this.ejercicioSeleccionado = '';
    this.historial = [];
    this.editandoId = null;
  }

  seleccionarEjercicio(nombre: string) {
    this.ejercicioSeleccionado = nombre;
    this.cargando = true;
    this.editandoId = null;
    this.progresoService.getHistorial(this.usuarioId, nombre).subscribe({
      next: (data) => {
        // Orden cronológico real: del más viejo al más nuevo, tal como lo
        // devuelve el backend. La gráfica avanza en el tiempo de izquierda a
        // derecha (serie 1 primero, última serie al final) y la tabla lo
        // acompaña. Antes esto se invertía acá y mi-rutina invertía a su vez
        // el orden de guardado para compensar: dos vueltas que se anulaban en
        // pantalla pero dejaban el cálculo de "mejora" con el signo cambiado.
        this.historial = data.map(r => ({
          _id: r._id,
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

  iniciarEdicion(p: Punto) {
    this.editandoId = p._id;
    this.editPeso = p.peso;
    this.editReps = p.reps;
  }

  cancelarEdicion() {
    this.editandoId = null;
  }

  guardarEdicion() {
    if (!this.editandoId || this.guardandoEdicion) return;
    this.guardandoEdicion = true;
    this.progresoService.actualizarRegistro(this.editandoId, {
      pesoKg: this.editPeso,
      repeticiones: this.editReps
    }).subscribe({
      next: () => {
        this.guardandoEdicion = false;
        this.editandoId = null;
        this.toast.info('Registro actualizado');
        this.seleccionarEjercicio(this.ejercicioSeleccionado);
      },
      error: () => {
        this.guardandoEdicion = false;
        this.toast.error('Error al actualizar el registro');
      }
    });
  }

  async eliminarRegistro(p: Punto) {
    const ok = await this.confirm.confirm('¿Eliminar este registro?');
    if (!ok) return;
    this.progresoService.eliminarRegistro(p._id).subscribe({
      next: () => {
        this.toast.info('Registro eliminado');
        if (this.historial.length === 1) {
          // Era el último registro del ejercicio: el chip también desaparece
          this.historial = [];
          this.ejercicioSeleccionado = '';
          this.cargarEjercicios();
        } else {
          this.seleccionarEjercicio(this.ejercicioSeleccionado);
        }
      },
      error: () => this.toast.error('Error al eliminar el registro')
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

  // El array va del más viejo al más nuevo: el primer registro es v[0] y el
  // más reciente el último. La mejora se mide desde dónde arrancó hasta dónde
  // llegó — subir de 30 kg a 60 kg es +100%, no un retroceso.
  get mejora(): string {
    const v = this.valoresValidos;
    if (v.length < 2) return '';
    const primero = v[0];
    if (!primero) return '';
    const diff = v[v.length - 1] - primero;
    const pct = ((diff / primero) * 100).toFixed(0);
    return diff >= 0 ? `+${pct}%` : `${pct}%`;
  }

  get mejoraPositiva(): boolean {
    const v = this.valoresValidos;
    return v.length >= 2 && v[v.length - 1] >= v[0];
  }

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
