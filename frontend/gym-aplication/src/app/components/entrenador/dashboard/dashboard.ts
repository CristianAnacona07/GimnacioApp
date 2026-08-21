import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterModule } from '@angular/router';

import { AuthService } from '../../../services/auth';
import { GymService } from '../../../services/gym.service';
import { ThemeService } from '../../../services/theme.service';
import { PermisosService } from '../../../services/permisos.service';

@Component({
  selector: 'app-entrenador-dashboard',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntrenadorDashboard implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private gymService = inject(GymService);
  private theme = inject(ThemeService);
  private permisos = inject(PermisosService);

  username = '';

  /**
   * El menú se arma con lo que el admin le habilitó a esta cuenta, no con una
   * lista fija: dos gimnasios pueden querer entrenadores muy distintos.
   *
   * "Mis socios" y "Mi agenda" no se reparten — son lo suyo, no una sección
   * del gimnasio a la que se le da o se le quita acceso.
   */
  get enlaces() {
    const modulo = (m: Parameters<typeof this.gymService.moduloActivo>[0]) =>
      this.gymService.moduloActivo(m);

    return [
      { icono: '🎯', texto: 'Mis socios', ruta: '/entrenador/mis-socios', ver: true },
      { icono: '👥', texto: 'Socios',     ruta: '/entrenador/socios',     ver: this.permisos.puede('socios') },
      { icono: '📋', texto: 'Rutinas',    ruta: '/entrenador/rutinas',    ver: this.permisos.puede('rutinas') && modulo('rutinas') },
      { icono: '📰', texto: 'Noticias',   ruta: '/entrenador/noticias',   ver: this.permisos.puede('noticias') && modulo('noticias') },
      { icono: '💳', texto: 'Planes',     ruta: '/entrenador/planes',     ver: this.permisos.puede('planes') && modulo('pagos') },
      { icono: '💰', texto: 'Pagos',      ruta: '/entrenador/pagos',      ver: this.permisos.puede('pagos') && modulo('pagos') },
      { icono: '🧑‍💼', texto: 'Empleados', ruta: '/entrenador/empleados',  ver: this.permisos.puede('empleados') },
      { icono: '📅', texto: 'Mi agenda',  ruta: '/entrenador/agenda',     ver: true },
    ].filter(e => e.ver);
  }

  get esOscuro(): boolean { return this.theme.modo === 'oscuro'; }
  alternarTema(): void { this.theme.alternarModo(); }

  ngOnInit() {
    this.username = localStorage.getItem('nombre') || 'Entrenador';
  }

  logout() {
    this.authService.logout();
    this.router.navigateByUrl(this.gymService.rutaSalida());
  }
}
