// Pruebas de las partes puras de routes/sedes.js.
//
// No necesita Postgres: se llaman directamente los helpers que el router
// expone, igual que el resto de la suite.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { validarNombre, interpretarParametroSede } = require('../lib/sedes');

describe('validarNombre', () => {
  it('acepta un nombre normal y le saca los espacios de los bordes', () => {
    expect(validarNombre('Norte')).toBe('Norte');
    expect(validarNombre('  Sede Centro  ')).toBe('Sede Centro');
  });

  it('rechaza lo vacío y lo que no es texto', () => {
    expect(validarNombre('')).toBeNull();
    expect(validarNombre('    ')).toBeNull();
    expect(validarNombre(null)).toBeNull();
    expect(validarNombre(123)).toBeNull();
  });

  it('pone un techo a la longitud', () => {
    expect(validarNombre('x'.repeat(60))).toBe('x'.repeat(60));
    expect(validarNombre('x'.repeat(61))).toBeNull();
  });
});

describe('interpretarParametroSede', () => {
  it('sin sede no filtra: es lo que ve un gimnasio de un solo local', () => {
    expect(interpretarParametroSede(undefined)).toEqual({ filtrar: false });
    expect(interpretarParametroSede(null)).toEqual({ filtrar: false });
    expect(interpretarParametroSede('')).toEqual({ filtrar: false });
    expect(interpretarParametroSede('   ')).toEqual({ filtrar: false });
  });

  it('"todas" tampoco filtra, en cualquier caja', () => {
    expect(interpretarParametroSede('todas')).toEqual({ filtrar: false });
    expect(interpretarParametroSede('Todas')).toEqual({ filtrar: false });
    expect(interpretarParametroSede('TODAS')).toEqual({ filtrar: false });
  });

  it('con un id pide filtrar por esa sede', () => {
    const id = '6a90de396427f0a27655a182';
    expect(interpretarParametroSede(id)).toEqual({ filtrar: true, sedeId: id });
    expect(interpretarParametroSede(' ' + id + ' ')).toEqual({ filtrar: true, sedeId: id });
  });

  it('no decide por su cuenta si la sede existe: eso lo valida la base', () => {
    // Un id inventado igual pide filtrar; quien lo rechaza es sedeDelGym, que
    // comprueba contra el gymId del token.
    expect(interpretarParametroSede('inventado')).toEqual({ filtrar: true, sedeId: 'inventado' });
  });
});
