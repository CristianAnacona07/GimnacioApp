import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Socio recién creado por recepción. */
export interface SocioCreado {
  mensaje: string;
  socio: {
    _id: string;
    nombre: string;
    email: string;
  };
  passwordTemporal: string | null;
}

/** Estado del envío de WhatsApp tras registrar un pago. */
export interface WhatsappPago {
  enviado: boolean;
  motivo?: string;
  link: string | null;
}

/** Resultado completo del registro de un pago/transacción. */
export interface ResultadoPago {
  transaccion: any;
  socio: {
    _id: string;
    nombre: string;
    fechaVencimiento: string;
    diasRestantes: number;
  };
  whatsapp: WhatsappPago;
}

/** Plan de membresía (forma reducida para selección de pago). */
export interface PlanLite {
  _id: string;
  nombre: string;
  precio: number;
  /** Días de membresía que otorga el plan (opcional: los planes viejos no lo traen). */
  dias?: number;
  [key: string]: any;
}

/** Método de pago del gym (forma reducida). */
export interface MetodoLite {
  _id: string;
  titulo: string;
  tipo: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class PagoService {
  private http = inject(HttpClient);
  private url = environment.apiUrl;

  /** Crea un socio nuevo desde recepción (email/telefono/password opcionales). */
  crearSocio(datos: {
    nombre: string;
    email?: string;
    telefono?: string;
    password?: string;
  }): Observable<SocioCreado> {
    return this.http.post<SocioCreado>(`${this.url}/api/auth/crear-socio`, datos);
  }

  /** Registra un pago/transacción para un socio y renueva su membresía. */
  registrarPago(datos: {
    usuarioId: string;
    monto: number;
    metodoId?: string;
    concepto?: string;
    dias?: number;
  }): Observable<ResultadoPago> {
    return this.http.post<ResultadoPago>(`${this.url}/api/transacciones/registrar`, datos);
  }

  /** Lista los planes de membresía del gym. */
  planes(): Observable<PlanLite[]> {
    return this.http.get<PlanLite[]>(`${this.url}/api/planes`);
  }

  /** Lista los métodos de pago configurados del gym (ej. Nequi). */
  metodosPago(): Observable<MetodoLite[]> {
    return this.http.get<MetodoLite[]>(`${this.url}/api/pagos`);
  }
}
