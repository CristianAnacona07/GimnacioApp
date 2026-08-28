import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import { NoticiaService } from '../../services/noticia.service';
import { LandingService } from '../../services/landing.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../services/confirm.service';
import { UserStateService } from '../../services/user-state.service';
import { PermisosService } from '../../services/permisos.service';

// Mismo tope que la portada de la página pública (pagina.ts): una foto de
// celular de varios MB no se ve mejor en la tarjeta de noticia, solo tarda
// más en subir.
const ANCHO_MAX = 1600;

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
  subiendoImagen = false;

  formulario = { titulo: '', descripcion: '', dia: '', horaInicio: '', horaFin: '', imageUrl: '', whatsappUrl: '' };
  dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  constructor(
    private noticiaService: NoticiaService,
    private landingService: LandingService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private userStateService: UserStateService,
    private permisos: PermisosService,
    private cdr: ChangeDetectorRef
  ) {}

  get puedeEditar(): boolean {
    return this.permisos.puede('noticias', 'edicion');
  }

  get puedeBorrar(): boolean {
    return this.permisos.puedeBorrar;
  }

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

  // ── Imagen desde el PC ───────────────────────────────────────────────────
  // Mismo patrón que la portada de la página pública (pagina.ts): redimensiona
  // en el navegador antes de subir, y el resultado es una URL pública como
  // cualquier otra — se guarda en el mismo campo que "URL de imagen", no hace
  // falta un campo aparte.
  private redimensionarImagen(archivo: File): Promise<string> {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onerror = () => rechazar(new Error('No se pudo leer el archivo'));
      lector.onload = (e: any) => {
        const img = new Image();
        img.onerror = () => rechazar(new Error('El archivo no es una imagen válida'));
        img.onload = () => {
          const escala = Math.min(1, ANCHO_MAX / Math.max(img.width, img.height));
          const lienzo = document.createElement('canvas');
          lienzo.width = Math.round(img.width * escala);
          lienzo.height = Math.round(img.height * escala);
          lienzo.getContext('2d')?.drawImage(img, 0, 0, lienzo.width, lienzo.height);
          resolver(lienzo.toDataURL('image/jpeg', 0.82));
        };
        img.src = e.target.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  async subirImagenDesdePc(evento: any): Promise<void> {
    const archivo = evento?.target?.files?.[0];
    if (!archivo) return;
    // Deja el input listo para volver a elegir el mismo archivo si hace falta.
    evento.target.value = '';

    this.subiendoImagen = true;
    this.cdr.detectChanges();
    try {
      const dataUrl = await this.redimensionarImagen(archivo);
      const res = await new Promise<{ url: string }>((ok, mal) =>
        this.landingService.subirImagen(dataUrl, 'noticias').subscribe({ next: ok, error: mal })
      );
      this.formulario.imageUrl = res.url;
    } catch (e: any) {
      this.toast.error(e?.error?.mensaje || e?.message || 'No se pudo subir la imagen');
    } finally {
      this.subiendoImagen = false;
      this.cdr.detectChanges();
    }
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
