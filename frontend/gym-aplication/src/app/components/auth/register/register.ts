import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { AuthService } from '../../../services/auth';
import { ToastService } from '../../../services/toast.service';
import { GymService, Gym } from '../../../services/gym.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register implements OnInit {
  nuevoUsuario = { nombre: '', email: '', password: '', confirmPassword: '', role: 'socio' };
  verPass = false;
  verConfirmPass = false;
  gym: Gym | null = null;

  constructor(
    private authService: AuthService,
    private toast: ToastService,
    private router: Router,
    private gymService: GymService
  ) {}

  /** Token de la invitación con la que se llegó; sin él no hay registro. */
  private invitacion: string | null = null;

  ngOnInit() {
    // Solo se llega aquí desde /invitacion/<token>, que valida el link, fija el
    // gimnasio y deja el token en sessionStorage. Entrar directo no sirve.
    this.invitacion = sessionStorage.getItem('invitacionToken');
    this.gym = this.gymService.getGym();
    if (!this.invitacion || !this.gym) {
      this.router.navigate(['/login']);
    }
  }

  esFormularioValido(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return (
      this.nuevoUsuario.nombre.length > 2 &&
      emailRegex.test(this.nuevoUsuario.email) &&
      this.nuevoUsuario.password.length >= 8 &&
      this.nuevoUsuario.password === this.nuevoUsuario.confirmPassword
    );
  }

  contrasenasCoinciden(): boolean {
    return this.nuevoUsuario.password === this.nuevoUsuario.confirmPassword;
  }

  registrar() {
    if (!this.esFormularioValido()) return;

    const usuarioAEnviar = {
      ...this.nuevoUsuario,
      role: 'socio',
      invitacion: this.invitacion
    };

    this.authService.registrar(usuarioAEnviar).subscribe({
      next: () => {
        sessionStorage.removeItem('invitacionToken');
        this.toast.success('¡Cuenta creada con éxito! Ahora puedes iniciar sesión.');
        this.router.navigate(['/login']);
      },
      error: (err: any) => {
        const msg = err.error?.mensaje || 'El correo ya está registrado o hubo un problema con el servidor.';
        this.toast.error(msg);
      }
    });
  }
}
