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

  mostrarForm = false;
  guardando = false;
  nuevo = { nombre: '', email: '', password: '', cargo: 'recepcionista' };

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
    return !!(this.nuevo.nombre.trim() && this.nuevo.email.trim() && this.nuevo.password.length >= 8);
  }

  crear() {
    if (!this.formValido || this.guardando) return;
    this.guardando = true;
    this.authService.crearEmpleado({
      nombre: this.nuevo.nombre.trim(),
      email: this.nuevo.email.trim(),
      password: this.nuevo.password,
      cargo: this.nuevo.cargo,
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.mostrarForm = false;
        this.nuevo = { nombre: '', email: '', password: '', cargo: 'recepcionista' };
        this.toast.success('Empleado creado');
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
