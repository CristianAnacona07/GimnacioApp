import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import { NoticiaService } from '../../services/noticia.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../services/confirm.service';
import { UserStateService } from '../../services/user-state.service';

@Component({
  selector: 'app-noticias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './noticias.html',
  styleUrls: ['./noticias.css']
})
export class Noticias implements OnInit {
  noticias: any[] = [];
  mostrarFormulario = false;
  esEdicion = false;
  noticiaEditando: any = null;
  role = '';

  formulario = { titulo: '', descripcion: '', dia: '', horaInicio: '', horaFin: '', imageUrl: '', whatsappUrl: '' };
  dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  constructor(
    private noticiaService: NoticiaService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private userStateService: UserStateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.role = this.userStateService.getRole()?.toLowerCase().trim() || '';
    this.cargarNoticias();
  }

  cargarNoticias() {
    this.noticiaService.obtenerNoticias().subscribe({
      next: (data: any) => {
        this.noticias = data;
        this.cdr.detectChanges();
      },
      error: () => this.toast.error('Error al cargar noticias')
    });
  }

  abrirFormulario() {
    this.mostrarFormulario = true;
    this.esEdicion = false;
    this.limpiarFormulario();
  }

  cerrarFormulario() {
    this.mostrarFormulario = false;
    this.limpiarFormulario();
  }

  limpiarFormulario() {
    this.formulario = { titulo: '', descripcion: '', dia: '', horaInicio: '', horaFin: '', imageUrl: '', whatsappUrl: '' };
    this.noticiaEditando = null;
  }

  guardarNoticia(form: NgForm) {
    if (!form.valid) {
      this.toast.error('Por favor completa el título y la descripción');
      return;
    }

    const datosAEnviar: any = {
      titulo: this.formulario.titulo.trim(),
      descripcion: this.formulario.descripcion.trim()
    };

    if (this.esEdicion) {
      datosAEnviar.dia = this.formulario.dia || null;
    } else if (this.formulario.dia) {
      datosAEnviar.dia = this.formulario.dia;
    }

    if (this.formulario.horaInicio) datosAEnviar.horaInicio = this.formulario.horaInicio;
    if (this.formulario.horaFin)    datosAEnviar.horaFin = this.formulario.horaFin;
    datosAEnviar.imageUrl = this.formulario.imageUrl?.trim() || '';
    datosAEnviar.whatsappUrl = this.formulario.whatsappUrl?.trim() || '';

    const operacion = this.esEdicion
      ? this.noticiaService.actualizarNoticia(this.noticiaEditando._id, datosAEnviar)
      : this.noticiaService.crearNoticia(datosAEnviar);

    operacion.subscribe({
      next: () => {
        this.toast.success(this.esEdicion ? 'Noticia actualizada' : 'Noticia creada');
        form.resetForm();
        this.cerrarFormulario();
        this.cargarNoticias();
      },
      error: (error) => {
        const msg = error.error?.message || error.error?.error || 'Error al guardar la noticia';
        this.toast.error(msg);
      }
    });
  }

  editarNoticia(noticia: any) {
    this.noticiaEditando = noticia;
    this.formulario = {
      titulo: noticia.titulo || '',
      descripcion: noticia.descripcion || '',
      dia: noticia.dia ?? '',
      horaInicio: noticia.horaInicio || '',
      horaFin: noticia.horaFin || '',
      imageUrl: noticia.imageUrl || '',
      whatsappUrl: noticia.whatsappUrl || ''
    };
    this.esEdicion = true;
    this.mostrarFormulario = true;
  }

  async eliminarNoticia(id: string) {
    const ok = await this.confirm.confirm('¿Estás seguro de que deseas eliminar esta noticia?');
    if (!ok) return;

    this.noticiaService.eliminarNoticia(id).subscribe({
      next: () => {
        this.toast.success('Noticia eliminada');
        this.cargarNoticias();
      },
      error: () => this.toast.error('Error al eliminar la noticia')
    });
  }
}
