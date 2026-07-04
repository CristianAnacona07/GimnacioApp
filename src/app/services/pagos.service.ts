import { HttpClient } from '@angular/common/http';
import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import { Observable } from 'rxjs';

// Representa un método de pago del gimnasio.
// Campos opcionales para no romper a los llamadores existentes.
export interface Metodo {
    _id?: string;
    gymId?: string;
    titulo?: string;
    tipo?: string;
    imagenUrl?: string;
    descripcion?: string;
    datosClave?: string;
    activo?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

@Injectable({
    providedIn: 'root'
})
export class PagosService {
    // La URL será: http://localhost:3000/api/pagos
    private API_URL: string = `${environment.apiUrl}/api/pagos`;

    constructor(private http: HttpClient) { }

    // Obtener todos los métodos (Lo usará el Socio y el Admin)
    obtenerMetodos(): Observable<Metodo[]> {
        return this.http.get<Metodo[]>(this.API_URL);
    }

    // Crear un nuevo método (Solo para el Admin)
    crearMetodo(datos: Metodo): Observable<Metodo> {
        return this.http.post<Metodo>(this.API_URL, datos);
    }

    // Actualizar un método existente
    actualizarMetodo(id: string, datos: Metodo): Observable<Metodo> {
        return this.http.put<Metodo>(`${this.API_URL}/${id}`, datos);
    }

    // Eliminar un método
    eliminarMetodo(id: string): Observable<Metodo> {
        return this.http.delete<Metodo>(`${this.API_URL}/${id}`);
    }
}