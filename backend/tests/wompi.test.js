// Las firmas de Wompi, sin pasarela ni base de datos: son funciones puras.
//
// Importa porque son las dos únicas cosas que separan "un pago de verdad" de
// "cualquiera que descubrió la dirección del webhook", que es pública.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const requerir = createRequire(import.meta.url);
const {
  aCentavos, firmaIntegridad, valorEnCamino,
  eventoLegitimo, pagoAprobado, referenciaDelEvento, datosCheckout,
} = requerir('../lib/wompi');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

describe('aCentavos', () => {
  it('pasa pesos a centavos', () => {
    expect(aCentavos(80000)).toBe(8000000);
    expect(aCentavos('210000')).toBe(21000000);
  });

  it('redondea en vez de truncar', () => {
    // Un Decimal de la base puede llegar con decimales; truncar perdería un peso.
    expect(aCentavos(80000.005)).toBe(8000001);
    expect(aCentavos(999.99)).toBe(99999);
  });
});

describe('firmaIntegridad', () => {
  it('concatena referencia + centavos + moneda + secreto, en ese orden', () => {
    // El ejemplo de la documentación de Wompi.
    const esperado = sha('sk8-438k4-xmxm392-sn2m2490000COPprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6');
    expect(firmaIntegridad('sk8-438k4-xmxm392-sn2m24', 90000, 'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6'))
      .toBe(esperado);
  });

  it('cambia si cambia el monto: es lo que impide pagar menos', () => {
    const a = firmaIntegridad('REF-1', 8000000, 'secreto');
    const b = firmaIntegridad('REF-1', 100, 'secreto');
    expect(a).not.toBe(b);
  });
});

describe('valorEnCamino', () => {
  it('sigue caminos con puntos', () => {
    const d = { transaction: { id: '1234', status: 'APPROVED' } };
    expect(valorEnCamino(d, 'transaction.id')).toBe('1234');
    expect(valorEnCamino(d, 'transaction.status')).toBe('APPROVED');
  });

  it('lo que no existe da cadena vacía, no revienta', () => {
    expect(valorEnCamino({}, 'transaction.status')).toBe('');
    expect(valorEnCamino(null, 'a.b')).toBe('');
  });
});

// Un evento como el que manda Wompi, firmado con el secreto que se le pase.
function eventoFirmado(secreto, { estado = 'APPROVED', referencia = 'REF-1', timestamp = 1530291411 } = {}) {
  const data = { transaction: { id: '1234-1610641025-49201', status: estado, amount_in_cents: 4490000, reference: referencia } };
  const props = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const cadena = props.map(p => valorEnCamino(data, p)).join('') + String(timestamp) + secreto;
  return {
    event: 'transaction.updated',
    data,
    environment: 'test',
    signature: { properties: props, checksum: sha(cadena) },
    timestamp,
    sent_at: '2026-09-08T16:45:05.000Z',
  };
}

describe('eventoLegitimo', () => {
  it('acepta un evento firmado con el secreto del gimnasio', () => {
    expect(eventoLegitimo(eventoFirmado('secreto-del-gym'), 'secreto-del-gym')).toBe(true);
  });

  it('rechaza el mismo evento con otro secreto', () => {
    expect(eventoLegitimo(eventoFirmado('secreto-del-gym'), 'otro-secreto')).toBe(false);
  });

  it('rechaza si le tocaron el monto después de firmar', () => {
    const e = eventoFirmado('s3cr3t');
    e.data.transaction.amount_in_cents = 100;
    expect(eventoLegitimo(e, 's3cr3t')).toBe(false);
  });

  it('rechaza si le cambiaron el timestamp', () => {
    const e = eventoFirmado('s3cr3t');
    e.timestamp = 999;
    expect(eventoLegitimo(e, 's3cr3t')).toBe(false);
  });

  it('rechaza un cuerpo sin firma, vacío o inventado', () => {
    expect(eventoLegitimo({}, 's3cr3t')).toBe(false);
    expect(eventoLegitimo(null, 's3cr3t')).toBe(false);
    expect(eventoLegitimo({ signature: { properties: [], checksum: 'x' }, timestamp: 1 }, 's3cr3t')).toBe(false);
    expect(eventoLegitimo({ signature: { properties: ['transaction.id'], checksum: 'corto' }, timestamp: 1, data: {} }, 's3cr3t')).toBe(false);
  });

  it('sin secreto configurado no acepta nada', () => {
    // Un gimnasio que no configuró Wompi no puede recibir activaciones.
    expect(eventoLegitimo(eventoFirmado('x'), null)).toBe(false);
    expect(eventoLegitimo(eventoFirmado('x'), '')).toBe(false);
  });
});

describe('pagoAprobado', () => {
  it('solo APPROVED cuenta', () => {
    expect(pagoAprobado(eventoFirmado('s'))).toBe(true);
    expect(pagoAprobado(eventoFirmado('s', { estado: 'DECLINED' }))).toBe(false);
    expect(pagoAprobado(eventoFirmado('s', { estado: 'VOIDED' }))).toBe(false);
    expect(pagoAprobado(eventoFirmado('s', { estado: 'PENDING' }))).toBe(false);
  });

  it('otro tipo de evento no activa nada', () => {
    const e = eventoFirmado('s');
    e.event = 'nequi_token.updated';
    expect(pagoAprobado(e)).toBe(false);
  });
});

describe('referenciaDelEvento', () => {
  it('devuelve la referencia que mandamos nosotros', () => {
    expect(referenciaDelEvento(eventoFirmado('s', { referencia: 'GYM-abc-123' }))).toBe('GYM-abc-123');
    expect(referenciaDelEvento({})).toBeNull();
  });
});

describe('datosCheckout', () => {
  it('arma lo que necesita el navegador, sin soltar el secreto', () => {
    const d = datosCheckout({
      referencia: 'REF-9', pesos: 210000,
      publicKey: 'pub_test_xxx', secretoIntegridad: 'integridad-secreta',
    });
    expect(d.centavos).toBe(21000000);
    expect(d.moneda).toBe('COP');
    expect(d.url).toBe('https://checkout.wompi.co/p/');
    expect(d.firma).toBe(firmaIntegridad('REF-9', 21000000, 'integridad-secreta'));
    // Lo que viaja al navegador no puede contener el secreto por ningún lado.
    expect(JSON.stringify(d)).not.toContain('integridad-secreta');
  });
});
