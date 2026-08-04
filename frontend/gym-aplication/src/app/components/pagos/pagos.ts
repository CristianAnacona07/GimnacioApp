import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PagosService } from './../../services/pagos.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../services/confirm.service';
import { UserStateService } from '../../services/user-state.service';

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
  mostrarFormulario = false;
  esEdicion = false;
  idEdicion = '';

  formulario = { titulo: '', descripcion: '', imagenUrl: '', datosClave: '', tipo: 'digital' };

  constructor(
    private pagosService: PagosService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private userStateService: UserStateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.role = this.userStateService.getRole() || '';
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
    this.formulario = { titulo: '', descripcion: '', imagenUrl: '', datosClave: '', tipo: 'digital' };
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
