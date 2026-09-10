// Regenera los iconos de la WEB desde el logo dorado.
//
// Había dos logos conviviendo: el celular ya salía dorado (Android los genera
// desde assets/logo.png con @capacitor/assets) pero la web seguía con el
// naranja viejo — el de la pestaña y, sobre todo, el que usa el manifest, que
// es el que se ve al instalar la app en el escritorio. Distinto icono según
// dónde la abrieras.
//
// Se corre a mano cuando cambie el logo, no en cada build: los iconos son
// archivos versionados, no una salida de compilación.
//
//   node scripts/regenerar-iconos-web.mjs
//
// Ojo: los tamaños y nombres son los que nombra public/manifest.webmanifest.
// Si cambian acá sin cambiarlos allá, el navegador se queda sin iconos y no
// avisa — simplemente muestra la inicial del nombre.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = join(RAIZ, 'assets/logo.png');   // el mismo que usa el APK
const TAMANOS = [48, 72, 96, 128, 192, 256, 512];

const meta = await sharp(ORIGEN).metadata();
console.log(`origen: ${ORIGEN} (${meta.width}x${meta.height})`);

// El logo es un cuadro negro con el dibujo dorado adentro: no lleva
// transparencia y no hay que recortarle nada, alcanza con escalarlo.
for (const lado of TAMANOS) {
  const salida = join(RAIZ, `public/assets/icons/icon-${lado}.webp`);
  await sharp(ORIGEN).resize(lado, lado, { fit: 'cover' }).webp({ quality: 92 }).toFile(salida);
  console.log(`  manifest → icon-${lado}.webp`);
}

// El de la pestaña del navegador. Mismo tamaño que el que había.
const favicon = join(RAIZ, 'public/icons/favicon.png');
await sharp(ORIGEN).resize(256, 256, { fit: 'cover' }).png().toFile(favicon);
console.log('  pestaña  → icons/favicon.png');
