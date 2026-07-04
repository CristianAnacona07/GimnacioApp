import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-entrenador-dashboard',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntrenadorDashboard implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);

  username = '';

  ngOnInit() {
    this.username = localStorage.getItem('nombre') || 'Entrenador';
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
