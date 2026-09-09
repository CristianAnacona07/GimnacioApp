import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';

import { PlanesService } from './../../services/planes.service';
import { GymService } from './../../services/gym.service';
import { SolicitudesService, Solicitud, EstadoMembresia } from './../../services/solicitudes.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../services/confirm.service';
import { UserStateService } from '../../services/user-state.service';
import { PermisosService } from '../../services/permisos.service';

@Component({
  selector: 'app-planes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './planes.html',
  styleUrl: './planes.css',
})
export class Planes implements OnInit {
  role = 'socio';
  listaPlanes: any[] = [];
  mostrarFormulario = false;
  esEdicion = false;

  formulario: any = { nombre: '', descripcion: '', precio: null, dias: 30, caracteristicas: '' };

  // ── Adquirir un plan ────────────────────────────────────────────────────
  // El socio elige el plan y ahí mismo ve cómo pagarlo, en vez de tener que ir
  // a otra pantalla a buscar los medios de pago.
  planElegido: any = null;

  get esSocio(): boolean { return this.role === 'socio'; }

  /** Si el gimnasio conectó una pasarela. Sin ella el socio no puede pagar
   *  desde la app: solo avisar que pagó por transferencia. */
  get cobroEnLinea(): boolean {
    return !!(this.gymService.getGym() as any)?.cobroEnLinea;
  }

  /** El aviso que el socio ya tenga esperando confirmación. */
  miSolicitud: Solicitud | null = null;
  pagando = false;

  /** Su membresía: los días que le quedan y, al volver del pago, el saludo. */
  membresia: EstadoMembresia | null = null;

  /** Cuánto de la barra se pinta. Sin plan de referencia no se dibuja. */
  get avanceMembresia(): number {
    const m = this.membresia;
    if (!m?.diasDelPlan) return 0;
    return Math.min(100, Math.round((m.diasRestantes / m.diasDelPlan) * 100));
  }

  get venceLegible(): string {
    if (!this.membresia?.vence) return '';
    return new Date(this.membresia.vence).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long'
    });
  }

  abrirPago(plan: any): void {
    this.planElegido = plan;
  }

  /**
   * Pagar en línea: se deja el aviso y el servidor devuelve lo necesario para
   * abrir el checkout. Cuando la pasarela confirme el pago, el webhook activa
   * los días solo — nadie tiene que aprobar nada.
   */
  pagarEnLinea(metodoId?: string): void {
    if (!this.planElegido || this.pagando) return;
    this.pagando = true;
    this.solicitudes.crear(this.planElegido._id, metodoId).subscribe({
      next: (s) => {
        if (s.checkout) {
          this.solicitudes.irAlCheckout(s.checkout);
          return; // se va de la página
        }
        // Sin pasarela configurada queda como aviso para que lo confirmen a mano.
        this.pagando = false;
        this.miSolicitud = s;
        this.planElegido = null;
        this.toast.success('Listo: avisamos al gimnasio. Te activan apenas confirmen el pago.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.pagando = false;
        this.toast.error(err?.error?.error || 'No se pudo iniciar el pago');
        this.cdr.detectChanges();
      }
    });
  }

  private cargarMiSolicitud(): void {
    this.solicitudes.mia().subscribe({
      next: (s) => { this.miSolicitud = s; this.cdr.detectChanges(); },
      error: () => { this.miSolicitud = null; }
    });
  }

  private cargarMembresia(): void {
    this.solicitudes.estado().subscribe({
      next: (m) => { this.membresia = m; this.cdr.detectChanges(); },
      error: () => { this.membresia = null; }
    });
  }

  cerrarPago(): void {
    this.planElegido = null;
  }

  constructor(
    private planesService: PlanesService,
    private gymService: GymService,
    private solicitudes: SolicitudesService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private userStateService: UserStateService,
    private permisos: PermisosService,
    private cdr: ChangeDetectorRef,
    private location: Location
  ) {}

  get puedeEditar(): boolean {
    return this.permisos.puede('planes', 'edicion');
  }

  get puedeBorrar(): boolean {
    return this.permisos.puedeBorrar;
  }

  // Planes es una ruta compartida (llega desde el menú, o desde el enlace
  // "Editar planes" del editor de página): volver por historial, no a una
  // ruta fija, para que en cualquiera de los dos casos regrese a lo correcto.
  volver(): void {
    this.location.back();
  }

  ngOnInit() {
    this.role = this.userStateService.getRole()?.toLowerCase().trim() || 'socio';
    this.obtenerPlanes();
    // Los medios de pago solo le hacen falta a quien va a pagar.
    if (this.esSocio) { this.cargarMiSolicitud(); this.cargarMembresia(); }
  }

  obtenerPlanes() {
    this.planesService.obtenerPlanes().subscribe({
      next: (data: any) => {
        this.listaPlanes = data;
        this.cdr.detectChanges();
      },
      error: () => this.toast.error('Error al cargar planes')
    });
  }

  guardarPlan() {
    if (!this.formulario.nombre?.trim()) return this.toast.error('El nombre es obligatorio');
    if (!this.formulario.descripcion?.trim()) return this.toast.error('La descripción es obligatoria');

    const precio = Number(this.formulario.precio);
    if (isNaN(precio) || precio < 0) return this.toast.error('El precio debe ser un número válido');

    // Los días son los que la matrícula precargará al elegir este plan, así que un
    // valor raro aquí se convierte en membresías mal cargadas.
    const dias = Number(this.formulario.dias);
    if (!Number.isInteger(dias) || dias < 1) {
      return this.toast.error('La duración debe ser un número entero de días (mínimo 1)');
    }

    const datosEnviar = {
      ...this.formulario,
      precio,
      dias,
      caracteristicas: typeof this.formulario.caracteristicas === 'string'
        ? this.formulario.caracteristicas.split(',').map((c: string) => c.trim()).filter(Boolean)
        : this.formulario.caracteristicas
    };

    const operacion = this.esEdicion
      ? this.planesService.actualizarPlan(this.formulario._id, datosEnviar)
      : this.planesService.crearPlan(datosEnviar);

    operacion.subscribe({
      next: () => {
        this.toast.success(this.esEdicion ? 'Plan actualizado' : 'Plan creado');
        this.obtenerPlanes();
        this.cerrarFormulario();
      },
      error: () => this.toast.error(this.esEdicion ? 'Error al actualizar plan' : 'Error al crear plan')
    });
  }

  prepararEdicion(plan: any) {
    this.esEdicion = true;
    this.mostrarFormulario = true;
    this.formulario = {
      ...plan,
      // Los planes creados antes de que existiera el campo no traen días.
      dias: plan.dias ?? 30,
      caracteristicas: plan.caracteristicas.join(', ')
    };
  }

  async eliminarPlan(id: string) {
    const ok = await this.confirm.confirm('¿Estás seguro de eliminar este plan?');
    if (!ok) return;

    this.planesService.eliminarPlan(id).subscribe({
      next: () => {
        this.toast.success('Plan eliminado');
        this.obtenerPlanes();
      },
      error: () => this.toast.error('Error al eliminar el plan')
    });
  }

  abrirFormulario() {
    this.mostrarFormulario = true;
    this.esEdicion = false;
    this.limpiarFormulario();
  }

  limpiarFormulario() {
    this.formulario = { nombre: '', descripcion: '', precio: null, dias: 30, caracteristicas: '' };
  }

  cerrarFormulario() {
    this.mostrarFormulario = false;
    this.limpiarFormulario();
  }
}
