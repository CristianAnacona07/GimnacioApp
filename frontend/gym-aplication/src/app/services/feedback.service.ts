import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Feedback {
  _id?: string;
  nombreUsuario: string;
  gymNombre?: string;
  mensaje: string;
  leido: boolean;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private url = `${environment.apiUrl}/api/feedback`;

  constructor(private http: HttpClient) {}

  enviar(mensaje: string, gymNombre?: string): Observable<Feedback> {
    return this.http.post<Feedback>(this.url, { mensaje, gymNombre });
  }

  getAll(): Observable<Feedback[]> {
    return this.http.get<Feedback[]>(this.url);
  }

  marcarLeido(id: string): Observable<any> {
    return this.http.patch(`${this.url}/${id}/leido`, {});
  }
}
