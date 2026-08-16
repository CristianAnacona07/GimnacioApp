import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../environments/environment';
import { GymService, Gym } from '../../../services/gym.service';
import { ThemeService } from '../../../services/theme.service';

/**
 * Destino del link o QR de invitación que el gimnasio le manda a un socio nuevo.
 *
 * Valida el token contra el servidor; si está vigente, fija el gimnasio (marca
 * y colores), guarda el token para que el registro lo consuma y pasa a
 * /register. Si no, lo dice claramente — sin invitación no hay registro.
 */
@Component({
  selector: 'app-registro-invitacion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pantalla">
      @if (validando) {
        <span class="spinner"></span>
        <p class="texto">Verificando tu invitación…</p>
      } @else {
        <span class="icono">⏳</span>
        <h2 class="titulo">Esta invitación ya no sirve</h2>
        <p class="texto">{{ motivo }}</p>
        <p class="texto texto--suave">
          Pedile al gimnasio que te mande una nueva: cada enlace funciona una
          sola vez y vence a las 48 horas.
        </p>
        <button class="boton" (click)="irAlLogin()">Ir a iniciar sesión</button>
      }
    </div>
  `,
  styles: [`
    .pantalla {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.8rem;
      padding: 2rem 1.25rem;
      text-align: center;
      background: var(--color-fondo, #eef3ff);
    }
    .spinner {
      width: 34px; height: 34px;
      border: 3px solid var(--bde, #c8dcff);
      border-top-color: var(--color-secundario, #1d4ed8);
      border-radius: 50%;
      animation: girar 0.8s linear infinite;
    }
    @keyframes girar { to { transform: rotate(360deg); } }
    .icono { font-size: 2.6rem; }
    .titulo { font-size: 1.15rem; font-weight: 800; color: var(--txt-1, #1e293b); margin: 0; }
    .texto { font-size: 0.9rem; color: var(--txt-2, #475569); margin: 0; max-width: 340px; }
    .texto--suave { font-size: 0.8rem; color: var(--txt-3, #94a3b8); }
    .boton {
      margin-top: 0.8rem;
      background: var(--color-secundario, #1d4ed8);
      color: #fff;
      border: none;
      border-radius: 999px;
      padding: 0.7rem 1.6rem;
      font-size: 0.85rem;
      font-weight: 800;
      cursor: pointer;
    }
  `]
})
export class RegistroInvitacion implements OnInit {
  private ruta = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private gymService = inject(GymService);
  private theme = inject(ThemeService);

  validando = true;
  motivo = '';

  ngOnInit(): void {
    const token = this.ruta.snapshot.paramMap.get('token') || '';
    this.http.get<{ gym: Gym }>(`${environment.apiUrl}/api/invitaciones/${token}`).subscribe({
      next: (res) => {
        // El gimnasio de la invitación queda fijado: el registro se pinta con
        // su marca y la cuenta nueva nace en él.
        this.gymService.guardarGym(res.gym);
        this.theme.aplicar(res.gym);
        sessionStorage.setItem('invitacionToken', token);
        this.router.navigate(['/register']);
      },
      error: (err) => {
        this.validando = false;
        this.motivo = err.error?.mensaje || 'La invitación no existe, ya fue usada o venció.';
      }
    });
  }

  irAlLogin(): void { this.router.navigate(['/login']); }
}
