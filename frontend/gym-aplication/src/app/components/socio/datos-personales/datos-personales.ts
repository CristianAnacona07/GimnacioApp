import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../../services/auth';
import { UserStateService } from '../../../services/user-state.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-datos-personales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './datos-personales.html'
})
export class DatosPersonales implements OnInit, OnDestroy {
  perfil: any = null;
  cargando = false;
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private userStateService: UserStateService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit() {
    const user = this.userStateService.getCurrentUser();
    if (user?._id) {
      this.cargarDatos(user._id);
    } else {
      this.router.navigate(['/login']);
    }
  }

  cargarDatos(id: string) {
    this.authService.getPerfilSocio(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        this.perfil = res.datosCompletos || res;

        if (!this.perfil.datosPersonales) {
          this.perfil.datosPersonales = {
            identificacion: '', fechaNacimiento: '', sexo: '',
            pesoActual: 0, altura: 0, telefono: ''
          };
        }
        if (!this.perfil.stats) {
          this.perfil.stats = { racha: 0, asistenciasMes: 0 };
        }

        this.cdr.detectChanges();
      },
      error: () => this.toast.error('Error al cargar perfil')
    });
  }

  async onFotoChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const fotoComprimida = await this.redimensionarImagen(file);
      this.perfil.fotoUrl = fotoComprimida;
      this.cdr.detectChanges();

      this.authService.actualizarPerfil(this.perfil._id, { fotoUrl: fotoComprimida })
        .pipe(takeUntil(this.destroy$)).subscribe({
        next: (res: any) => {
          this.userStateService.updateUser(res.usuario || res);
        },
        error: () => this.toast.error('No se pudo guardar la foto. Verifica tu conexión.')
      });
    } catch {
      this.toast.error('Error al procesar la imagen.');
    }
  }

  private redimensionarImagen(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event: any) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        // Si el archivo no es una imagen válida/decodificable, no dejar la promesa colgada
        img.onerror = () => reject(new Error('Imagen inválida'));
        img.src = event.target.result;
      };
      reader.onerror = error => reject(error);
    });
  }

  guardar() {
    if (!this.perfil?._id) return;
    this.cargando = true;

    const datosAEditar = {
      nombre: this.perfil.nombre,
      fotoUrl: this.perfil.fotoUrl,
      datosPersonales: this.perfil.datosPersonales,
      mensajeMotivador: this.perfil.mensajeMotivador
    };

    this.authService.actualizarPerfil(this.perfil._id, datosAEditar)
      .pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        this.cargando = false;
        this.userStateService.updateUser(res.usuario || res);
        this.toast.success('¡Datos actualizados con éxito!');
        this.router.navigate(['/socio/perfil']);
      },
      error: () => {
        this.cargando = false;
        this.toast.error('Error al guardar los datos');
      }
    });
  }
}
