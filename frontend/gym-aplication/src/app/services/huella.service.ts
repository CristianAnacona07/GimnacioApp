import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AccessControl, NativeBiometric } from '@capgo/capacitor-native-biometric';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth';

/**
 * Entrar a la app con la huella del celular.
 *
 * Cómo funciona, en una línea: el teléfono valida la huella por su cuenta y, si
 * da bien, abre su almacén cifrado y suelta una llave que el servidor emitió
 * antes. Esa llave se cambia por una sesión normal.
 *
 * Lo que NO hace, y es lo importante:
 *
 * - **No guarda la contraseña.** Es lo que hace casi todo el mundo y es lo que
 *   no queríamos: una contraseña en el aparato sigue siendo la contraseña, y si
 *   el socio la cambia en otro lado, la guardada queda vieja sin que nadie se
 *   entere.
 * - **No manda ninguna huella a ningún lado.** El servidor no puede leerla ni
 *   guardarla: Android no la entrega, ni a nosotros ni a nadie. Solo contesta
 *   "sí" o "no". Ojo con confundir esto con la tabla `huellas` del backend, que
 *   es la de los lectores de la puerta del gimnasio — ahí sí hay dedos.
 *
 * La llave queda protegida por hardware con `BIOMETRY_CURRENT_SET`, que además
 * la invalida sola si alguien registra una huella nueva en el teléfono: si otra
 * persona mete su dedo en el aparato, no hereda la sesión.
 */

/** Nombre de la llave dentro del almacén cifrado del teléfono. */
const CLAVE_SEGURA = 'snakegym.llave-celular';

/**
 * Marca en localStorage de que este aparato está vinculado. NO es la llave —
 * solo el id de la fila del servidor, para poder revocarla al desactivar, y de
 * quién es, para no mostrarle a una persona la huella de otra si comparten el
 * teléfono. Sobrevive al cierre de sesión (está en PRESERVED_KEYS): si se
 * borrara, entrar con huella dejaría de ofrecerse justo cuando hace falta.
 */
const MARCA = 'celularVinculado';

interface Marca {
  id: string;
  usuarioId: string;
}

export type MotivoNoDisponible = 'web' | 'sin-sensor' | 'sin-huellas' | 'error';

@Injectable({ providedIn: 'root' })
export class HuellaService {
  private authService = inject(AuthService);

  /**
   * Si el aparato puede o no, y por qué no.
   *
   * El motivo importa: "tu celular no tiene lector" y "tenés lector pero no
   * registraste ninguna huella" se arreglan de formas distintas, y decir solo
   * "no disponible" deja al socio sin saber qué hacer.
   */
  async disponible(): Promise<{ puede: boolean; motivo?: MotivoNoDisponible }> {
    if (!Capacitor.isNativePlatform()) return { puede: false, motivo: 'web' };
    try {
      const r = await NativeBiometric.isAvailable();
      if (r.isAvailable) return { puede: true };
      // El plugin distingue "no hay sensor" de "hay sensor sin huellas
      // registradas"; el código exacto varía entre versiones de Android, así
      // que se mira el texto además del código.
      const codigo = String((r as any).errorCode ?? (r as any).reason ?? '').toLowerCase();
      const sinHuellas = codigo.includes('enroll') || codigo.includes('none_enrolled');
      return { puede: false, motivo: sinHuellas ? 'sin-huellas' : 'sin-sensor' };
    } catch {
      return { puede: false, motivo: 'error' };
    }
  }

  private leerMarca(): Marca | null {
    try {
      const crudo = localStorage.getItem(MARCA);
      const m = crudo ? JSON.parse(crudo) : null;
      return m && typeof m.id === 'string' && typeof m.usuarioId === 'string' ? m : null;
    } catch {
      return null;
    }
  }

  /** ¿Este aparato entra con huella a la cuenta de esta persona? */
  activada(usuarioId?: string | null): boolean {
    const m = this.leerMarca();
    if (!m) return false;
    return usuarioId ? m.usuarioId === usuarioId : true;
  }

  /** ¿Hay alguna cuenta vinculada acá? Lo que mira el botón del login. */
  hayAlgunaVinculada(): boolean {
    return !!this.leerMarca();
  }

  /**
   * Activar. Solo se llega acá habiendo entrado con la contraseña, que es lo
   * que convierte la huella en un atajo y no en una forma nueva de entrar sin
   * saber nada.
   */
  async activar(usuarioId: string, nombreAparato: string): Promise<void> {
    const { llave, celular } = await firstValueFrom(
      this.authService.vincularCelular(nombreAparato)
    ) as any;

    try {
      // Guardar ya pide la huella: así el socio comprueba en el acto que
      // funciona, en vez de descubrirlo mañana cuando no pueda entrar.
      await NativeBiometric.setData({
        key: CLAVE_SEGURA,
        value: llave,
        accessControl: AccessControl.BIOMETRY_CURRENT_SET,
        title: 'Activar ingreso con huella',
        negativeButtonText: 'Cancelar'
      });
    } catch (e) {
      // Si el teléfono no la guardó, la llave del servidor quedaría suelta sin
      // que nadie pueda usarla. Se revoca antes de salir.
      await firstValueFrom(this.authService.desvincularCelular(celular._id)).catch(() => {});
      throw e;
    }

    localStorage.setItem(MARCA, JSON.stringify({ id: celular._id, usuarioId } as Marca));
  }

  /**
   * Desactivar: primero el servidor, después el teléfono.
   *
   * Ese orden importa. Si se borrara primero acá y fallara el servidor, la
   * llave seguiría sirviendo y nadie tendría ya cómo revocarla.
   */
  async desactivar(): Promise<void> {
    const m = this.leerMarca();
    if (m) await firstValueFrom(this.authService.desvincularCelular(m.id)).catch(() => {});
    await NativeBiometric.deleteData({ key: CLAVE_SEGURA }).catch(() => {});
    localStorage.removeItem(MARCA);
  }

  /** Borra solo la marca local. Para cuando el servidor ya dijo que no vale. */
  olvidarLocal(): void {
    localStorage.removeItem(MARCA);
    NativeBiometric.deleteData({ key: CLAVE_SEGURA }).catch(() => {});
  }

  /**
   * Entrar. Pide la huella, saca la llave y la cambia por una sesión.
   *
   * Devuelve la misma respuesta que un login normal, así que quien llama la
   * puede pasar por el mismo camino de siempre sin tratarla como un caso raro.
   */
  async entrar(): Promise<any> {
    const { value: llave } = await NativeBiometric.getSecureData({
      key: CLAVE_SEGURA,
      reason: 'Entrá a Snake Gym con tu huella',
      title: 'Entrar con huella',
      negativeButtonText: 'Usar contraseña'
    });

    try {
      return await firstValueFrom(this.authService.loginConCelular(llave));
    } catch (e: any) {
      // 401 = el servidor ya no reconoce esta llave (la revocaron, o el socio
      // cambió la contraseña). Se limpia acá para que el botón deje de
      // ofrecerse y no quede prometiendo algo que no funciona.
      if (e?.status === 401) this.olvidarLocal();
      throw e;
    }
  }
}
