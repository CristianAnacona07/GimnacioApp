import { Pipe, PipeTransform } from '@angular/core';
import { medioEjercicio } from '../../data/ejercicios-catalogo';

/**
 * Resuelve la dirección de una imagen de ejercicio.
 *
 * En el navegador las imágenes salen del mismo sitio que la página, así que la
 * ruta relativa alcanza. En la app instalada no: la web va empaquetada dentro
 * del APK y los 76 MB de GIF se quedaron afuera a propósito, así que una ruta
 * como `ejercicios/pechoGif/press.gif` se resolvería contra el propio APK y no
 * existiría — que es exactamente lo que pasaba: las tarjetas de la rutina
 * salían con el ícono de imagen rota.
 *
 * Hace falta en la plantilla y no alcanza con arreglar el catálogo, porque los
 * ejercicios de una rutina NO se leen del catálogo: se copian a la rutina
 * cuando el entrenador la arma y desde entonces viven en la base, con la ruta
 * relativa que tenían ese día.
 */
@Pipe({ name: 'medio', standalone: true })
export class MedioPipe implements PipeTransform {
  transform(ruta: string | undefined | null): string {
    return medioEjercicio(ruta ?? undefined);
  }
}
