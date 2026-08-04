import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { UserStateService } from '../../services/user-state.service';
import { CATALOGO_EJERCICIOS } from '../../../data/ejercicios-catalogo';

@Component({
  selector: 'app-ejercicio-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ejercicio-detalle.html',
  styleUrl: './ejercicio-detalle.css',
})
export class EjercicioDetalle implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private userStateService = inject(UserStateService);

  ejercicio: any = null;
  role = '';

  ngOnInit() {
    this.role = this.userStateService.getRole()?.toLowerCase().trim() || 'socio';

    const nombreEj = this.route.snapshot.paramMap.get('nombre');
    if (nombreEj) {
      this.ejercicio = CATALOGO_EJERCICIOS.find(
        e => e.nombre.toLowerCase() === nombreEj.toLowerCase()
      );
    }
  }

  volver() {
    if (this.role === 'admin') {
      this.router.navigate(['/admin/rutinas']);
    } else {
      this.router.navigate(['/socio/mi-rutina']);
    }
  }
}
