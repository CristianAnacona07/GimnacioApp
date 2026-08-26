import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../services/toast.service';
import { StorageService } from '../../../services/storage.service';
import { AuthService } from '../../../services/auth';
import { GymService, Gym } from '../../../services/gym.service';
import { textoTerminos, textoPrivacidad, NOMBRE_APP_RESPALDO } from '../../../data/legal-textos';

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
  nuevaPassword = '';
  confirmarPassword = '';
  verNueva = false;
  verConfirm = false;
  cargando = false;
  aceptaTerminos = false;
  aceptaPrivacidad = false;
  mostrarTerminos = false;
  mostrarPrivacidad = false;

  readonly nombre = localStorage.getItem('nombre') || '';
  /** Gimnasio en uso: la cabecera muestra su logo, no el de la plataforma. */
  gym: Gym | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private toast: ToastService,
    private storageService: StorageService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private gymService: GymService
  ) {
    this.gym = this.gymService.getGym();
  }

  get contrasenasCoinciden(): boolean {
    return this.nuevaPassword === this.confirmarPassword;
  }

  get formularioValido(): boolean {
    return this.nuevaPassword.length >= 8
      && this.contrasenasCoinciden
      && this.aceptaTerminos
      && this.aceptaPrivacidad;
  }

  get terminosTexto(): string {
    return textoTerminos(this.gym?.nombre || NOMBRE_APP_RESPALDO);
  }

  get privacidadTexto(): string {
    return textoPrivacidad(this.gym?.nombre || NOMBRE_APP_RESPALDO);
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

    // Ruta propia del primer ingreso: no pide la temporal porque se acaba
    // de usar en el login para llegar hasta acá. El servidor comprueba que
    // la nueva sea distinta comparando contra el hash.
    this.http.put(`${environment.apiUrl}/api/auth/cambiar-password-inicial`, {
      nueva: this.nuevaPassword
    }).subscribe({
      next: () => {
        this.storageService.setDebeCambiarPassword(false);
        // Se sella la aceptación que la persona acaba de marcar. No bloquea
        // la entrada si falla: dejar a alguien afuera del gimnasio por no
        // poder registrar la constancia sería peor, y el sello se reintenta
        // solo la próxima vez que pase por acá.
        this.auth.aceptarTerminos().subscribe({
          error: (err) => console.warn('No se pudo registrar la aceptación de términos', err)
        });
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
