import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SelectorFoto } from '../../../shared/selector-foto/selector-foto';
import { ConfiguracionService } from '../../../../services/configuracion.service';
import { AuthService } from '../../../../services/auth';
import { UserStateService } from '../../../../services/user-state.service';
import { ToastService } from '../../../../services/toast.service';

/** Datos del administrador (foto, nombre, cédula, teléfono) y su contraseña. */
@Component({
  selector: 'app-configuracion-cuenta',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SelectorFoto],
  templateUrl: './cuenta.html',
  styleUrl: '../configuracion.css'
})
export class ConfiguracionCuenta implements OnInit {
  private config = inject(ConfiguracionService);
  private auth = inject(AuthService);
  private userState = inject(UserStateService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  admin: any = null;
  nombre = '';
  identificacion = '';
  telefono = '';
  fotoUrl = '';
  guardandoPerfil = false;

  /**
   * Copia de lo que hay guardado, para saber si de verdad cambió algo. Sin
   * esto el botón invita a guardar aunque no se haya tocado nada.
   */
  private guardado = { nombre: '', identificacion: '', telefono: '', fotoUrl: '' };

  get hayCambios(): boolean {
    return this.nombre.trim() !== this.guardado.nombre
      || this.identificacion.trim() !== this.guardado.identificacion
      || this.telefono.trim() !== this.guardado.telefono
      || this.fotoUrl !== this.guardado.fotoUrl;
  }

  /** Fija el punto de comparación: al cargar y después de guardar bien. */
  private marcarGuardado(): void {
    this.guardado = {
      nombre: this.nombre.trim(),
      identificacion: this.identificacion.trim(),
      telefono: this.telefono.trim(),
      fotoUrl: this.fotoUrl
    };
  }

  // Contraseña
  actual = '';
  nueva = '';
  repetir = '';
  cambiandoPass = false;


  ngOnInit(): void {
    this.admin = this.userState.getCurrentUser();
    this.nombre = this.admin?.nombre || '';
    this.fotoUrl = this.admin?.fotoUrl || '';
    this.marcarGuardado();
    // La sesión guarda lo justo para la navbar; la cédula y el teléfono hay
    // que pedirlos, o los campos abrirían vacíos y guardar los borraría.
    if (this.admin?._id) {
      this.auth.getPerfilUsuario(this.admin._id).subscribe({
        next: (perfil: any) => {
          this.nombre = perfil?.nombre || this.nombre;
          this.fotoUrl = perfil?.fotoUrl || '';
          this.identificacion = perfil?.datosPersonales?.identificacion || '';
          this.telefono = perfil?.datosPersonales?.telefono || '';
          this.marcarGuardado();
          this.cdr.detectChanges();
        },
        error: () => {}
      });
    }
  }

  /** Reduce a 200 px y la deja lista para guardar, venga de donde venga. */
  usarFoto(dataUrl: string): void {
    const img = new Image();
    img.onload = () => {
      const lienzo = document.createElement('canvas');
      const MAX = 200;
      const escala = Math.min(1, MAX / Math.max(img.width, img.height));
      lienzo.width = Math.round(img.width * escala);
      lienzo.height = Math.round(img.height * escala);
      lienzo.getContext('2d')?.drawImage(img, 0, 0, lienzo.width, lienzo.height);
      this.fotoUrl = lienzo.toDataURL('image/jpeg', 0.85);
      this.cdr.detectChanges();
    };
    img.src = dataUrl;
  }

  guardarPerfil(): void {
    const nombre = this.nombre.trim();
    if (!nombre) {
      this.toast.error('El nombre no puede quedar vacío');
      return;
    }
    if (!this.admin?._id || this.guardandoPerfil) return;

    this.guardandoPerfil = true;
    this.auth.actualizarPerfil(this.admin._id, {
      nombre,
      fotoUrl: this.fotoUrl,
      datosPersonales: {
        identificacion: this.identificacion.trim(),
        telefono: this.telefono.trim()
      }
    }).subscribe({
      next: () => {
        this.guardandoPerfil = false;
        // Refleja los datos nuevos en la sesión sin obligar a volver a entrar.
        localStorage.setItem('nombre', nombre);
        this.userState.updateUser({ nombre, fotoUrl: this.fotoUrl });
        this.marcarGuardado();
        this.toast.success('Datos actualizados');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.guardandoPerfil = false;
        this.toast.error(err?.error?.mensaje || 'No se pudo actualizar el perfil');
        this.cdr.detectChanges();
      }
    });
  }

  cambiarPassword(): void {
    if (this.cambiandoPass) return;
    if (this.nueva !== this.repetir) {
      this.toast.error('La nueva contraseña y su repetición no coinciden');
      return;
    }
    if (this.nueva.length < 8) {
      this.toast.error('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    this.cambiandoPass = true;
    this.config.cambiarPassword(this.actual, this.nueva).subscribe({
      next: () => {
        this.cambiandoPass = false;
        this.actual = this.nueva = this.repetir = '';
        this.toast.success('Contraseña actualizada');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cambiandoPass = false;
        this.toast.error(err?.error?.mensaje || 'No se pudo cambiar la contraseña');
        this.cdr.detectChanges();
      }
    });
  }

}
