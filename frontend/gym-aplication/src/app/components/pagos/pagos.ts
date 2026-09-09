import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PagosService, Facturacion, MesFacturado } from './../../services/pagos.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../services/confirm.service';
import { UserStateService } from '../../services/user-state.service';
import { PermisosService } from '../../services/permisos.service';

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagos.html',
  styleUrl: './pagos.css',
})
export class Pagos implements OnInit {
  role = '';
  listaPagos: any[] = [];

  // ── Facturación ─────────────────────────────────────────────────────────
  // Solo la ve el admin: es la plata del gimnasio, no del socio.
  readonly MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
                    'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  /**
   * Arranca sin nada abierto, igual que Mi Progreso: se entra y se ven las dos
   * opciones. Volver a tocar la abierta la cierra.
   *
   * El socio no tiene pestañas — para él la vista se fija en ngOnInit, o se
   * quedaría mirando una pantalla vacía sin nada que tocar.
   */
  vista: 'metodos' | 'facturacion' | null = null;
  anio = new Date().getFullYear();
  mes = new Date().getMonth();
  factura: Facturacion | null = null;
  cargandoFactura = false;

  /** Los seis meses del gráfico, el elegido incluido. */
  historial: MesFacturado[] = [];

  /** Alto de una barra en %, contra el mes que más facturó. */
  alturaBarra(m: MesFacturado): number {
    const tope = Math.max(...this.historial.map(x => x.cobrado), 0);
    if (!tope) return 2;
    // Piso de 2%: un mes en cero tiene que dejar una marca visible, o parece
    // que el mes no existe en vez de que no entró plata.
    return Math.max(2, Math.round((m.cobrado / tope) * 100));
  }

  /** Seis meses en cero no son un gráfico, son seis rayas. */
  get historialVacio(): boolean {
    return this.historial.every(m => !m.cobrado);
  }

  /** La inicial del mes, para el pie del gráfico. */
  letraMes(m: MesFacturado): string {
    return this.MESES[new Date(m.desde).getMonth()].charAt(0);
  }

  nombreMes(m: MesFacturado): string {
    const d = new Date(m.desde);
    return `${this.MESES[d.getMonth()]} ${d.getFullYear()}`;
  }

  esMesElegido(m: MesFacturado): boolean {
    const d = new Date(m.desde);
    return d.getMonth() === this.mes && d.getFullYear() === this.anio;
  }

  /** Tocar una barra lleva a ese mes. */
  irAlMes(m: MesFacturado): void {
    const d = new Date(m.desde);
    if (this.esMesElegido(m)) return;
    this.anio = d.getFullYear();
    this.mes = d.getMonth();
    this.cargarFacturacion();
  }

  get etiquetaMes(): string { return `${this.MESES[this.mes]} ${this.anio}`; }

  /** El corte va del 1 al último día: el último día del mes se calcula pidiendo
   *  el día 0 del mes siguiente, que JavaScript resuelve como el anterior. */
  get corte(): string {
    const ultimo = new Date(this.anio, this.mes + 1, 0).getDate();
    return `1 al ${ultimo} de ${this.MESES[this.mes].toLowerCase()}`;
  }

  /** No se muestran meses que todavía no empezaron. */
  get hayMesSiguiente(): boolean {
    const hoy = new Date();
    return this.anio < hoy.getFullYear() || (this.anio === hoy.getFullYear() && this.mes < hoy.getMonth());
  }

  alternarVista(cual: 'metodos' | 'facturacion'): void {
    this.vista = this.vista === cual ? null : cual;
    if (this.vista === 'facturacion' && !this.factura) this.cargarFacturacion();
  }

  mesAnterior(): void {
    if (this.mes === 0) { this.mes = 11; this.anio--; } else { this.mes--; }
    this.cargarFacturacion();
  }

  mesSiguiente(): void {
    if (!this.hayMesSiguiente) return;
    if (this.mes === 11) { this.mes = 0; this.anio++; } else { this.mes++; }
    this.cargarFacturacion();
  }

  cargarFacturacion(): void {
    this.cargandoFactura = true;

    this.pagosService.historialMeses(this.anio, this.mes).subscribe({
      next: (h) => { this.historial = h.meses || []; this.cdr.detectChanges(); },
      error: () => { this.historial = []; }
    });

    this.pagosService.facturacion(this.anio, this.mes).subscribe({
      next: (f) => {
        this.factura = f;
        this.cargandoFactura = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoFactura = false;
        this.toast.error('No se pudo calcular la facturación');
        this.cdr.detectChanges();
      }
    });
  }
  mostrarFormulario = false;
  esEdicion = false;
  idEdicion = '';

  /** Primera letra del título, para la tarjeta sin logo. */
  inicial(titulo: string): string {
    return (titulo || '?').trim().charAt(0).toUpperCase();
  }

  formulario = { titulo: '', descripcion: '', imagenUrl: '', datosClave: '', enlace: '', tipo: 'digital' };

  constructor(
    private pagosService: PagosService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private userStateService: UserStateService,
    private permisos: PermisosService,
    private cdr: ChangeDetectorRef
  ) {}

  get puedeEditar(): boolean {
    return this.permisos.puede('pagos', 'edicion');
  }

  get puedeBorrar(): boolean {
    return this.permisos.puedeBorrar;
  }

  ngOnInit() {
    this.role = this.userStateService.getRole() || '';
    // Sin pestañas que tocar, la única vista posible ya viene abierta.
    if (!this.puedeEditar) this.vista = 'metodos';
    this.cargarMetodos();
  }

  cargarMetodos() {
    this.pagosService.obtenerMetodos().subscribe({
      next: (data) => {
        this.listaPagos = data;
        this.cdr.detectChanges();
      },
      error: () => this.toast.error('Error al cargar métodos de pago')
    });
  }

  abrirFormulario() {
    this.mostrarFormulario = true;
  }

  cerrarFormulario() {
    this.mostrarFormulario = false;
    this.esEdicion = false;
    this.idEdicion = '';
    this.formulario = { titulo: '', descripcion: '', imagenUrl: '', datosClave: '', enlace: '', tipo: 'digital' };
  }

  prepararEdicion(pago: any) {
    this.esEdicion = true;
    this.idEdicion = pago._id;
    this.formulario = { ...pago };
    this.abrirFormulario();
  }

  guardarPago() {
    if (!this.formulario.titulo || !this.formulario.descripcion) {
      this.toast.error('Por favor completa los campos obligatorios');
      return;
    }

    const peticion = this.esEdicion
      ? this.pagosService.actualizarMetodo(this.idEdicion, this.formulario)
      : this.pagosService.crearMetodo(this.formulario);

    peticion.subscribe({
      next: () => {
        this.toast.success(this.esEdicion ? 'Método actualizado' : 'Método de pago creado');
        this.cargarMetodos();
        this.cerrarFormulario();
        this.cdr.detectChanges();
      },
      error: (err) => this.toast.error('Error al guardar: ' + (err.error?.error || err.message))
    });
  }

  async eliminarMetodo(id: string) {
    const ok = await this.confirm.confirm('¿Estás seguro de que deseas eliminar este método de pago?');
    if (!ok) return;

    this.pagosService.eliminarMetodo(id).subscribe({
      next: () => {
        this.toast.success('Método de pago eliminado');
        this.cargarMetodos();
      },
      error: () => this.toast.error('Error al eliminar')
    });
  }

  copiarAlPortapapeles(texto: string) {
    navigator.clipboard.writeText(texto).then(() => {
      this.toast.info('Copiado al portapapeles: ' + texto);
    });
  }
}
