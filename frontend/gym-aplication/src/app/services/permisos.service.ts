import { Injectable, inject } from '@angular/core';
import { UserStateService } from './user-state.service';

/** Secciones que el admin reparte. Debe coincidir con backend/lib/permisos.js. */
export type Seccion =
  | 'noticias'
  | 'socios'
  | 'rutinas'
  | 'planes'
  | 'pagos'
  | 'empleados'
  | 'recepcion';

export type Nivel = 'ninguno' | 'lectura' | 'edicion';

const RANGO: Record<Nivel, number> = { ninguno: 0, lectura: 1, edicion: 2 };

/**
 * Consulta los permisos por sección de la cuenta actual, que llegan dentro de
 * la respuesta del login y quedan guardados junto al resto del usuario.
 *
 * Esto es sólo para decidir qué se dibuja: quién puede hacer qué lo resuelve el
 * servidor en cada petición (middleware requierePermiso). Si alguien escribe
 * la dirección a mano igual se topa con un 403 — esconder el botón es
 * comodidad, no seguridad.
 */
@Injectable({ providedIn: 'root' })
export class PermisosService {
  private userState = inject(UserStateService);

  /** El admin y el superadmin mandan sobre todo su gimnasio, sin consultar nada. */
  get esAdmin(): boolean {
    const role = (this.userState.getRole() || '').toLowerCase().trim();
    return role === 'admin' || role === 'superadmin';
  }

  private nivel(seccion: Seccion): Nivel {
    const permisos = this.userState.getCurrentUser()?.permisos;
    const valor = permisos?.[seccion];
    return valor in RANGO ? (valor as Nivel) : 'ninguno';
  }

  /** ¿Llega al nivel pedido? Por defecto, con verla alcanza. */
  puede(seccion: Seccion, nivel: Nivel = 'lectura'): boolean {
    if (this.esAdmin) return true;
    return RANGO[this.nivel(seccion)] >= RANGO[nivel];
  }

  /** Ve la sección pero no puede tocarla: sirve para dibujarla en modo consulta. */
  soloLectura(seccion: Seccion): boolean {
    return this.puede(seccion) && !this.puede(seccion, 'edicion');
  }

  /**
   * Borrar no se reparte: es lo único que no se deshace, así que queda en manos
   * del admin. Si algún día se reparte, este es el único sitio a cambiar.
   */
  get puedeBorrar(): boolean {
    return this.esAdmin;
  }
}
