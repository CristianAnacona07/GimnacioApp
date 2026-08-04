import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

/**
 * Traduce errores HTTP a mensajes amigables en español para mostrar al usuario.
 * Centraliza el mapeo de códigos de estado para mantener consistencia en la UI.
 */
@Injectable({ providedIn: 'root' })
export class ErrorHandlingService {
  /**
   * Devuelve un mensaje legible en español a partir de un error HTTP.
   * @param err Error recibido (idealmente un HttpErrorResponse).
   */
  mapHttpError(err: unknown): string {
    const status = this.extractStatus(err);

    switch (status) {
      case 0:
        return 'No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.';
      case 400:
        return 'La solicitud no es válida. Revisa los datos ingresados e inténtalo de nuevo.';
      case 401:
        return 'Tu sesión ha expirado o no tienes autorización. Inicia sesión de nuevo.';
      case 403:
        return 'No tienes permisos para realizar esta acción.';
      case 404:
        return 'No se encontró el recurso solicitado.';
      case 413:
        return 'El archivo o los datos enviados son demasiado grandes.';
      case 429:
        return 'Has realizado demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
      case 500:
        return 'Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.';
      case 503:
        return 'El servicio no está disponible en este momento. Inténtalo de nuevo más tarde.';
      default:
        return 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.';
    }
  }

  private extractStatus(err: unknown): number | null {
    if (err instanceof HttpErrorResponse) {
      return err.status;
    }
    if (err && typeof err === 'object' && 'status' in err) {
      const status = (err as { status?: unknown }).status;
      return typeof status === 'number' ? status : null;
    }
    return null;
  }
}
