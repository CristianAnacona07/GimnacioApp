import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { UserStateService } from '../../../services/user-state.service';
import { GymService } from '../../../services/gym.service';

/**
 * Índice de la cuenta del socio: solo enlaza a sus pantallas.
 *
 * Existe por lo mismo que el hub del administrador: el menú lateral se estaba
 * llenando de cosas que no son "ir a una sección del gimnasio" sino "lo mío"
 * — el perfil, y lo que venga después (huella, notificaciones). Agrupadas acá,
 * el menú queda con las secciones del gimnasio y esto crece sin ensucharlo.
 *
 * No pide nada al servidor: los datos del socio ya los trae el navbar y los
 * deja en UserStateService, así que la pantalla abre instantánea.
 */
@Component({
  selector: 'app-socio-configuracion',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SocioConfiguracion implements OnInit, OnDestroy {
  private userState = inject(UserStateService);
  private gymService = inject(GymService);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();

  socio: any = null;
  gym: any = null;

  readonly secciones = [
    {
      icono: '👤',
      nombre: 'Perfil',
      desc: 'Tu carnet, el código QR de entrada y tus datos',
      ruta: '/socio/perfil'
    }
  ];

  ngOnInit(): void {
    this.socio = this.userState.getCurrentUser();
    this.gym = this.gymService.getGym();

    // El navbar carga el perfil en segundo plano; si llega después, la tarjeta
    // se completa sola en vez de quedarse con el nombre a medias.
    this.userState.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe(usuario => {
        if (!usuario) return;
        this.socio = usuario;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
