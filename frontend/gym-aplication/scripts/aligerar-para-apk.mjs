// Saca del build lo que el APK no tiene por qué llevar adentro.
//
// Las imágenes y los GIF de ejercicios pesan 76 MB. Metidos en el APK lo dejan
// en unos 80 MB — impasable por WhatsApp — y, como la app se actualiza por
// aire, cada actualización bajaría lo mismo para cambiar un texto.
//
// Se quedan en el servidor, que es de donde ya los toma el navegador, y la app
// los pide de ahí (environment.mediaUrl). Necesita internet igual para todo lo
// demás, así que no se pierde nada; y el service worker los guarda en caché la
// primera vez que se ven.
//
// Esto borra de la CARPETA DE SALIDA, no de public/: el sitio web las sigue
// sirviendo exactamente igual.

import { rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const SALIDA = 'dist/frontend/browser';
const PESADO = ['ejercicios'];

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' MB';

async function pesoDe(ruta) {
  const { readdir } = await import('node:fs/promises');
  let total = 0;
  for (const entrada of await readdir(ruta, { withFileTypes: true })) {
    const hijo = join(ruta, entrada.name);
    total += entrada.isDirectory() ? await pesoDe(hijo) : (await stat(hijo)).size;
  }
  return total;
}

for (const carpeta of PESADO) {
  const ruta = join(SALIDA, carpeta);
  try {
    const peso = await pesoDe(ruta);
    await rm(ruta, { recursive: true, force: true });
    console.log(`aligerar-para-apk: fuera ${carpeta}/ (${mb(peso)}) — se sirve desde el sitio`);
  } catch (e) {
    if (e.code === 'ENOENT') console.log(`aligerar-para-apk: ${carpeta}/ no estaba, nada que hacer`);
    else throw e;
  }
}
