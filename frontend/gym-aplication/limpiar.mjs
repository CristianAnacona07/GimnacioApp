// Quita la marca de agua de turbologo reconstruyendo el dorado que hay debajo.
//
// La marca es texto en un tono más oscuro, con trazos de ~12 px, encima de un
// dorado que es un degradado suave. Una mediana de ventana grande borra lo más
// fino que ella y respeta los bordes grandes: sirve de "cómo se vería el
// dorado sin la marca". Solo se usa donde de verdad hay marca, y con el borde
// difuminado para que no queden parches con contorno.
import sharp from 'sharp';

export async function limpiar(entrada, salida, { ventana = 15, umbral = 4, rampa = 6 } = {}) {
  const meta = await sharp(entrada).metadata();
  const orig = await sharp(entrada).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const med  = await sharp(entrada).removeAlpha().median(ventana).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = orig.info;
  const L = (b, i) => 0.2126*b[i] + 0.7152*b[i+1] + 0.0722*b[i+2];

  // Peso de mezcla: 0 = dejar el original, 255 = usar el reconstruido.
  const peso = Buffer.alloc(W * H);
  let tocados = 0;
  for (let p = 0; p < W*H; p++) {
    const i = p*3;
    const lo = L(orig.data, i), lm = L(med.data, i);
    // Solo dentro del dorado, y con los DOS por encima del negro: así los
    // bordes de los ojos y los colmillos (donde la mediana también difiere
    // mucho) quedan fuera y no se redondean.
    if (lm < 80 || lo < 60) continue;
    const d = lm - lo;
    if (d <= umbral) continue;
    peso[p] = Math.min(255, Math.round((d - umbral) * 255 / rampa));
    tocados++;
  }
  // Difuminar el peso: sin esto el parche tiene contorno.
  const pesoSuave = await sharp(peso, { raw: { width: W, height: H, channels: 1 } })
    .blur(2.5).raw().toBuffer();

  const salidaBuf = Buffer.from(orig.data);
  for (let p = 0; p < W*H; p++) {
    const w = pesoSuave[p] / 255;
    if (!w) continue;
    for (let k = 0; k < 3; k++) {
      const i = p*3 + k;
      salidaBuf[i] = Math.round(orig.data[i] * (1 - w) + med.data[i] * w);
    }
  }

  let img = sharp(salidaBuf, { raw: { width: W, height: H, channels: 3 } });
  // Si el original tenía canal alfa, se le devuelve el suyo intacto.
  if (meta.hasAlpha) {
    const alfa = await sharp(entrada).extractChannel(3).raw().toBuffer();
    img = img.joinChannel(alfa, { raw: { width: W, height: H, channels: 1 } });
  }
  await img.png().toFile(salida);
  return { tocados, total: W*H, pct: 100*tocados/(W*H) };
}

if (process.argv[2]) {
  const r = await limpiar(process.argv[2], process.argv[3]);
  console.log(`${process.argv[2]} → tocado el ${r.pct.toFixed(2)}% de los píxeles`);
}
