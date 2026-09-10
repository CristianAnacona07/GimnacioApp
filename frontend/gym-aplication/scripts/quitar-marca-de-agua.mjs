// Quita una marca de agua del logo repintando el dorado con su propio degradado.
//
//   node scripts/quitar-marca-de-agua.mjs <entrada.png> <salida.png>
//
// Se usó con el logo que vino de turbologo, que traía su marca encima del
// dibujo. Queda por si hay que repetirlo con el logo de otro gimnasio.
//
// Por qué así y no "borrando la marca": el dorado NO tiene textura, es un
// degradado liso. Las formas del logo las define el borde entre dorado y
// negro, no lo que pasa dentro del dorado. Entonces se puede tirar todo el
// interior y repintarlo — la marca desaparece entera y el dibujo queda igual.
// Probar primero con una mediana no funcionó: la ventana que borraba la marca
// también se comía los ojos y las líneas finas.
//
// El degradado se reconstruye con un desenfoque MUY grande, pero pesado por la
// máscara del dorado ("convolución normalizada"): si se desenfocara a secas, el
// negro de los ojos se metería adentro y ensuciaría el dorado de alrededor.
import sharp from 'sharp';

export async function limpiar(entrada, salida, { sigma = 30, corte = 70, rampa = 25 } = {}) {
  const meta = await sharp(entrada).metadata();
  const { data, info } = await sharp(entrada).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const N = W * H;

  // Máscara del dorado, con borde suave para que no quede un escalón.
  const mask = Buffer.alloc(N);
  for (let p = 0; p < N; p++) {
    const i = p*3;
    const l = 0.2126*data[i] + 0.7152*data[i+1] + 0.0722*data[i+2];
    mask[p] = Math.max(0, Math.min(255, Math.round((l - corte) * 255 / rampa)));
  }

  // color x máscara, y la máscara sola, los dos desenfocados igual.
  const pesado = Buffer.alloc(N*3);
  for (let p = 0; p < N; p++) for (let k = 0; k < 3; k++) pesado[p*3+k] = Math.round(data[p*3+k] * mask[p] / 255);
  const raw3 = { raw: { width: W, height: H, channels: 3 } };
  const raw1 = { raw: { width: W, height: H, channels: 1 } };
  const pesadoB = await sharp(pesado, raw3).blur(sigma).raw().toBuffer();
  // OJO: sharp devuelve la máscara desenfocada en 3 canales aunque entre en 1.
  // Leerla como si fuera de 1 canal da rayas horizontales — pasó.
  const maskB   = await sharp(mask,  raw1).blur(sigma).raw().toBuffer();

  const out = Buffer.from(data);
  for (let p = 0; p < N; p++) {
    const w = mask[p] / 255;
    if (!w) continue;
    const dm = maskB[p*3];
    if (dm < 4) continue;                       // sin dorado alrededor, no hay qué reconstruir
    for (let k = 0; k < 3; k++) {
      const suave = Math.min(255, Math.round(pesadoB[p*3+k] * 255 / dm));
      out[p*3+k] = Math.round(data[p*3+k] * (1-w) + suave * w);
    }
  }

  let img = sharp(out, raw3);
  if (meta.hasAlpha) {
    const alfa = await sharp(entrada).extractChannel(3).raw().toBuffer();
    img = img.joinChannel(alfa, raw1);
  }
  await img.png().toFile(salida);
}

if (process.argv[2]) { await limpiar(process.argv[2], process.argv[3]); console.log('limpio:', process.argv[3]); }
