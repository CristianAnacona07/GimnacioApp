import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Medida {
  _id?: string;
  usuarioId: string;
  fecha: string;
  peso?: number | null;
  cintura?: number | null;
  cadera?: number | null;
  pecho?: number | null;
  brazo?: number | null;
  muslo?: number | null;
}

@Injectable({ providedIn: 'root' })
export class MedidasService {
  private apiUrl = `${environment.apiUrl}/api/medidas`;

  constructor(private http: HttpClient) {}

  guardar(datos: Partial<Medida>): Observable<Medida> {
    return this.http.post<Medida>(this.apiUrl, datos);
  }

  getHistorial(usuarioId: string): Observable<Medida[]> {
    return this.http.get<Medida[]>(`${this.apiUrl}/${usuarioId}`);
  }

  actualizar(id: string, datos: Partial<Medida>): Observable<Medida> {
    return this.http.put<Medida>(`${this.apiUrl}/${id}`, datos);
  }

  eliminar(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
