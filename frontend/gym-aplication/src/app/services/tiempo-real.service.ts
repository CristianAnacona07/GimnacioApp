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
  /**
   * El servidor de este despliegue no admite el canal (funciones que se apagan
   * entre peticiones). Se recuerda para el resto de la visita: cinco pantallas
   * distintas piden conectar, y sin esto cada una arrancaría su propia tanda de
   * intentos fallidos. Se olvida al recargar la página, que es cuando puede
   * haber cambiado el servidor.
   */
  private canalDescartado = false;

  /** Eventos que el servidor puede enviar; se registran todos al conectar. */
  private static readonly EVENTOS = ['avisos:revisar', 'rutina:actualizada', 'asistencia:nueva'];

  /** Abre el canal si hay sesión. Llamarlo de más no duplica la conexión. */
  conectar(): void {
    if (this.canalDescartado) return;
    const token = this.storage.getToken();
    if (!token || this.storage.isTokenExpired()) return;
    if (this.socket?.connected && this.tokenActual === token) return;

    this.desconectar();
    this.tokenActual = token;

    this.socket = io(environment.apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      // Se rinde tras unos pocos intentos en vez de reintentar para siempre.
      // Donde el backend corre sin servidor propio (funciones que se apagan
      // entre peticiones) el canal NUNCA va a conectar, y sin este límite el
      // cliente llena la consola de errores y gasta batería y datos del móvil
      // por algo que no va a funcionar. Al rendirse, la app sigue andando con
      // sus consultas periódicas, que es justo el respaldo previsto.
      reconnectionAttempts: 3
    });

    // Cuando agota los intentos se anota una sola vez y se cierra el socket,
    // para que no quede a medias ni vuelva a intentarlo por su cuenta.
    this.socket.io.on('reconnect_failed', () => {
      console.info('Tiempo real no disponible; la app sigue con consultas periódicas.');
      this.canalDescartado = true;
      this.desconectar();
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
