const crypto = require('crypto');

/**
 * Wompi: firmas de ida y de vuelta.
 *
 * Todo lo de acá es puro a propósito (entra texto, sale texto) para poder
 * probarlo sin pasarela ni base de datos. Lo que toca la red y la base vive en
 * routes/wompi.js.
 */

const MONEDA = 'COP';

/** Wompi trabaja en centavos; los precios del gimnasio están en pesos. */
function aCentavos(pesos) {
  // Redondear y no truncar: 80000.005 debe dar 8000001, no 8000000.
  return Math.round(Number(pesos) * 100);
}

/**
 * La firma que valida el checkout antes de cobrar. Sin esto, cualquiera podría
 * abrir el checkout del gimnasio y cambiar el monto en la URL.
 *
 * Orden exacto: referencia + centavos + moneda + secreto de integridad.
 */
function firmaIntegridad(referencia, centavos, secretoIntegridad, moneda = MONEDA) {
  const cadena = `${referencia}${centavos}${moneda}${secretoIntegridad}`;
  return crypto.createHash('sha256').update(cadena).digest('hex');
}

/**
 * Lee un valor anidado siguiendo un camino con puntos: 'transaction.status'.
 * Wompi manda en cada evento qué propiedades entraron en la firma, así que el
 * camino no se puede dar por sentado.
 */
function valorEnCamino(objeto, camino) {
  return String(camino.split('.').reduce((o, k) => (o == null ? undefined : o[k]), objeto) ?? '');
}

/**
 * Comprueba que el evento viene de Wompi y no de cualquiera que descubrió la
 * dirección del webhook, que es pública.
 *
 * El checksum es SHA-256 de: los valores de las propiedades firmadas (en el
 * orden en que Wompi las lista) + el timestamp + el secreto de eventos.
 */
function eventoLegitimo(cuerpo, secretoEventos) {
  if (!secretoEventos) return false;
  const props = cuerpo?.signature?.properties;
  const recibido = cuerpo?.signature?.checksum;
  if (!Array.isArray(props) || !props.length || typeof recibido !== 'string') return false;
  if (cuerpo.timestamp === undefined || cuerpo.timestamp === null) return false;

  const cadena = props.map((p) => valorEnCamino(cuerpo.data, p)).join('') +
                 String(cuerpo.timestamp) + secretoEventos;
  const calculado = crypto.createHash('sha256').update(cadena).digest('hex');

  // Comparación de tiempo constante: comparar con === filtra por dónde falla y
  // deja adivinar el checksum byte a byte.
  const a = Buffer.from(calculado, 'utf8');
  const b = Buffer.from(recibido.toLowerCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** ¿Este evento dice que el pago entró? */
function pagoAprobado(cuerpo) {
  return cuerpo?.event === 'transaction.updated' &&
         cuerpo?.data?.transaction?.status === 'APPROVED';
}

/** La referencia que mandamos nosotros y Wompi devuelve tal cual. */
function referenciaDelEvento(cuerpo) {
  return cuerpo?.data?.transaction?.reference || null;
}

/**
 * Lo que el navegador necesita para abrir el checkout. El secreto de integridad
 * se usa acá y no sale: solo viaja la firma ya calculada.
 */
function datosCheckout({ referencia, pesos, publicKey, secretoIntegridad, redirectUrl }) {
  const centavos = aCentavos(pesos);
  return {
    url: 'https://checkout.wompi.co/p/',
    publicKey,
    moneda: MONEDA,
    centavos,
    referencia,
    firma: firmaIntegridad(referencia, centavos, secretoIntegridad),
    redirectUrl: redirectUrl || undefined,
  };
}

module.exports = {
  MONEDA,
  aCentavos,
  firmaIntegridad,
  valorEnCamino,
  eventoLegitimo,
  pagoAprobado,
  referenciaDelEvento,
  datosCheckout,
};
