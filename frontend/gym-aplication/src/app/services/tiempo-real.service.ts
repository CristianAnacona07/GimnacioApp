import { Injectable, NgZone, inject } from '@angular/core';
import { Observable, Subject, filter, map } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { StorageService } from './storage.service';

interface Mensaje { evento: string; datos: any; }

/**
 * Canal en tiempo real con el servidor.
 *
 * Reemplaza el "preguntar cada tanto" por "que me avisen": el servidor empuja
 * los cambios en cuanto ocurren. Las consultas periódicas se mantienen como
 * respaldo, porque el canal puede no estar disponible (una red que bloquea
 * WebSocket, o el backend corriendo sin servidor propio).
 *
 * Un único socket para toda la app: se abre al entrar, se corta al salir, y
 * cada pantalla se suscribe a lo suyo con `escuchar()`.
 */
@Injectable({ providedIn: 'root' })
export class TiempoRealService {
  private storage = inject(StorageService);
  private zone = inject(NgZone);

  private socket: Socket | null = null;
  private readonly mensajes = new Subject<Mensaje>();
  /** Token con el que se abrió el socket: si cambia la sesión, se reconecta. */
  private tokenActual: string | null = null;

  /** Eventos que el servidor puede enviar; se registran todos al conectar. */
  private static readonly EVENTOS = ['avisos:revisar', 'rutina:actualizada', 'asistencia:nueva'];

  /** Abre el canal si hay sesión. Llamarlo de más no duplica la conexión. */
  conectar(): void {
    const token = this.storage.getToken();
    if (!token || this.storage.isTokenExpired()) return;
    if (this.socket?.connected && this.tokenActual === token) return;

    this.desconectar();
    this.tokenActual = token;

    this.socket = io(environment.apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000
    });

    for (const evento of TiempoRealService.EVENTOS) {
      this.socket.on(evento, (datos: any) => {
        // socket.io entrega fuera de la zona de Angular: sin esto, la pantalla
        // no se repinta hasta que el usuario toque algo.
        this.zone.run(() => this.mensajes.next({ evento, datos }));
      });
    }
  }

  desconectar(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.tokenActual = null;
  }

  get conectado(): boolean {
    return !!this.socket?.connected;
  }

  /** Avisos de un evento concreto, ya dentro de la zona de Angular. */
  escuchar<T = any>(evento: string): Observable<T> {
    return this.mensajes.pipe(
      filter(m => m.evento === evento),
      map(m => m.datos as T)
    );
  }
}
