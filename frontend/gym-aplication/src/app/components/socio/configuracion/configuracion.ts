import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { UserStateService } from '../../../services/user-state.service';
import { GymService } from '../../../services/gym.service';
import { HuellaService, MotivoNoDisponible } from '../../../services/huella.service';
import { ToastService } from '../../../services/toast.service';

/**
 * Índice de la cuenta del socio: sus pantallas y sus ajustes.
 *
 * Existe por lo mismo que el hub del administrador: el menú lateral se estaba
 * llenando de cosas que no son "ir a una sección del gimnasio" sino "lo mío"
 * — el perfil, y ahora el ingreso con huella. Agrupadas acá, el menú queda con
 * las secciones del gimnasio y esto crece sin ensuciarlo.
 *
 * Los datos del socio no se piden: ya los trajo el navbar y los dejó en
 * UserStateService, así que la pantalla abre instantánea.
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
  private huellaService = inject(HuellaService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();

  socio: any = null;
  gym: any = null;

  // ── Ingreso con huella ──────────────────────────────────────────────────
  huellaPuede = false;
  huellaActiva = false;
  huellaMotivo: MotivoNoDisponible | null = null;
  huellaOcupada = false;

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

    this.revisarHuella();
  }

  private async revisarHuella(): Promise<void> {
    const { puede, motivo } = await this.huellaService.disponible();
    this.huellaPuede = puede;
    this.huellaMotivo = motivo ?? null;
    this.huellaActiva = this.huellaService.activada(this.userState.getUserId());
    this.cdr.markForCheck();
  }

  /** Lo que se le explica al socio cuando su teléfono no puede. */
  get huellaExplicacion(): string {
    switch (this.huellaMotivo) {
      case 'web':
        return 'Esto funciona en la app instalada en tu celular, no en el navegador.';
      case 'sin-huellas':
        return 'Tu celular tiene lector, pero todavía no registraste ninguna huella. Configurala en los ajustes del teléfono y volvé.';
      case 'sin-sensor':
        return 'Este celular no tiene lector de huella.';
      default:
        return 'No se pudo comprobar si este celular tiene lector de huella.';
    }
  }

  async alternarHuella(): Promise<void> {
    if (this.huellaOcupada) return;
    this.huellaOcupada = true;
    this.cdr.markForCheck();

    try {
      if (this.huellaActiva) {
        await this.huellaService.desactivar();
        this.huellaActiva = false;
        this.toast.success('Este celular ya no entra con tu huella');
      } else {
        const usuarioId = this.userState.getUserId();
        if (!usuarioId) throw new Error('sin usuario');
        await this.huellaService.activar(usuarioId, this.nombreDelAparato());
        this.huellaActiva = true;
        this.toast.success('Listo: la próxima vez entrás con tu huella');
      }
    } catch (e: any) {
      // Cancelar la huella no es un error que haya que gritarle a nadie.
      const cancelado = /cancel|user_cancel|13|10/i.test(String(e?.message || e?.code || ''));
      if (!cancelado) {
        this.toast.error(this.huellaActiva
          ? 'No se pudo desactivar. Probá de nuevo.'
          : 'No se pudo activar el ingreso con huella. Probá de nuevo.');
      }
      // El estado real manda: si algo quedó a medias, que se vea como está.
      this.huellaActiva = this.huellaService.activada(this.userState.getUserId());
    } finally {
      this.huellaOcupada = false;
      this.cdr.markForCheck();
    }
  }

  /** Para que el socio distinga cuál celular es, si vincula más de uno. */
  private nombreDelAparato(): string {
    const ua = navigator.userAgent || '';
    const modelo = ua.match(/Android[^;]*;\s*([^)]+?)\s*(?:Build|\))/i)?.[1];
    return (modelo || 'Mi celular').slice(0, 120);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
