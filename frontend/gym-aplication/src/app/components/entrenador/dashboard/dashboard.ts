import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';

import { Navbar } from '../../shared/navbar/navbar';

/**
 * Armazón de la zona del entrenador. Es el mismo que el del admin y el del
 * socio: la barra lateral compartida arma su propio menú según el rol y los
 * permisos, y también se encarga de la salida y del modo claro/oscuro.
 */
@Component({
  selector: 'app-entrenador-dashboard',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, Navbar],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntrenadorDashboard implements OnInit {
  username = '';

  ngOnInit() {
    this.username = localStorage.getItem('nombre') || 'Entrenador';
  }
}
