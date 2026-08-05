import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { AsistenciaService, SocioBuscado } from '../../../services/asistencia.service';
import { ToastService } from '../../../services/toast.service';
import { PagoService } from '../../../services/pago.service';

/** Plan de membresía del gym. */
interface Plan {
  _id: string;
  nombre: string;
  precio?: number;
  /** Días de membresía del plan (los planes creados antes del campo no lo traen). */
  dias?: number;
}

/** Método de pago configurado por el gym. */
interface MetodoPago {
  _id: string;
  titulo: string;
  tipo?: string;
}

/** Datos del WhatsApp devueltos tras registrar el pago. */
interface WhatsappInfo {
  enviado: boolean;
  motivo?: string;
  link: string | null;
}

/** Confirmación mostrada tras registrar un pago. */
interface Confirmacion {
  nombre: string;
  monto: number;
  fechaVencimiento: string | null;
  diasRestantes: number;
  whatsapp: WhatsappInfo;
  passwordTemporal: string | null;
}

@Component({
  selector: 'app-matricula',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './matricula.html',
  styleUrl: './matricula.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Matricula implements OnInit {
  private asistenciaService = inject(AsistenciaService);
  private pagoService = inject(PagoService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  // Tipo de socio
  tipoSocio: 'nuevo' | 'existente' = 'nuevo';

  // Socio nuevo
  nombre = '';
  telefono = '';
  correo = '';

  // Socio existente
  textoBusqueda = '';
  resultados: SocioBuscado[] = [];
  buscando = false;
  socioSeleccionado: SocioBuscado | null = null;
  private busqueda$ = new Subject<string>();

  // Pago
  planes: Plan[] = [];
  metodosPago: MetodoPago[] = [];
  planId = '';
  metodoId = '';
  concepto = '';
  monto: number | null = null;
  dias = 30;

  // Fallback de métodos cuando el gym no tiene configurados
  readonly metodosFallback = ['Nequi', 'Efectivo', 'Tarjeta', 'Transferencia'];
  metodoTexto = '';

  // Estado
  registrando = false;
  confirmacion: Confirmacion | null = null;

  ngOnInit(): void {
    // Buscador de socios existentes con debounce
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
        next: (res) => {
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

    this.cargarPlanes();
    this.cargarMetodosPago();
  }

  // ---- Carga de catálogos ----
  private cargarPlanes(): void {
    this.pagoService
      .planes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          this.planes = Array.isArray(res) ? res : [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.planes = [];
          this.cdr.markForCheck();
        }
      });
  }

  private cargarMetodosPago(): void {
    this.pagoService
      .metodosPago()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          this.metodosPago = Array.isArray(res) ? res : [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.metodosPago = [];
          this.cdr.markForCheck();
        }
      });
  }

  // ---- Tipo de socio ----
  cambiarTipo(tipo: 'nuevo' | 'existente'): void {
    this.tipoSocio = tipo;
    this.socioSeleccionado = null;
    this.resultados = [];
    this.textoBusqueda = '';
    this.cdr.markForCheck();
  }

  // ---- Buscador ----
  onBuscar(): void {
    const q = this.textoBusqueda.trim();
    this.socioSeleccionado = null;
    if (!q) {
      this.resultados = [];
      this.buscando = false;
      this.cdr.markForCheck();
      return;
    }
    this.busqueda$.next(q);
  }

  seleccionarSocio(socio: SocioBuscado): void {
    this.socioSeleccionado = socio;
    this.resultados = [];
    this.textoBusqueda = socio.nombre;
    this.cdr.markForCheck();
  }

  limpiarSeleccion(): void {
    this.socioSeleccionado = null;
    this.textoBusqueda = '';
    this.resultados = [];
    this.cdr.markForCheck();
  }

  // ---- Plan → autocompleta monto, concepto y días ----
  onPlanChange(): void {
    const plan = this.planes.find((p) => p._id === this.planId);
    if (plan) {
      if (typeof plan.precio === 'number') {
        this.monto = plan.precio;
      }
      // Los días vienen del plan: si no se copiaran aquí, el campo se quedaría en
      // su valor por defecto (30) y un plan quincenal cargaría un mes entero.
      if (typeof plan.dias === 'number' && plan.dias > 0) {
        this.dias = plan.dias;
      }
      this.concepto = plan.nombre;
    }
    this.cdr.markForCheck();
  }

  // ---- Envío ----
  registrar(): void {
    if (this.registrando) return;

    // Validaciones
    if (this.tipoSocio === 'nuevo') {
      if (!this.nombre.trim()) {
        this.toast.error('El nombre es obligatorio');
        return;
      }
    } else if (!this.socioSeleccionado) {
      this.toast.error('Selecciona un socio existente');
      return;
    }

    const monto = Number(this.monto);
    if (this.monto === null || (this.monto as any) === '' || isNaN(monto) || monto < 0) {
      this.toast.error('El monto debe ser un número mayor o igual a 0');
      return;
    }

    const dias = Number(this.dias);
    if (isNaN(dias) || !Number.isInteger(dias) || dias < 0) {
      this.toast.error('Los días deben ser un número entero mayor o igual a 0');
      return;
    }

    this.registrando = true;
    this.confirmacion = null;
    this.cdr.markForCheck();

    if (this.tipoSocio === 'nuevo') {
      this.crearYRegistrar(monto, dias);
    } else {
      this.registrarPago(this.socioSeleccionado!._id, monto, dias, null);
    }
  }

  private crearYRegistrar(monto: number, dias: number): void {
    this.pagoService
      .crearSocio({
        nombre: this.nombre.trim(),
        email: this.correo.trim() || undefined,
        telefono: this.telefono.trim() || undefined
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          const socioId = res?.socio?._id;
          const passwordTemporal: string | null = res?.passwordTemporal ?? null;
          if (!socioId) {
            this.registrando = false;
            this.toast.error('No se pudo crear el socio');
            this.cdr.markForCheck();
            return;
          }
          this.registrarPago(socioId, monto, dias, passwordTemporal);
        },
        error: (err) => {
          this.registrando = false;
          const msg = err?.error?.mensaje || err?.error?.error || 'No se pudo crear el socio';
          this.toast.error(msg);
          this.cdr.markForCheck();
        }
      });
  }

  private registrarPago(
    usuarioId: string,
    monto: number,
    dias: number,
    passwordTemporal: string | null
  ): void {
    const body: {
      usuarioId: string;
      monto: number;
      metodoId?: string;
      concepto?: string;
      dias?: number;
    } = { usuarioId, monto, dias };

    if (this.metodoId) body.metodoId = this.metodoId;
    const concepto = this.concepto.trim() || this.metodoTexto.trim();
    if (concepto) body.concepto = concepto;

    this.pagoService
      .registrarPago(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          this.registrando = false;
          const socio = res?.socio ?? {};
          this.confirmacion = {
            nombre: socio.nombre ?? (this.tipoSocio === 'nuevo' ? this.nombre : this.socioSeleccionado?.nombre) ?? '',
            monto,
            fechaVencimiento: socio.fechaVencimiento ?? null,
            diasRestantes: socio.diasRestantes ?? 0,
            whatsapp: res?.whatsapp ?? { enviado: false, link: null },
            passwordTemporal
          };
          this.toast.success('Pago registrado');
          this.resetFormulario();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.registrando = false;
          const msg = err?.error?.mensaje || err?.error?.error || 'No se pudo registrar el pago';
          this.toast.error(msg);
          this.cdr.markForCheck();
        }
      });
  }

  private resetFormulario(): void {
    this.nombre = '';
    this.telefono = '';
    this.correo = '';
    this.textoBusqueda = '';
    this.resultados = [];
    this.socioSeleccionado = null;
    this.planId = '';
    this.metodoId = '';
    this.metodoTexto = '';
    this.concepto = '';
    this.monto = null;
    this.dias = 30;
  }

  cerrarConfirmacion(): void {
    this.confirmacion = null;
    this.cdr.markForCheck();
  }
}
