import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../services/auth';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';
import { PermisosService } from '../../../services/permisos.service';

interface Empleado {
  _id: string;
  nombre: string;
  email: string;
  role: 'entrenador' | 'empleado';
  cargo: string | null;
  fotoUrl?: string;
  telefono?: string;
  identificacion?: string;
  /** Sigue con la contraseña temporal: todavía no entró por primera vez. */
  debeCambiarPassword?: boolean;
  /** Ya resueltos por el servidor: lo guardado sobre lo de fábrica. */
  permisos?: Record<string, string>;
  createdAt?: string;
}

/** Cargos que el admin puede asignar al crear un empleado. */
const CARGOS = [
  { valor: 'recepcionista', etiqueta: 'Recepcionista', icono: '🎫' },
  { valor: 'entrenador', etiqueta: 'Entrenador', icono: '🏋️' },
  { valor: 'limpieza', etiqueta: 'Limpieza / Mantenimiento', icono: '🧹' },
  { valor: 'nutricionista', etiqueta: 'Nutricionista', icono: '🥗' },
];

/**
 * Secciones que el admin reparte, con el texto que ve una persona. El orden es
 * el de la barra lateral, para que la pantalla se lea como el menú que va a
 * tener el empleado.
 */
const OCULTO   = { valor: 'ninguno', etiqueta: 'Oculto' };
const VER      = { valor: 'lectura', etiqueta: 'Solo ver' };
const EDITAR   = { valor: 'edicion', etiqueta: 'Puede editar' };
const USAR     = { valor: 'edicion', etiqueta: 'Puede usar' };

const SECCIONES = [
  { clave: 'socios',    titulo: 'Socios',    detalle: 'La lista y la ficha de cada socio. Editar incluye renovar días y quitar la membresía.', niveles: [OCULTO, VER, EDITAR] },
  { clave: 'rutinas',   titulo: 'Rutinas',   detalle: 'Armar y modificar rutinas de entrenamiento. Borrarlas sigue siendo tuyo.',            niveles: [OCULTO, VER, EDITAR] },
  { clave: 'recepcion', titulo: 'Recepción', detalle: 'Registrar la entrada de socios por código o QR.',                                     niveles: [OCULTO, USAR] },
  { clave: 'noticias',  titulo: 'Noticias',  detalle: 'Los avisos que ven los socios. Publicarlos sigue siendo tuyo.',                       niveles: [OCULTO, VER] },
  { clave: 'planes',    titulo: 'Planes',    detalle: 'Los planes de membresía y sus precios.',                                              niveles: [OCULTO, VER] },
  { clave: 'pagos',     titulo: 'Pagos',     detalle: 'Los métodos de pago del gimnasio.',                                                   niveles: [OCULTO, VER] },
  { clave: 'empleados', titulo: 'Empleados', detalle: 'El resto del personal. Dar de alta y de baja sigue siendo tuyo.',                      niveles: [OCULTO, VER] },
];

@Component({
  selector: 'app-empleados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './empleados.html',
  styleUrl: './empleados.css',
})
export class Empleados implements OnInit {
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private cdr = inject(ChangeDetectorRef);
  private permisos = inject(PermisosService);

  readonly cargos = CARGOS;

  /** Dar de alta y de baja personal es del admin; el resto sólo consulta. */
  get puedeAdministrar(): boolean {
    return this.permisos.esAdmin;
  }

  empleados: Empleado[] = [];
  cargando = false;
  /** Solo si el correo no pudo enviarse: hay que dictarle la clave a mano. */
  passwordParaEntregar: { nombre: string; password: string } | null = null;

  mostrarForm = false;
  guardando = false;

  readonly secciones = SECCIONES;

  /** Empleado cuyos permisos se están editando, con el borrador sin guardar. */
  editandoPermisos: Empleado | null = null;
  borrador: Record<string, string> = {};
  guardandoPermisos = false;

  abrirPermisos(e: Empleado): void {
    this.editandoPermisos = e;
    // Copia: si cancela, lo de la fila queda como estaba.
    this.borrador = {};
    for (const s of SECCIONES) this.borrador[s.clave] = e.permisos?.[s.clave] || 'ninguno';
  }

  cerrarPermisos(): void {
    this.editandoPermisos = null;
  }

  guardarPermisos(): void {
    const empleado = this.editandoPermisos;
    if (!empleado || this.guardandoPermisos) return;
    this.guardandoPermisos = true;

    this.authService.guardarPermisos(empleado._id, this.borrador).subscribe({
      next: (res: any) => {
        this.guardandoPermisos = false;
        this.editandoPermisos = null;
        // El servidor devuelve los permisos ya resueltos: se refresca la lista
        // en vez de confiar en el borrador, que puede traer valores que él
        // descartó por desconocidos.
        empleado.permisos = res?.permisos || this.borrador;
        this.toast.success('Permisos actualizados');
        this.cargar();
      },
      error: (err) => {
        this.guardandoPermisos = false;
        this.toast.error(err.error?.mensaje || 'No se pudieron guardar los permisos');
        this.cdr.detectChanges();
      },
    });
  }

  /** Resumen de una fila: "Socios, Rutinas +2" para no listar las siete. */
  resumenPermisos(e: Empleado): string {
    const activas = SECCIONES.filter(s => (e.permisos?.[s.clave] || 'ninguno') !== 'ninguno');
    if (!activas.length) return 'Sin acceso a ninguna sección';
    const primeras = activas.slice(0, 2).map(s => s.titulo).join(', ');
    return activas.length > 2 ? `${primeras} +${activas.length - 2}` : primeras;
  }
  /** La contraseña no está: la genera el servidor y viaja por correo. */
  nuevo = { nombre: '', email: '', identificacion: '', telefono: '', cargo: '' };

  abrirForm(): void {
    this.nuevo = { nombre: '', email: '', identificacion: '', telefono: '', cargo: '' };
    this.mostrarForm = true;
  }

  cerrarForm(): void {
    this.mostrarForm = false;
  }

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargando = true;
    this.authService.getEmpleados().subscribe({
      next: (data) => {
        this.empleados = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.toast.error('Error al cargar los empleados');
      },
    });
  }

  /** Etiqueta e icono del cargo (el entrenador es rol propio, sin campo cargo). */
  infoCargo(e: Empleado): { etiqueta: string; icono: string } {
    const valor = e.role === 'entrenador' ? 'entrenador' : e.cargo || '';
    const c = CARGOS.find(c => c.valor === valor);
    return c ? { etiqueta: c.etiqueta, icono: c.icono } : { etiqueta: 'Empleado', icono: '🧑‍💼' };
  }

  get formValido(): boolean {
    const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.nuevo.email.trim());
    return !!(this.nuevo.nombre.trim() && correoValido &&
      this.nuevo.identificacion.trim() && this.nuevo.cargo);
  }

  crear() {
    if (!this.formValido || this.guardando) return;
    this.guardando = true;
    this.authService.crearEmpleado({
      nombre: this.nuevo.nombre.trim(),
      email: this.nuevo.email.trim(),
      identificacion: this.nuevo.identificacion.trim(),
      telefono: this.nuevo.telefono.trim(),
      cargo: this.nuevo.cargo,
    }).subscribe({
      next: (res: any) => {
        this.guardando = false;
        this.mostrarForm = false;
        if (res?.correoEnviado) {
          this.toast.success('Empleado creado. Le enviamos sus datos de acceso por correo.');
        } else {
          // El correo no salió: la clave temporal se muestra para entregarla
          // a mano, o el alta quedaría inservible.
          this.passwordParaEntregar = { nombre: this.nuevo.nombre.trim(), password: res?.passwordTemporal || '' };
          this.toast.info('Empleado creado, pero no se pudo enviar el correo.');
        }
        this.cargar();
      },
      error: (err) => {
        this.guardando = false;
        this.toast.error(err.error?.mensaje || 'Error al crear el empleado');
      },
    });
  }

  async eliminar(e: Empleado) {
    const ok = await this.confirm.confirm(`¿Eliminar a ${e.nombre}? Ya no podrá entrar a la app.`);
    if (!ok) return;
    this.authService.eliminarEmpleado(e._id).subscribe({
      next: () => {
        this.toast.success('Empleado eliminado');
        this.cargar();
      },
      error: () => this.toast.error('Error al eliminar el empleado'),
    });
  }
}
