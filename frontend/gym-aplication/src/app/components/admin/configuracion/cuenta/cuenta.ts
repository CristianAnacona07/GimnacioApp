import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ConfiguracionService } from '../../../../services/configuracion.service';
import { UserStateService } from '../../../../services/user-state.service';
import { ToastService } from '../../../../services/toast.service';

/** Perfil del administrador, cambio de contraseña y verificación en dos pasos. */
@Component({
  selector: 'app-configuracion-cuenta',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cuenta.html',
  styleUrl: '../configuracion.css'
})
export class ConfiguracionCuenta implements OnInit {
  private config = inject(ConfiguracionService);
  private userState = inject(UserStateService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  admin: any = null;
  nombre = '';
  guardandoPerfil = false;

  // Contraseña
  actual = '';
  nueva = '';
  repetir = '';
  cambiandoPass = false;

  // 2FA: el flujo es setup → escanear → confirmar código → códigos de respaldo.
  secreto: string | null = null;
  otpauth: string | null = null;
  codigo2fa = '';
  procesando2fa = false;
  backupCodes: string[] | null = null;

  ngOnInit(): void {
    this.admin = this.userState.getCurrentUser();
    this.nombre = this.admin?.nombre || '';
  }

  guardarPerfil(): void {
    const nombre = this.nombre.trim();
    if (!nombre) {
      this.toast.error('El nombre no puede quedar vacío');
      return;
    }
    if (!this.admin?._id || this.guardandoPerfil) return;

    this.guardandoPerfil = true;
    this.config.actualizarPerfil(this.admin._id, { nombre }).subscribe({
      next: () => {
        this.guardandoPerfil = false;
        // Refleja el nombre nuevo en la sesión sin obligar a volver a entrar.
        localStorage.setItem('nombre', nombre);
        this.toast.success('Perfil actualizado');
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

  iniciar2fa(): void {
    if (this.procesando2fa) return;
    this.procesando2fa = true;
    this.config.iniciar2fa().subscribe({
      next: (res) => {
        this.procesando2fa = false;
        this.secreto = res.secret;
        this.otpauth = res.otpauth;
        this.cdr.detectChanges();
      },
      error: () => {
        this.procesando2fa = false;
        this.toast.error('No se pudo iniciar la verificación en dos pasos');
        this.cdr.detectChanges();
      }
    });
  }

  activar2fa(): void {
    if (this.procesando2fa || !this.codigo2fa.trim()) return;
    this.procesando2fa = true;
    this.config.activar2fa(this.codigo2fa.trim()).subscribe({
      next: (res) => {
        this.procesando2fa = false;
        // Los códigos de respaldo se muestran una única vez: el servidor solo
        // guarda su hash y no puede volver a enseñarlos.
        this.backupCodes = res.backupCodes;
        this.secreto = this.otpauth = null;
        this.codigo2fa = '';
        this.toast.success('Verificación en dos pasos activada');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.procesando2fa = false;
        this.toast.error(err?.error?.mensaje || 'Código inválido');
        this.cdr.detectChanges();
      }
    });
  }

  desactivar2fa(): void {
    if (this.procesando2fa || !this.codigo2fa.trim()) return;
    this.procesando2fa = true;
    this.config.desactivar2fa(this.codigo2fa.trim()).subscribe({
      next: () => {
        this.procesando2fa = false;
        this.codigo2fa = '';
        this.backupCodes = null;
        this.toast.success('Verificación en dos pasos desactivada');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.procesando2fa = false;
        this.toast.error(err?.error?.mensaje || 'No se pudo desactivar');
        this.cdr.detectChanges();
      }
    });
  }
}
