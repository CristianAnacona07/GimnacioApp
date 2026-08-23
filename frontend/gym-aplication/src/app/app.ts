import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Notification } from './components/shared/notification/notification';
import { Cronometro } from './components/shared/cronometro/cronometro';
import { UserStateService } from './services/user-state.service';
import { UpdateService } from './services/update.service';
import { ThemeService } from './services/theme.service';
import { GymService } from './services/gym.service';
import { TokenMonitorService } from './services/token-monitor.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Notification, Cronometro, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  userState = inject(UserStateService);
  gymService = inject(GymService);
  private _update = inject(UpdateService);
  private theme = inject(ThemeService);
  private router = inject(Router);
  private tokenMonitor = inject(TokenMonitorService);

  /** La página pública del gimnasio se muestra sola: sin cronómetro. */
  esPaginaPublica() {
    return this.router.url.startsWith('/g/');
  }

  ngOnInit() {
    this.theme.aplicar();

    // Iniciar monitoreo de expiración de token
    this.tokenMonitor.startMonitoring();

    // Refresca gym desde el server para que módulos y colores estén siempre actualizados
    const gym = this.gymService.getGym();
    if (gym?.slug) {
      this.gymService.getBySlug(gym.slug).subscribe({
        next: (gymFresh) => {
          this.gymService.guardarGym(gymFresh);
          this.theme.aplicar(gymFresh);
        },
        error: (err) => {
          console.warn('No se pudo refrescar el gimnasio. Usando datos en caché.', err);
        }
      });
    }
  }
}
