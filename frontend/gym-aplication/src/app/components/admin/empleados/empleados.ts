import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../services/auth';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';

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
  createdAt?: string;
}

/** Cargos que el admin puede asignar al crear un empleado. */
const CARGOS = [
  { valor: 'recepcionista', etiqueta: 'Recepcionista', icono: '🎫' },
  { valor: 'entrenador', etiqueta: 'Entrenador', icono: '🏋️' },
  { valor: 'limpieza', etiqueta: 'Limpieza / Mantenimiento', icono: '🧹' },
  { valor: 'nutricionista', etiqueta: 'Nutricionista', icono: '🥗' },
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

  readonly cargos = CARGOS;

  empleados: Empleado[] = [];
  cargando = false;
  /** Solo si el correo no pudo enviarse: hay que dictarle la clave a mano. */
  passwordParaEntregar: { nombre: string; password: string } | null = null;

  mostrarForm = false;
  guardando = false;
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
