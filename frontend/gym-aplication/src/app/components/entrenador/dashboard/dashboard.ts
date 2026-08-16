import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterModule } from '@angular/router';

import { AuthService } from '../../../services/auth';
import { GymService } from '../../../services/gym.service';
import { ThemeService } from '../../../services/theme.service';

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

  username = '';

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
