import { HttpClient } from '@angular/common/http';
import { Injectable } from "@angular/core"; // Cambiado: Injectable en lugar de Inject
import { environment } from "../../environments/environment";
import { Observable } from 'rxjs';

@Injectable({ // Corregido: @Injectable es el decorador correcto
    providedIn: 'root'
})
export class PlanesService {
    private API_URL: string = `${environment.apiUrl}/api/planes`;

    constructor(private http: HttpClient) { }

    // Obtener todos los planes
    obtenerPlanes(): Observable<any> {
        return this.http.get(this.API_URL);
    }

    // Obtener un plan por id
    obtenerPlan(id: string): Observable<any> {
        return this.http.get(`${this.API_URL}/${id}`);
    }

    // Crear un plan
    crearPlan(datos: any): Observable<any> {
        return this.http.post(this.API_URL, datos);
    }

    // Actualizar un plan
    actualizarPlan(id: string, datos: any): Observable<any> {
        return this.http.put(`${this.API_URL}/${id}`, datos);
    }

    // Eliminar un plan
    eliminarPlan(id: string): Observable<any> {
        return this.http.delete(`${this.API_URL}/${id}`);
    }
}