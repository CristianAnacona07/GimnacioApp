import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import QRCode from 'qrcode';

import { AuthService } from '../../../services/auth';
import { UserStateService } from '../../../services/user-state.service';
import { ToastService } from '../../../services/toast.service';
import { GymService } from '../../../services/gym.service';
import { AsistenciaService } from '../../../services/asistencia.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Perfil implements OnInit, OnDestroy {
  perfil: any = null;
  diasRestantes = 0;

  // Mi acceso: código y QR
  codigoAcceso = '';
  qrDataUrl = '';
  cargandoCodigo = true;
  errorCodigo = false;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private userStateService: UserStateService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    public gymService: GymService,
    private asistenciaService: AsistenciaService
  ) {}

  ngOnInit() {
    const usuario = this.userStateService.getCurrentUser();
    if (usuario?._id) this.cargarPerfil(usuario._id);
    this.cargarMiCodigo();
  }

  cargarMiCodigo() {
    this.cargandoCodigo = true;
    this.errorCodigo = false;
    this.cdr.markForCheck();

    this.asistenciaService.miCodigo()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async (res) => {
          this.codigoAcceso = res?.codigoAcceso || '';
          if (!this.codigoAcceso) {
            this.errorCodigo = true;
            this.cargandoCodigo = false;
            this.cdr.markForCheck();
            return;
          }
          try {
            this.qrDataUrl = await QRCode.toDataURL(this.codigoAcceso, { width: 220, margin: 1 });
          } catch {
            this.errorCodigo = true;
          } finally {
            this.cargandoCodigo = false;
            this.cdr.markForCheck();
          }
        },
        error: () => {
          this.errorCodigo = true;
          this.cargandoCodigo = false;
          this.cdr.markForCheck();
        }
      });
  }

  cargarPerfil(id: string) {
    this.authService.getPerfilSocio(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: any) => {
          this.perfil = data;
          this.diasRestantes = data.cards?.vencimiento || 0;
          this.cdr.markForCheck();
        },
        error: () => this.toast.error('Error al cargar el perfil')
      });
  }

  actualizarFotoPerfil(nuevaFotoUrl: string) {
    if (!this.perfil) return;

    this.authService.actualizarPerfil(this.perfil._id, { fotoUrl: nuevaFotoUrl })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.perfil = res;
          this.userStateService.updateUser({ fotoUrl: res.fotoUrl });
          this.cdr.markForCheck();
          this.toast.success('¡Foto actualizada correctamente!');
        },
        error: (err) => {
          if (err.status === 413) {
            this.toast.error('La imagen es demasiado pesada para el servidor.');
          } else {
            this.toast.error('Error al actualizar la foto.');
          }
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
