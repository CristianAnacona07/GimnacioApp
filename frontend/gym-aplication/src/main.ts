import { bootstrapApplication } from '@angular/platform-browser';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/**
 * Le avisa al actualizador que esta versión arrancó bien.
 *
 * Sin este aviso el plugin da por rota la versión que acaba de instalar y, en
 * el arranque siguiente, vuelve a la anterior y borra el paquete descargado.
 * Eso fue justo lo que pasó la primera vez que la actualización por aire
 * funcionó: la pantalla nueva apareció y al rato se fue sola.
 *
 * Va después de que el bootstrap resolvió, y a propósito: si Angular no logra
 * arrancar, no se avisa nada y el plugin hace bien su trabajo — deshace la
 * actualización y deja la app andando con la versión de antes. Esa es toda la
 * red de seguridad que tenemos para no dejar a un gimnasio con la app rota.
 *
 * El import es estático y no perezoso: un import perezoso sería un archivo
 * más que la app tendría que ir a buscar justo en el único camino cuyo fallo
 * revierte la actualización.
 */
async function avisarQueArranco(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (e) {
    // Que no se pueda avisar no debe tumbar la app: el peor caso es que la
    // actualización se revierta, no que el socio se quede sin pantalla.
    console.error('No se pudo avisar el arranque al actualizador', e);
  }
}

bootstrapApplication(App, appConfig)
  .then(avisarQueArranco)
  .catch((err) => console.error(err));
