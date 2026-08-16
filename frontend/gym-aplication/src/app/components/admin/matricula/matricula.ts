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
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { AsistenciaService, SocioBuscado } from '../../../services/asistencia.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';
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
  invitacionEnviada: boolean;
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
  private confirm = inject(ConfirmService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);

  // Tipo de socio
  tipoSocio: 'nuevo' | 'existente' = 'nuevo';

  // Socio nuevo
  nombre = '';
  telefono = '';
  correo = '';
  identificacion = '';

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
  /** Lo que se ve/escribe en el campo; si coincide con un plan real, se autocompleta monto/días/concepto. */
  planTexto = '';
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

    // Viene de "Renovar" en recepción con un socio ya identificado: se salta
    // la búsqueda y arranca directo en "Socio existente" con él seleccionado.
    const params = this.route.snapshot.queryParamMap;
    const usuarioId = params.get('usuarioId');
    const nombre = params.get('nombre');
    if (usuarioId && nombre) {
      this.tipoSocio = 'existente';
      this.textoBusqueda = nombre;
      this.socioSeleccionado = {
        _id: usuarioId,
        nombre,
        email: '',
        codigoAcceso: '',
        diasRestantes: 0
      };
      this.cdr.markForCheck();
    }
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

  // ---- Plan: campo de texto con sugerencias (datalist), no un select cerrado ----
  onPlanTextoChange(valor: string): void {
    this.planTexto = valor;
    // Si lo tecleado coincide con un plan real (elegido de la lista o escrito
    // igual a mano), se autocompleta; si no, queda como texto libre y no toca
    // lo que el admin ya haya puesto en monto/días/concepto.
    const plan = this.planes.find((p) => p.nombre.trim().toLowerCase() === valor.trim().toLowerCase());
    this.planId = plan ? plan._id : '';
    if (plan) this.onPlanChange();
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
  async registrar(): Promise<void> {
    if (this.registrando) return;

    // Validaciones
    if (this.tipoSocio === 'nuevo') {
      if (!this.nombre.trim()) {
        this.toast.error('El nombre es obligatorio');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.correo.trim())) {
        this.toast.error('El correo es obligatorio y debe ser válido');
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

    // Si al socio le quedan días, hay dos lecturas posibles del pago y solo él
    // sabe cuál quiere: sumarlos (renovación normal) o reescribir la membresía
    // desde hoy (corregir una carga anterior). Preguntar evita ambas sorpresas.
    let reemplazar = false;
    const restantes = this.socioSeleccionado?.diasRestantes ?? 0;
    if (this.tipoSocio === 'existente' && restantes > 0 && dias > 0) {
      const eleccion = await this.confirm.elegir(
        this.mensajeMembresiaActiva(this.socioSeleccionado!.nombre, restantes, dias),
        [
          { texto: 'Reasignar', valor: 'reasignar' },
          { texto: `Sumar ${dias} días`, valor: 'sumar', estilo: 'primario' }
        ]
      );
      if (eleccion === null) return; // cerró el diálogo: no se registra nada
      reemplazar = eleccion === 'reasignar';
    }

    this.registrando = true;
    this.confirmacion = null;
    this.cdr.markForCheck();

    if (this.tipoSocio === 'nuevo') {
      this.crearYRegistrar(monto, dias);
    } else {
      this.registrarPago(this.socioSeleccionado!._id, monto, dias, null, reemplazar);
    }
  }

  /** Texto del diálogo, con la fecha en la que quedaría cada opción. */
  private mensajeMembresiaActiva(nombre: string, restantes: number, dias: number): string {
    const fecha = (sumar: number) => {
      const d = new Date();
      d.setDate(d.getDate() + sumar);
      return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    };
    const plural = restantes === 1 ? 'día' : 'días';
    return (
      `A ${nombre.trim()} todavía le ${restantes === 1 ? 'queda' : 'quedan'} ${restantes} ${plural} de membresía.\n\n` +
      `• Sumar: se añaden a los que ya tiene y quedará hasta el ${fecha(restantes + dias)}.\n` +
      `• Reasignar: la membresía se reescribe desde hoy y quedará hasta el ${fecha(dias)}, ` +
      `perdiendo los ${restantes} ${plural} que le quedaban.`
    );
  }

  private crearYRegistrar(monto: number, dias: number): void {
    this.pagoService
      .crearSocio({
        nombre: this.nombre.trim(),
        email: this.correo.trim() || undefined,
        telefono: this.telefono.trim() || undefined,
        identificacion: this.identificacion.trim() || undefined
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          const socioId = res?.socio?._id;
          const passwordTemporal: string | null = res?.passwordTemporal ?? null;
          const invitacionEnviada: boolean = !!res?.invitacionEnviada;
          if (!socioId) {
            this.registrando = false;
            this.toast.error('No se pudo crear el socio');
            this.cdr.markForCheck();
            return;
          }
          this.registrarPago(socioId, monto, dias, passwordTemporal, false, invitacionEnviada);
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
    passwordTemporal: string | null,
    reemplazar = false,
    invitacionEnviada = false
  ): void {
    const body: {
      usuarioId: string;
      monto: number;
      metodoId?: string;
      concepto?: string;
      dias?: number;
      reemplazar?: boolean;
    } = { usuarioId, monto, dias };

    // Solo se manda cuando toca, para no cambiar el cuerpo del resto de pagos.
    if (reemplazar) body.reemplazar = true;

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
            passwordTemporal,
            invitacionEnviada
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
    this.identificacion = '';
    this.textoBusqueda = '';
    this.resultados = [];
    this.socioSeleccionado = null;
    this.planId = '';
    this.planTexto = '';
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
