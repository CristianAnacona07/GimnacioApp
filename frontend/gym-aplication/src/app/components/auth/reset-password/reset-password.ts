import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPassword implements OnInit {
  nuevaPassword = '';
  confirmarPassword = '';
  verPass = false;
  verConfirm = false;
  cargando = false;
  token = '';
  listo = false;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) this.router.navigate(['/login']);
  }

  get contrasenasCoinciden(): boolean {
    return this.nuevaPassword === this.confirmarPassword;
  }

  get formularioValido(): boolean {
    return this.nuevaPassword.length >= 8 && this.contrasenasCoinciden;
  }

  restablecer() {
    if (!this.formularioValido || this.cargando) return;
    this.cargando = true;

    this.http.post(`${environment.apiUrl}/api/auth/reset-password`, {
      token: this.token,
      nuevaPassword: this.nuevaPassword
    }).subscribe({
      next: () => {
        this.cargando = false;
        this.listo = true;
        this.cdr.detectChanges();
        setTimeout(() => this.router.navigate(['/login']), 3000);
      },
      error: (err) => {
        this.cargando = false;
        this.toast.error(err.error?.mensaje || 'El enlace es inválido o ya expiró');
        this.cdr.detectChanges();
      }
    });
  }
}
