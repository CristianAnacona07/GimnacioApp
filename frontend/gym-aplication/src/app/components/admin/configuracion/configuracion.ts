import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { UserStateService } from '../../../services/user-state.service';
import { GymService, Gym } from '../../../services/gym.service';
import { AuthService } from '../../../services/auth';
import { SedeService } from '../../../services/sede.service';

/**
 * Índice de la configuración del gimnasio: solo enlaza a las secciones.
 * Cada una vive en su propia ruta perezosa, de modo que añadir una función
 * nueva sea agregar una tarjeta aquí y un componente aparte.
 */
@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.css'
})
export class Configuracion implements OnInit {
  private sedeService = inject(SedeService);

  /** Fuera de la matriz la configuración se muestra, pero no se toca. */
  get enLaMatriz(): boolean { return this.sedeService.enLaMatriz; }
  get sedeActual(): string { return this.sedeService.nombreActiva; }
  get nombreMatriz(): string { return this.sedeService.matriz?.nombre || 'la sede principal'; }

  private userState = inject(UserStateService);
  private gymService = inject(GymService);
  private authService = inject(AuthService);
  private router = inject(Router);

  admin: any = null;
  gym: Gym | null = null;

  readonly secciones = [
    {
      icono: '🏢',
      nombre: 'Datos del gimnasio',
      desc: 'Nombre, logo, colores y qué módulos ve el socio',
      ruta: '/admin/configuracion/gimnasio'
    },
    {
      icono: '🏬',
      nombre: 'Sedes',
      desc: 'Los locales del gimnasio, si tenés más de uno',
      ruta: '/admin/configuracion/sedes'
    },
    {
      icono: '📅',
      nombre: 'Sesiones personalizadas',
      desc: 'Duración, precio y quién atiende las citas uno a uno',
      ruta: '/admin/configuracion/agenda'
    },
    {
      icono: '🌐',
      nombre: 'Página web',
      desc: 'La página pública que ve quien todavía no es socio',
      ruta: '/admin/configuracion/pagina'
    },
    {
      icono: '🚪',
      nombre: 'Control de acceso',
      desc: 'Lectores de huella y torniquetes',
      ruta: '/admin/configuracion/acceso'
    },
    {
      icono: '📊',
      nombre: 'Datos y respaldo',
      desc: 'Exportar a Excel e importar socios',
      ruta: '/admin/configuracion/datos'
    },
    {
      icono: '🛡️',
      nombre: 'Auditoría',
      desc: 'Quién hizo qué y cuándo',
      ruta: '/admin/configuracion/auditoria'
    },
    {
      icono: '💬',
      nombre: 'Sugerencias de los socios',
      desc: 'Lo que tus socios escribieron sobre el gimnasio',
      ruta: '/admin/configuracion/sugerencias'
    }
  ];

  ngOnInit(): void {
    this.admin = this.userState.getCurrentUser();
    this.gym = this.gymService.getGym();
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigateByUrl(this.gymService.rutaSalida());
  }
}
