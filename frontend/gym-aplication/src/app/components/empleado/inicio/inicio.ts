import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { UserStateService } from '../../../services/user-state.service';

const NOMBRE_CARGO: Record<string, string> = {
  recepcionista: 'Recepcionista',
  limpieza: 'Limpieza / Mantenimiento',
  nutricionista: 'Nutricionista',
};

/**
 * Portada de la zona de empleados. El recepcionista pasa directo a Recepción
 * (es su única pantalla de trabajo); los demás cargos ven la bienvenida.
 */
@Component({
  selector: 'app-empleado-inicio',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="inicio">
      <span class="inicio-icono">🧑‍💼</span>
      <h2 class="inicio-titulo">Hola, {{ nombre }}</h2>
      <p class="inicio-cargo">{{ cargo }}</p>
      <p class="inicio-texto">
        Tu cuenta de empleado está activa. Si necesitás acceso a más funciones,
        pedíselo al administrador del gimnasio.
      </p>
    </div>
  `,
  styles: [`
    .inicio {
      max-width: 420px;
      margin: 3rem auto;
      background: #fff;
      border-radius: 1.5rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.09);
      border: 1px solid #e2e8f0;
      padding: 2.5rem 1.5rem;
      text-align: center;
    }
    .inicio-icono { font-size: 3rem; display: block; margin-bottom: 0.75rem; }
    .inicio-titulo { font-size: 1.3rem; font-weight: 800; color: #1e293b; margin: 0; }
    .inicio-cargo {
      font-size: 0.8rem;
      font-weight: 800;
      color: var(--color-secundario, #1d4ed8);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 0.35rem 0 1rem;
    }
    .inicio-texto { font-size: 0.85rem; color: #64748b; margin: 0; }
  `],
})
export class EmpleadoInicio implements OnInit {
  private userState = inject(UserStateService);
  private router = inject(Router);

  nombre = '';
  cargo = '';

  ngOnInit() {
    const user = this.userState.getCurrentUser();
    this.nombre = user?.nombre || localStorage.getItem('nombre') || 'Empleado';
    const cargo = user?.cargo || '';
    this.cargo = NOMBRE_CARGO[cargo] || 'Empleado';
    // El recepcionista no tiene nada que hacer aquí: su pantalla es Recepción.
    if (cargo === 'recepcionista') this.router.navigate(['/empleado/recepcion']);
  }
}
