import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { UserStateService } from './user-state.service';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api/auth`;
  private rutinasUrl = `${environment.apiUrl}/api/rutinas`;

  constructor(
    private http: HttpClient,
    private userStateService: UserStateService,
    private storageService: StorageService
  ) {}

  // --- AUTENTICACIÓN ---

  // La persistencia de sesión (limpiar + escribir + sincronizar estado) la hace
  // el componente Login vía guardarSesion(), para evitar escribir antes de limpiar.
  loginConGoogle(accessToken: string, gymId?: string | null): Observable<any> {
    return this.http.post(`${this.apiUrl}/google`, { access_token: accessToken, gymId });
  }

  // Login de Google nativo (APK): se envía el idToken como `credential`,
  // que el backend verifica con la audiencia del client ID.
  loginGoogleNativo(idToken: string, gymId?: string | null): Observable<any> {
    return this.http.post(`${this.apiUrl}/google`, { credential: idToken, gymId });
  }

  login(credenciales: any) {
    return this.http.post(`${this.apiUrl}/login`, credenciales);
  }

  registrar(usuario: any) {
    return this.http.post(`${this.apiUrl}/register`, usuario);
  }

  logout() {
    this.userStateService.clearSession();
  }

  /**
   * Renueva el token JWT actual
   * Requiere que el usuario tenga un token válido (no expirado)
   */
  refreshToken(): Observable<any> {
    return this.http.post(`${this.apiUrl}/refresh-token`, {}).pipe(
      tap((response: any) => {
        if (response.token) {
          this.storageService.setToken(response.token);
        }
        if (response.usuario) {
          this.userStateService.updateUser(response.usuario);
        }
      })
    );
  }

  // --- USUARIOS (Admin) ---

  getUsuarios(): Observable<any> {
    return this.http.get(`${this.apiUrl}/usuarios`);
  }

  renovarMembresia(id: string, dias: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/renovar/${id}`, { dias });
  }

  limpiarMembresia(id: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/limpiar-membresia/${id}`, {});
  }

  // --- PERFIL ---

  getPerfilSocio(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/perfil/${id}`).pipe(
      tap((perfil: any) => {
        this.userStateService.updateUser(perfil);
      })
    );
  }

  obtenerPerfil(userId: string): Observable<any> {
    return this.getPerfilSocio(userId);
  }

  actualizarPerfil(id: string, datos: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/actualizar-perfil/${id}`, datos);
  }

  // --- RUTINAS ---

  obtenerRutina(usuarioId: string): Observable<any> {
    return this.http.get(`${this.rutinasUrl}/${usuarioId}`);
  }

  asignarRutina(datos: any): Observable<any> {
    return this.http.post(`${this.rutinasUrl}/asignar`, datos);
  }

  actualizarRutina(idRutina: string, datos: any): Observable<any> {
    return this.http.put(`${this.rutinasUrl}/actualizar/${idRutina}`, datos);
  }

  eliminarRutina(idRutina: string): Observable<any> {
    return this.http.delete(`${this.rutinasUrl}/eliminar/${idRutina}`);
  }

  resetDiario(usuarioId: string): Observable<any> {
    return this.http.patch(`${this.rutinasUrl}/reset-dia/${usuarioId}`, {});
  }

  toggleEjercicioCompletado(rutinaId: string, ejercicioIdx: number, completado: boolean): Observable<any> {
    return this.http.patch(
      `${this.rutinasUrl}/${rutinaId}/ejercicio/${ejercicioIdx}`,
      { completado }
    );
  }
}
