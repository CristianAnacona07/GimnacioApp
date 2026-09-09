import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import authRouter from '../routes/auth.js';

const { hashLlave, FORMATO_LLAVE } = authRouter;

// Lo que se prueba acá es lo que sostiene la seguridad de "entrar con huella":
// que la llave nunca se pueda deducir de lo guardado, y que una llave con
// cualquier otra forma quede afuera antes de tocar la base.
describe('llaves de celular vinculado', () => {
  describe('hashLlave', () => {
    it('devuelve el sha256 en hexadecimal', () => {
      const llave = 'a'.repeat(64);
      const esperado = crypto.createHash('sha256').update(llave).digest('hex');
      expect(hashLlave(llave)).toBe(esperado);
      expect(hashLlave(llave)).toHaveLength(64);
    });

    it('no se parece a la llave: lo guardado no sirve para entrar', () => {
      const llave = crypto.randomBytes(32).toString('hex');
      expect(hashLlave(llave)).not.toBe(llave);
    });

    it('la misma llave da siempre el mismo hash', () => {
      // Si no, la búsqueda por llave_hash del login no encontraría nunca nada.
      const llave = crypto.randomBytes(32).toString('hex');
      expect(hashLlave(llave)).toBe(hashLlave(llave));
    });

    it('dos llaves distintas dan hashes distintos', () => {
      expect(hashLlave('a'.repeat(64))).not.toBe(hashLlave('b'.repeat(64)));
    });
  });

  describe('FORMATO_LLAVE', () => {
    it('acepta una llave real', () => {
      expect(FORMATO_LLAVE.test(crypto.randomBytes(32).toString('hex'))).toBe(true);
    });

    it('rechaza lo que no tenga la forma exacta', () => {
      const malas = [
        '',                       // vacía
        'a'.repeat(63),           // corta
        'a'.repeat(65),           // larga
        'A'.repeat(64),           // mayúsculas: hex se genera en minúscula
        'g'.repeat(64),           // fuera del alfabeto hexadecimal
        `${'a'.repeat(63)} `,     // con espacio al final
        `${'a'.repeat(64)}\n`     // con salto de línea
      ];
      for (const mala of malas) {
        expect(FORMATO_LLAVE.test(mala)).toBe(false);
      }
    });

    it('no se deja engañar por un salto de línea en el medio', () => {
      // Sin anclas por línea, un `$` mal puesto dejaría pasar esto.
      expect(FORMATO_LLAVE.test(`${'a'.repeat(64)}\nloquesea`)).toBe(false);
    });
  });
});
