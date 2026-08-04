import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProgresoService {
    private apiUrl = `${environment.apiUrl}/api/progreso`;

    constructor(private http: HttpClient) {}

    guardarRegistro(datos: { usuarioId: string; ejercicioNombre: string; pesoKg?: number; repeticiones?: number }): Observable<any> {
        return this.http.post(this.apiUrl, datos);
    }

    getEjercicios(usuarioId: string): Observable<string[]> {
        return this.http.get<string[]>(`${this.apiUrl}/${usuarioId}`);
    }

    getHistorial(usuarioId: string, ejercicio: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/${usuarioId}/${encodeURIComponent(ejercicio)}`);
    }
}
