import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NoticiaService {
  private apiUrl = `${environment.apiUrl}/api/noticias`;

  constructor(private http: HttpClient) {}

  // Obtener todas las noticias
  obtenerNoticias() {
    return this.http.get(this.apiUrl);
  }

  // Obtener una noticia por ID
  obtenerNoticia(id: string) {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  // Crear una noticia
  crearNoticia(datos: any) {
    return this.http.post(this.apiUrl, datos);
  }

  // Actualizar una noticia
  actualizarNoticia(id: string, datos: any) {
    return this.http.put(`${this.apiUrl}/${id}`, datos);
  }

  // Eliminar una noticia
  eliminarNoticia(id: string) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}