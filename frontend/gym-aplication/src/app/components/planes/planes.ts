import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { PlanesService } from './../../services/planes.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../services/confirm.service';
import { UserStateService } from '../../services/user-state.service';

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

  formulario: any = { nombre: '', descripcion: '', precio: null, caracteristicas: '' };

  constructor(
    private planesService: PlanesService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private userStateService: UserStateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.role = this.userStateService.getRole()?.toLowerCase().trim() || 'socio';
    this.obtenerPlanes();
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

    const datosEnviar = {
      ...this.formulario,
      precio,
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
    this.formulario = { nombre: '', descripcion: '', precio: null, caracteristicas: '' };
  }

  cerrarFormulario() {
    this.mostrarFormulario = false;
    this.limpiarFormulario();
  }
}
