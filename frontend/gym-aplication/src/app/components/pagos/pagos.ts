import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PagosService, Facturacion, MesFacturado } from './../../services/pagos.service';
import { ToastService } from '../../services/toast.service';
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

  // ── Facturación ─────────────────────────────────────────────────────────
  // Solo la ve el admin: es la plata del gimnasio, no del socio.
  readonly MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
                    'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
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


  constructor(
    private pagosService: PagosService,
    private toast: ToastService,
    private userStateService: UserStateService,
    private permisos: PermisosService,
    private cdr: ChangeDetectorRef
  ) {}

  get puedeEditar(): boolean {
    return this.permisos.puede('pagos', 'edicion');
  }

  ngOnInit() {
    this.role = this.userStateService.getRole() || '';
    this.cargarFacturacion();
  }

}
