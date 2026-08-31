import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** A quien va dirigido el mensaje: lo decide el socio al escribirlo. */
export type DestinoFeedback = 'gimnasio' | 'plataforma';

export interface Feedback {
  _id?: string;
  /** Llega como "Un socio" cuando se envio en anonimo — lo tapa el backend. */
  nombreUsuario: string;
  gymNombre?: string;
  mensaje: string;
  destino: DestinoFeedback;
  anonimo: boolean;
  leido: boolean;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private url = `${environment.apiUrl}/api/feedback`;

  constructor(private http: HttpClient) {}

  enviar(mensaje: string, gymNombre: string | undefined, destino: DestinoFeedback, anonimo = false): Observable<Feedback> {
    return this.http.post<Feedback>(this.url, { mensaje, gymNombre, destino, anonimo });
  }

  /**
   * Trae los que le corresponden a quien pregunta: el backend decide por el rol
   * del token —- el admin ve los de su gimnasio, el superadmin los de la app.
   * No hay parametro de destino a proposito: si viniera del cliente, se podria
   * pedir lo del otro cambiando la URL.
   */
  getAll(): Observable<Feedback[]> {
    return this.http.get<Feedback[]>(this.url);
  }

  marcarLeido(id: string): Observable<any> {
    return this.http.patch(`${this.url}/${id}/leido`, {});
  }
}
