import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Lo que el navegador necesita para abrir el checkout de la pasarela. */
export interface Checkout {
  url: string;
  publicKey: string;
  moneda: string;
  centavos: number;
  referencia: string;
  firma: string;
  redirectUrl?: string;
}

/** Cómo está la membresía del socio, y si acaba de pagarla. */
export interface EstadoMembresia {
  diasRestantes: number;
  vence: string | null;
  plan: string | null;
  /** Los días que dura su plan: el tope contra el que se dibuja la barra. */
  diasDelPlan: number | null;
  pendiente: { plan: string | null; dias: number } | null;
  /** Solo durante la media hora siguiente al pago: es el saludo de vuelta. */
  recienPagado: { plan: string | null; dias: number } | null;
}

export interface Solicitud {
  _id: string;
  planId: string;
  monto: number;
  dias: number;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  referencia: string;
  plan?: { nombre: string };
  socio?: { _id?: string; id?: string; nombre: string };
  metodo?: { titulo: string } | null;
  createdAt?: string;
  checkout?: Checkout | null;
}

@Injectable({ providedIn: 'root' })
export class SolicitudesService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/api/solicitudes`;

  /** El socio avisa que va a pagar un plan. No activa nada por sí solo. */
  crear(planId: string, metodoId?: string): Observable<Solicitud> {
    return this.http.post<Solicitud>(this.api, { planId, metodoId });
  }

  /** Su membresía y, si acaba de pagar, el dato para saludarlo. */
  estado(): Observable<EstadoMembresia> {
    return this.http.get<EstadoMembresia>(`${this.api}/estado`);
  }

  /** El aviso que el socio tenga esperando, si hay alguno. */
  mia(): Observable<Solicitud | null> {
    return this.http.get<Solicitud | null>(`${this.api}/mia`);
  }

  /** Los avisos que el gimnasio tiene por confirmar. */
  pendientes(): Observable<Solicitud[]> {
    return this.http.get<Solicitud[]>(this.api);
  }

  aprobar(id: string): Observable<any> {
    return this.http.post(`${this.api}/${id}/aprobar`, {});
  }

  rechazar(id: string): Observable<any> {
    return this.http.post(`${this.api}/${id}/rechazar`, {});
  }

  /**
   * Manda el navegador al checkout de Wompi.
   *
   * La query se arma a mano y no con URLSearchParams porque el parámetro se
   * llama `signature:integrity`: codificar los dos puntos rompe el nombre y
   * Wompi rechaza el cobro.
   */
  irAlCheckout(c: Checkout): void {
    const partes = [
      `public-key=${encodeURIComponent(c.publicKey)}`,
      `currency=${encodeURIComponent(c.moneda)}`,
      `amount-in-cents=${c.centavos}`,
      `reference=${encodeURIComponent(c.referencia)}`,
      `signature:integrity=${c.firma}`,
    ];
    if (c.redirectUrl) partes.push(`redirect-url=${encodeURIComponent(c.redirectUrl)}`);
    window.location.href = `${c.url}?${partes.join('&')}`;
  }
}
