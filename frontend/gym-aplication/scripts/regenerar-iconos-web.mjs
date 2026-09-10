// Regenera los iconos de la WEB desde el logo dorado.
//
// Había dos logos conviviendo: el celular ya salía dorado (Android los genera
// desde assets/logo.png con @capacitor/assets) pero la web seguía con el
// naranja viejo — el de la pestaña y, sobre todo, el que usa el manifest, que
// es el que se ve al instalar la app en el escritorio.
//
// Acá el logo se prepara distinto que para el celular, por dos motivos:
//
//   1. El cuadro negro pasa a ser un CÍRCULO negro. Se probó dejarlo sin
//      fondo, y sobre el blanco del diálogo de instalar el dorado quedaba
//      demasiado tenue: son trazos finos sin nada detrás. El círculo le
//      devuelve el contraste sin el parche cuadrado que se veía pegado
//      encima del diálogo.
//   2. Se recorta el aire sobrante para que el dibujo llene el círculo. El
//      original es 1024x1024 con márgenes; recortado son 730x860 de dibujo
//      puro, y a 48 px eso es la diferencia entre verlo y adivinarlo. El 84%
//      del diámetro no es a ojo: es el tamaño más grande con el que NO se
//      sale ni un píxel del círculo (al 88% ya se salen 36).
//
// El de Android NO lleva este tratamiento a propósito: un PNG con
// transparencia hace que @capacitor/assets lo trate como "logo suelto" y
// cambie cómo arma el icono adaptativo. Por eso assets/logo.png se deja como
// está y la versión transparente se calcula acá, sin tocar el original.
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

// Rampa para convertir el fondo negro en transparencia. Los números salen del
// histograma del logo: 76% de los píxeles son negro puro (brillo 0-9) y el
// dorado empieza sobre 120. Una rampa y no un corte seco es lo que deja los
// bordes suaves en vez de dentados.
const BAJO = 70, ALTO = 130;

// Qué parte del diámetro ocupa el dibujo, y cuánto se lo baja respecto del
// centro geométrico. Los dos números están medidos, no elegidos a ojo:
//
// - El dibujo se veía ALTO dentro del círculo aunque su caja estuviera
//   centrada. El motivo es que la cola es larga y fina: ocupa caja y casi no
//   pinta. El centro de masa de la tinta cae un 20% más arriba que el centro
//   de la caja, y el ojo mira la tinta.
// - Bajarlo, además, deja agrandarlo: la parte ancha (la cabeza) se acerca a
//   donde el círculo también es más ancho. Sin bajar, el máximo que entra
//   entero es 87%; bajando un 4%, entra al 91%.
//
// No se toca el brillo del dorado: se midió y el texto "SNAKE GYM" tiene
// prácticamente el mismo brillo que la cabeza (183 contra 187). Se notaba
// poco por tamaño, no por color — y subir el brillo habría hecho más visible
// la marca de agua del logo.
const PROPORCION = 0.91;
const CORRIMIENTO = 0.04;

const { data, info } = await sharp(ORIGEN).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const px = Buffer.from(data);
for (let i = 0; i < px.length; i += 4) {
  const brillo = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
  px[i + 3] = Math.max(0, Math.min(255, Math.round((brillo - BAJO) * 255 / (ALTO - BAJO))));
}

const sinFondo = await sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png().toBuffer();
// `threshold: 1` recorta solo lo totalmente transparente: no se come los
// bordes suaves que acabamos de calcular.
const logo = await sharp(sinFondo).trim({ threshold: 1 }).toBuffer();

const m = await sharp(logo).metadata();
console.log(`origen ${info.width}x${info.height} → dibujo puro ${m.width}x${m.height}`);

const transparente = { r: 0, g: 0, b: 0, alpha: 0 };

/** Un círculo negro con el logo centrado adentro, del tamaño pedido. */
async function icono(lado) {
  const radio = lado / 2;
  const circulo = Buffer.from(
    `<svg width="${lado}" height="${lado}"><circle cx="${radio}" cy="${radio}" r="${radio}" fill="#000000"/></svg>`
  );
  const dentro = await sharp(logo)
    .resize({ height: Math.round(lado * PROPORCION), fit: 'inside', background: transparente })
    .toBuffer();
  const m = await sharp(dentro).metadata();
  return sharp({ create: { width: lado, height: lado, channels: 4, background: transparente } })
    .composite([
      { input: circulo },
      {
        input: dentro,
        top: Math.round((lado - m.height) / 2 + lado * CORRIMIENTO),
        left: Math.round((lado - m.width) / 2)
      }
    ]);
}

for (const lado of TAMANOS) {
  const salida = join(RAIZ, `public/assets/icons/icon-${lado}.webp`);
  await (await icono(lado)).webp({ quality: 92, alphaQuality: 100 }).toFile(salida);
  console.log(`  manifest → icon-${lado}.webp`);
}

// El de la pestaña del navegador. Mismo tamaño que el que había.
await (await icono(256)).png().toFile(join(RAIZ, 'public/icons/favicon.png'));
console.log('  pestaña  → icons/favicon.png');
