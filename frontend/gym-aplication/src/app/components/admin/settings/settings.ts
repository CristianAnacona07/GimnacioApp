import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { UserStateService } from '../../../services/user-state.service';
import { AuthService } from '../../../services/auth';
import { GymService, Gym } from '../../../services/gym.service';
import { ToastService } from '../../../services/toast.service';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings implements OnInit {
  admin: any = null;
  gym: Gym | null = null;
  guardando = false;

  constructor(
    private userState: UserStateService,
    private authService: AuthService,
    private gymService: GymService,
    private toast: ToastService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    this.admin = this.userState.getCurrentUser();
    this.gym = this.gymService.getGym();
  }

  onLogoChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e: any) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 200;
        const scale = MAX / Math.max(img.width, img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        this.gym!.logo = canvas.toDataURL('image/jpeg', 0.85);
        this.cdr.detectChanges();
      };
    };
  }

  guardarLogo() {
    if (!this.gym?._id || this.guardando) return;
    this.guardando = true;
    this.http.put(`${environment.apiUrl}/api/gym/${this.gym._id}/configuracion`, {
      nombre: this.gym.nombre,
      logo: this.gym.logo,
      slogan: this.gym.slogan,
      colores: this.gym.colores,
      modulos: this.gym.modulos
    }).subscribe({
      next: (gymActualizado: any) => {
        this.gymService.guardarGym(gymActualizado);
        this.gym = gymActualizado;
        this.guardando = false;
        this.toast.success('Logo actualizado');
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.error('Error al guardar');
        this.guardando = false;
      }
    });
  }

  cerrarSesion() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
