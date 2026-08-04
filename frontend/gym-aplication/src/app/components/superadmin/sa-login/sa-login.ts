import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { ToastService } from '../../../services/toast.service';
import { StorageService } from '../../../services/storage.service';

@Component({
  selector: 'app-sa-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sa-login.html',
  styleUrl: './sa-login.css'
})
export class SaLogin {
  email = '';
  password = '';
  cargando = false;
  verPass = false;

  constructor(
    private auth: AuthService,
    private toast: ToastService,
    private router: Router,
    private storageService: StorageService
  ) {}

  entrar() {
    if (!this.email || !this.password || this.cargando) return;
    this.cargando = true;

    this.auth.login({ email: this.email, password: this.password, gymId: null }).subscribe({
      next: (res: any) => {
        const role = res.usuario.role?.toLowerCase().trim();
        if (role !== 'superadmin') {
          this.toast.error('Acceso no autorizado');
          this.cargando = false;
          return;
        }
        this.storageService.clearSessionPreservingData();
        localStorage.setItem('token', res.token);
        localStorage.setItem('role', role);
        localStorage.setItem('userId', res.usuario._id);
        localStorage.setItem('nombre', res.usuario.nombre);
        localStorage.setItem('usuario', JSON.stringify(res.usuario));
        this.router.navigate(['/plataforma']);
      },
      error: () => {
        this.toast.error('Credenciales incorrectas');
        this.cargando = false;
      }
    });
  }
}
