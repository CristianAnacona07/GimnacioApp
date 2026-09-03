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
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import QRCode from 'qrcode';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AsistenciaService } from '../../../services/asistencia.service';
import { ToastService } from '../../../services/toast.service';
import { SedeService } from '../../../services/sede.service';
import { TiempoRealService } from '../../../services/tiempo-real.service';
import { PagoService } from '../../../services/pago.service';
import { GymService } from '../../../services/gym.service';

interface SocioBusqueda {
  _id: string;
  nombre: string;
  email?: string;
  fotoUrl?: string;
  codigoAcceso?: string;
  /** Cédula del socio; vacía si no la tiene registrada. */
  identificacion?: string;
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
  acceso?: 'permitido' | 'denegado';
  mensaje?: string;
  socio: CheckinSocio;
  yaRegistradoHoy: boolean;
  whatsapp: WhatsappInfo | null;
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
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './recepcion.html',
  styleUrl: './recepcion.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Recepcion implements OnInit, OnDestroy {
  private asistenciaService = inject(AsistenciaService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private tiempoReal = inject(TiempoRealService);
  private http = inject(HttpClient);
  private sedeService = inject(SedeService);

  /** Varias sedes y ninguna elegida: lo que se registre queda sin local. */
  get faltaElegirSede(): boolean {
    return this.sedeService.tieneVariasSedes && !this.sedeService.parametro;
  }
  private pagoService = inject(PagoService);
  private gymService = inject(GymService);

  // --- Invitación de registro (link/QR de un solo uso) ---
  invitandoSocio = false;
  invitacionUrl: string | null = null;
  invitacionQr: string | null = null;

  // --- Alta instantánea (contraseña temporal a la vista, sin correo) ---
  mostrarFormSocioApp = false;
  creandoSocioApp = false;
  nuevoSocioNombre = '';
  nuevoSocioEmail = '';
  socioAppCreado: { email: string; passwordTemporal: string } | null = null;

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

    // La primera carga la dispara la suscripción de abajo, cuando ya se sabe
    // la sede: antes mostraba las entradas de todos los locales por un instante.

    // Recepción es la pantalla donde la sede más importa: al cambiarla, la
    // lista pasa a mostrar quién entró por esa puerta.
    this.sedeService.sedeActiva$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarHoy());

    // Cada ingreso aparece en el momento, venga de esta pantalla o de otra: la
    // tablet de la entrada y la oficina ven la misma lista sin recargar.
    this.tiempoReal.conectar();
    this.tiempoReal.escuchar('asistencia:nueva')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarHoy());
  }

  /**
   * Dominio con el que se arma el link de invitación: el subdominio propio del
   * gimnasio (kodiak.snakegym.cloud), no el dominio desde el que navega quien
   * lo genera.
   *
   * Antes usaba `window.location.origin` a secas, así que un admin entrando
   * por el dominio raíz repartía links con ese dominio y el socio nuevo se
   * registraba en una página sin la marca de su gimnasio.
   *
   * Se conserva `window.location.origin` cuando no hay slug o el dominio raíz
   * no está configurado (dev en localhost, app nativa en Capacitor): ahí no
   * existe subdominio que usar y el link igual funciona, porque el token de
   * invitación ya determina el gimnasio del lado del servidor.
   */
  private baseInvitacion(): string {
    const slug = this.gymService.getGym()?.slug;
    const raiz = environment.tenantRootDomain;
    const esWebConDominio = raiz && !raiz.includes('localhost') && window.location.protocol.startsWith('http');
    return slug && esWebConDominio ? `https://${slug}.${raiz}` : window.location.origin;
  }

  // ---- Invitar socio ----
  // Genera el link de un solo uso (48 h) con el que el socio nuevo se registra
  // en ESTE gimnasio, y su QR para mostrarlo en pantalla o imprimirlo.
  async invitarSocio(): Promise<void> {
    if (this.invitandoSocio) return;
    this.invitandoSocio = true;
    this.cdr.markForCheck();
    this.http.post<{ token: string }>(`${environment.apiUrl}/api/invitaciones`,
      // La sede viaja acá: el socio que use este enlace queda en el local donde
      // se lo invitó. Sin esto la invitación salía sin sede y el socio nuevo
      // terminaba sin local asignado.
      { sede: this.sedeService.parametro || undefined })
      .subscribe({
        next: async (res) => {
          this.invitacionUrl = `${this.baseInvitacion()}/invitacion/${res.token}`;
          try {
            this.invitacionQr = await QRCode.toDataURL(this.invitacionUrl, { width: 240, margin: 1 });
          } catch { this.invitacionQr = null; }
          this.invitandoSocio = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.invitandoSocio = false;
          this.toast.error('No se pudo crear la invitación');
          this.cdr.markForCheck();
        }
      });
  }

  copiarInvitacion(): void {
    if (!this.invitacionUrl) return;
    navigator.clipboard.writeText(this.invitacionUrl)
      .then(() => this.toast.success('Enlace copiado'))
      .catch(() => this.toast.error('No se pudo copiar'));
  }

  get whatsappInvitacion(): string {
    if (!this.invitacionUrl) return '';
    const texto = encodeURIComponent(
      `¡Bienvenido! Registrate en el gimnasio con este enlace (sirve una sola vez y vence en 48 horas): ${this.invitacionUrl}`
    );
    return `https://wa.me/?text=${texto}`;
  }

  cerrarInvitacion(): void {
    this.invitacionUrl = null;
    this.invitacionQr = null;
    this.cdr.markForCheck();
  }

  // ---- Crear socio con contraseña temporal (sin correo) ----
  // Alternativa a invitarSocio(): en vez de un link para que se registre
  // solo, la cuenta queda lista al toque, con una contraseña temporal que
  // recepción entrega en persona. El socio la cambia en su primer login.
  abrirFormSocioApp(): void {
    this.mostrarFormSocioApp = true;
    this.cdr.markForCheck();
  }

  cancelarFormSocioApp(): void {
    this.mostrarFormSocioApp = false;
    this.nuevoSocioNombre = '';
    this.nuevoSocioEmail = '';
    this.cdr.markForCheck();
  }

  crearSocioConApp(): void {
    const nombre = this.nuevoSocioNombre.trim();
    const email = this.nuevoSocioEmail.trim();
    if (!nombre || !email || this.creandoSocioApp) return;

    this.creandoSocioApp = true;
    this.cdr.markForCheck();
    this.pagoService.crearSocio({ nombre, email, conApp: true }).subscribe({
      next: (res) => {
        this.socioAppCreado = { email: res.socio.email, passwordTemporal: res.passwordTemporal || '' };
        this.mostrarFormSocioApp = false;
        this.nuevoSocioNombre = '';
        this.nuevoSocioEmail = '';
        this.creandoSocioApp = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.creandoSocioApp = false;
        this.toast.error(err.error?.mensaje || 'No se pudo crear el socio');
        this.cdr.markForCheck();
      }
    });
  }

  cerrarSocioAppCreado(): void {
    this.socioAppCreado = null;
    this.cdr.markForCheck();
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

          if (res?.acceso === 'denegado') {
            this.toast.error(`${res.socio?.nombre}: membresía vencida — no puede ingresar`);
          } else if (res?.yaRegistradoHoy) {
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
