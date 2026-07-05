import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { AsistenciaService } from '../../../services/asistencia.service';
import { ToastService } from '../../../services/toast.service';

interface SocioBusqueda {
  _id: string;
  nombre: string;
  email?: string;
  fotoUrl?: string;
  codigoAcceso?: string;
  diasRestantes?: number;
}

interface CheckinSocio {
  _id: string;
  nombre: string;
  fotoUrl?: string;
  diasRestantes: number;
  estado: 'activo' | 'vencido';
  asistenciasMes: number;
}

interface WhatsappInfo {
  enviado: boolean;
  motivo?: string;
  link: string | null;
}

interface CheckinResp {
  socio: CheckinSocio;
  yaRegistradoHoy: boolean;
  whatsapp: WhatsappInfo;
}

interface AsistenciaHoy {
  _id: string;
  fecha: string;
  metodo?: string;
  socio: { _id: string; nombre: string; fotoUrl?: string };
}

@Component({
  selector: 'app-recepcion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recepcion.html',
  styleUrl: './recepcion.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Recepcion implements OnInit, OnDestroy {
  private asistenciaService = inject(AsistenciaService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  // Buscador
  textoBusqueda = '';
  resultados: SocioBusqueda[] = [];
  buscando = false;
  private busqueda$ = new Subject<string>();

  // Código manual
  codigo = '';

  // Estado de check-in
  registrando = false;
  ultimoCheckin: CheckinResp | null = null;

  // Asistencias de hoy
  asistenciasHoy: AsistenciaHoy[] = [];
  cargandoHoy = false;

  // Escáner QR
  escaneando = false;
  private html5Qr: any = null;
  private readonly QR_REGION_ID = 'qr-lector';

  ngOnInit(): void {
    this.busqueda$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          this.buscando = true;
          this.cdr.markForCheck();
          return this.asistenciaService.buscar(q);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res: any) => {
          this.resultados = Array.isArray(res) ? res : [];
          this.buscando = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.buscando = false;
          this.resultados = [];
          this.toast.error('Error al buscar socios');
          this.cdr.markForCheck();
        }
      });

    this.cargarHoy();
  }

  // ---- Buscador ----
  onBuscar(): void {
    const q = this.textoBusqueda.trim();
    if (!q) {
      this.resultados = [];
      this.buscando = false;
      this.cdr.markForCheck();
      return;
    }
    this.busqueda$.next(q);
  }

  seleccionarSocio(socio: SocioBusqueda): void {
    if (this.registrando) return;
    this.checkin({ usuarioId: socio._id, metodo: 'manual' });
  }

  // ---- Código manual ----
  registrarPorCodigo(): void {
    const cod = this.codigo.trim();
    if (!cod) {
      this.toast.info('Escribe un código para registrar la entrada');
      return;
    }
    this.checkin({ codigo: cod, metodo: 'codigo' });
  }

  // ---- Check-in ----
  private checkin(body: { codigo?: string; usuarioId?: string; metodo?: 'qr' | 'codigo' | 'manual' }): void {
    if (this.registrando) return;
    this.registrando = true;
    this.cdr.markForCheck();

    this.asistenciaService
      .checkin(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: CheckinResp) => {
          this.registrando = false;
          this.ultimoCheckin = res;

          if (res?.yaRegistradoHoy) {
            this.toast.info(`${res.socio?.nombre} ya tenía registro hoy`);
          } else {
            this.toast.success(`Entrada registrada: ${res?.socio?.nombre ?? ''}`);
          }

          // Limpiar entradas y refrescar lista de hoy
          this.codigo = '';
          this.textoBusqueda = '';
          this.resultados = [];
          this.cargarHoy();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.registrando = false;
          const msg = err?.error?.mensaje || err?.error?.error || 'No se pudo registrar la entrada';
          this.toast.error(msg);
          this.cdr.markForCheck();
        }
      });
  }

  // ---- Asistencias de hoy ----
  cargarHoy(): void {
    this.cargandoHoy = true;
    this.cdr.markForCheck();
    this.asistenciaService
      .hoy()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          this.asistenciasHoy = Array.isArray(res) ? res : [];
          this.cargandoHoy = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.cargandoHoy = false;
          this.toast.error('Error al cargar las asistencias de hoy');
          this.cdr.markForCheck();
        }
      });
  }

  // ---- QR ----
  async toggleEscaner(): Promise<void> {
    if (this.escaneando) {
      await this.detenerEscaner();
      return;
    }
    await this.iniciarEscaner();
  }

  private async iniciarEscaner(): Promise<void> {
    this.escaneando = true;
    this.cdr.markForCheck();

    try {
      const mod: any = await import('html5-qrcode');
      const Html5Qrcode = mod.Html5Qrcode;

      // Espera un ciclo para que el contenedor exista en el DOM
      await new Promise((r) => setTimeout(r, 0));

      this.html5Qr = new Html5Qrcode(this.QR_REGION_ID);

      await this.html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => this.onQrLeido(decodedText),
        () => {
          /* ignorar errores de decodificación por frame */
        }
      );
    } catch (err: any) {
      this.escaneando = false;
      this.html5Qr = null;
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado'
          : 'No se pudo abrir la cámara';
      this.toast.error(msg);
      this.cdr.markForCheck();
    }
  }

  private async onQrLeido(texto: string): Promise<void> {
    const codigo = (texto || '').trim();
    if (!codigo) return;
    // Detener antes de registrar para evitar lecturas repetidas
    await this.detenerEscaner();
    this.checkin({ codigo, metodo: 'qr' });
  }

  private async detenerEscaner(): Promise<void> {
    if (this.html5Qr) {
      try {
        await this.html5Qr.stop();
        await this.html5Qr.clear();
      } catch {
        /* ya detenido */
      }
      this.html5Qr = null;
    }
    this.escaneando = false;
    this.cdr.markForCheck();
  }

  // ---- Helpers plantilla ----
  cerrarTarjeta(): void {
    this.ultimoCheckin = null;
    this.cdr.markForCheck();
  }

  avatarFallback(event: Event, nombre: string | undefined): void {
    const el = event.target as HTMLImageElement;
    el.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre || 'Socio')}&background=random`;
  }

  fotoOFallback(fotoUrl: string | undefined, nombre: string | undefined): string {
    return fotoUrl?.trim()
      ? fotoUrl
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre || 'Socio')}&background=random`;
  }

  ngOnDestroy(): void {
    void this.detenerEscaner();
  }
}
