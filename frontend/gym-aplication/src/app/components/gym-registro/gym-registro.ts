import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../services/toast.service';
import { GymService } from '../../services/gym.service';
import { ThemeService } from '../../services/theme.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-gym-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './gym-registro.html',
  styleUrl: './gym-registro.css'
})
export class GymRegistro {
  paso = 1; // 1 = datos del gym, 2 = cuenta admin
  guardando = false;

  gym = {
    nombre: '',
    slug: '',
    slogan: '',
    logo: null as string | null,
    colores: {
      primario:   '#f97316',
      secundario: '#1d4ed8',
      fondo:      '#eef3ff',
      navbar:     '#0f172a'
    }
  };

  admin = {
    nombre: '',
    email: '',
    password: '',
    confirmar: ''
  };

  constructor(
    private http: HttpClient,
    private toast: ToastService,
    private gymService: GymService,
    private themeService: ThemeService,
    private router: Router
  ) {}

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
        canvas.width  = img.width  * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        this.gym.logo = canvas.toDataURL('image/jpeg', 0.85);
      };
    };
  }

  generarSlug() {
    this.gym.slug = this.gym.nombre
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  paso1Valido(): boolean {
    return this.gym.nombre.length >= 3 && this.gym.slug.length >= 3;
  }

  paso2Valido(): boolean {
    return (
      this.admin.nombre.length >= 2 &&
      this.admin.email.includes('@') &&
      this.admin.password.length >= 8 &&
      this.admin.password === this.admin.confirmar
    );
  }

  siguiente() {
    if (this.paso1Valido()) this.paso = 2;
  }

  async registrar() {
    if (!this.paso2Valido() || this.guardando) return;
    this.guardando = true;

    try {
      // 1. Crear el gym
      const gymCreado: any = await this.http
        .post(`${environment.apiUrl}/api/gym/crear`, this.gym)
        .toPromise();

      // 2. Crear el admin vinculado al gym
      await this.http.post(`${environment.apiUrl}/api/auth/register`, {
        nombre: this.admin.nombre,
        email: this.admin.email,
        password: this.admin.password,
        role: 'admin',
        gymId: gymCreado._id
      }).toPromise();

      // 3. Guardar gym y aplicar tema
      this.gymService.guardarGym(gymCreado);
      this.themeService.aplicar(gymCreado);

      this.toast.success('¡Gimnasio registrado con éxito! Ya podés iniciar sesión.');
      this.router.navigate(['/login']);

    } catch (err: any) {
      const msg = err?.error?.error || 'Error al registrar el gimnasio.';
      this.toast.error(msg);
    } finally {
      this.guardando = false;
    }
  }
}
