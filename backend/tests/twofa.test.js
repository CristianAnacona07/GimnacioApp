// Pruebas de corrección del TOTP (RFC 6238 / RFC 4226) implementado en routes/twofa.js.
// Los helpers puros se exponen como propiedades del router exportado (sin tocar rutas).

import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';

let twofa;
beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-para-suite-de-pruebas';
  twofa = await import('../routes/twofa.js');
  twofa = twofa.default; // los helpers cuelgan del objeto default (module.exports)
});

// Vectores de prueba oficiales del RFC 6238 (Appendix B) para el modo SHA-1.
// Secreto ASCII "12345678901234567890" (20 bytes). Códigos de 8 dígitos.
// t es el tiempo Unix en SEGUNDOS; la implementación recibe milisegundos.
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');
const VECTORES_SHA1 = [
  { time: 59, totp: '94287082' },
  { time: 1111111109, totp: '07081804' },
  { time: 1111111111, totp: '14050471' },
  { time: 1234567890, totp: '89005924' },
  { time: 2000000000, totp: '69279037' },
  { time: 20000000000, totp: '65353130' },
];

describe('TOTP — vectores RFC 6238 (SHA-1, 8 dígitos)', () => {
  it.each(VECTORES_SHA1)('t=$time → $totp', ({ time, totp: esperado }) => {
    const code = twofa.totp(RFC_SECRET, 30, 8, time * 1000);
    expect(code).toBe(esperado);
  });
});

describe('TOTP — propiedades generales', () => {
  it('produce 6 dígitos por defecto', () => {
    const code = twofa.totp(RFC_SECRET, 30, 6, 59 * 1000);
    expect(code).toMatch(/^\d{6}$/);
    // Los 6 dígitos deben coincidir con los últimos 6 del vector de 8.
    expect(code).toBe('287082');
  });

  it('el mismo secreto+instante da el mismo código (determinista)', () => {
    const t = 1700000000000;
    expect(twofa.totp(RFC_SECRET, 30, 6, t)).toBe(twofa.totp(RFC_SECRET, 30, 6, t));
  });

  it('secretos distintos dan (casi siempre) códigos distintos', () => {
    const t = 1700000000000;
    const a = twofa.totp(RFC_SECRET, 30, 6, t);
    const b = twofa.totp(Buffer.from('otro-secreto-distinto-20b', 'ascii'), 30, 6, t);
    expect(a).not.toBe(b);
  });
});

describe('base32 encode/decode (RFC 4648)', () => {
  it('round-trip de bytes aleatorios', () => {
    for (let i = 0; i < 20; i++) {
      const buf = crypto.randomBytes(20);
      const enc = twofa.base32Encode(buf);
      expect(enc).toMatch(/^[A-Z2-7]+$/); // alfabeto base32 sin padding
      const dec = twofa.base32Decode(enc);
      expect(Buffer.compare(dec, buf)).toBe(0);
    }
  });

  it('decode ignora minúsculas, espacios y padding', () => {
    const buf = Buffer.from('12345678901234567890', 'ascii');
    const enc = twofa.base32Encode(buf);
    const conRuido = enc.toLowerCase().split('').join(' ') + '==';
    expect(Buffer.compare(twofa.base32Decode(conRuido), buf)).toBe(0);
  });
});

describe('verify — ventana de tolerancia ±1 paso', () => {
  it('acepta el código del paso actual', () => {
    const now = Date.now();
    const code = twofa.totp(RFC_SECRET, 30, 6, now);
    expect(twofa.verify(RFC_SECRET, code)).toBe(true);
  });

  it('acepta el código del paso anterior (-30s)', () => {
    const now = Date.now();
    const code = twofa.totp(RFC_SECRET, 30, 6, now - 30 * 1000);
    expect(twofa.verify(RFC_SECRET, code)).toBe(true);
  });

  it('acepta el código del paso siguiente (+30s)', () => {
    const now = Date.now();
    const code = twofa.totp(RFC_SECRET, 30, 6, now + 30 * 1000);
    expect(twofa.verify(RFC_SECRET, code)).toBe(true);
  });

  it('rechaza un código fuera de ventana (-90s)', () => {
    const now = Date.now();
    const code = twofa.totp(RFC_SECRET, 30, 6, now - 90 * 1000);
    expect(twofa.verify(RFC_SECRET, code)).toBe(false);
  });

  it('rechaza formatos no válidos', () => {
    expect(twofa.verify(RFC_SECRET, '')).toBe(false);
    expect(twofa.verify(RFC_SECRET, '12345')).toBe(false);   // 5 dígitos
    expect(twofa.verify(RFC_SECRET, '1234567')).toBe(false); // 7 dígitos
    expect(twofa.verify(RFC_SECRET, 'abcdef')).toBe(false);
    expect(twofa.verify(RFC_SECRET, null)).toBe(false);
  });

  it('rechaza cuando el secreto está vacío', () => {
    expect(twofa.verify(Buffer.alloc(0), '000000')).toBe(false);
  });
});

describe('hashBackup', () => {
  it('produce SHA-256 hex determinista de 64 chars', () => {
    const h = twofa.hashBackup('CODE-1234');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(twofa.hashBackup('CODE-1234'));
    expect(h).not.toBe(twofa.hashBackup('CODE-1235'));
    // Coincide con el cálculo directo.
    expect(h).toBe(crypto.createHash('sha256').update('CODE-1234').digest('hex'));
  });
});
