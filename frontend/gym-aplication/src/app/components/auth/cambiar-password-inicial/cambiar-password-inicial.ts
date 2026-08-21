import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../services/toast.service';
import { StorageService } from '../../../services/storage.service';
import { AuthService } from '../../../services/auth';

// Pantalla forzada para cuentas creadas con contraseña temporal (superadmin
// o recepción la generaron y se la entregaron en persona, sin correo de por
// medio — ver AuditoríaGymApp/plan "contraseña temporal"). El guard de rutas
// (guards/auth.ts) redirige acá a cualquier cuenta con
// `debeCambiarPassword` y no deja pasar a ninguna otra pantalla hasta que la
// cambie: por eso esta pantalla no tiene enlace de "volver" ni "omitir".
@Component({
  selector: 'app-cambiar-password-inicial',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cambiar-password-inicial.html',
  styleUrl: './cambiar-password-inicial.css'
})
export class CambiarPasswordInicial {
  passwordActual = '';
  nuevaPassword = '';
  confirmarPassword = '';
  verActual = false;
  verNueva = false;
  verConfirm = false;
  cargando = false;

  readonly nombre = localStorage.getItem('nombre') || '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private toast: ToastService,
    private storageService: StorageService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  get contrasenasCoinciden(): boolean {
    return this.nuevaPassword === this.confirmarPassword;
  }

  get formularioValido(): boolean {
    return !!this.passwordActual
      && this.nuevaPassword.length >= 8
      && this.nuevaPassword !== this.passwordActual
      && this.contrasenasCoinciden;
  }

  // --- Indicador de fuerza: puramente visual, no bloquea el envío (el único
  // requisito real son los 8 caracteres que ya exige formularioValido). ---
  get tiene8(): boolean { return this.nuevaPassword.length >= 8; }
  get tieneLetras(): boolean { return /[a-zA-Z]/.test(this.nuevaPassword); }
  get tieneNumeros(): boolean { return /[0-9]/.test(this.nuevaPassword); }

  get puntajeFuerza(): number {
    return [this.tiene8, this.tieneLetras, this.tieneNumeros].filter(Boolean).length;
  }

  get etiquetaFuerza(): string {
    if (!this.nuevaPassword) return '';
    return ['Débil', 'Débil', 'Regular', 'Fuerte'][this.puntajeFuerza];
  }

  guardar() {
    if (!this.formularioValido || this.cargando) return;
    this.cargando = true;

    this.http.put(`${environment.apiUrl}/api/auth/cambiar-password`, {
      actual: this.passwordActual,
      nueva: this.nuevaPassword
    }).subscribe({
      next: () => {
        this.storageService.setDebeCambiarPassword(false);
        this.toast.success('Contraseña actualizada');
        this.irAHome();
      },
      error: (err) => {
        this.cargando = false;
        this.toast.error(err.error?.mensaje || 'No se pudo cambiar la contraseña');
        this.cdr.detectChanges();
      }
    });
  }

  // Mismo mapeo de rol → home que login.ts guardarSesion(): la cuenta ya
  // quedó fijada al iniciar sesión, solo faltaba esta pantalla de por medio.
  private irAHome() {
    const role = (localStorage.getItem('role') || '').toLowerCase().trim();
    if (role === 'superadmin') this.router.navigate(['/plataforma']);
    else if (role === 'admin') this.router.navigate(['admin/noticias']);
    else if (role === 'empleado') this.router.navigate(['/empleado']);
    else this.router.navigate(['/socio']);
  }

  cerrarSesion() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
