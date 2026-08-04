// Pruebas de los helpers puros de CSV expuestos por routes/admin.js
// (escaparCSV, construirCSV, fechaISO) y de la aritmética de paginación
// tal cual la calcula la ruta GET /audit.

import { describe, it, expect, beforeAll } from 'vitest';

let admin;
beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-para-suite-de-pruebas';
  const mod = await import('../routes/admin.js');
  admin = mod.default; // helpers colgados del router exportado
});

describe('escaparCSV', () => {
  it('deja pasar valores simples sin comillas', () => {
    expect(admin.escaparCSV('hola')).toBe('hola');
    expect(admin.escaparCSV('juan@mail.com')).toBe('juan@mail.com');
    expect(admin.escaparCSV(123)).toBe('123');
  });

  it('convierte null/undefined en cadena vacía', () => {
    expect(admin.escaparCSV(null)).toBe('');
    expect(admin.escaparCSV(undefined)).toBe('');
  });

  it('entrecomilla y duplica comillas cuando hay coma', () => {
    expect(admin.escaparCSV('Pérez, Juan')).toBe('"Pérez, Juan"');
  });

  it('duplica las comillas dobles internas', () => {
    expect(admin.escaparCSV('dice "hola"')).toBe('"dice ""hola"""');
  });

  it('entrecomilla cuando hay saltos de línea (defensa ante inyección de filas)', () => {
    expect(admin.escaparCSV('a\nb')).toBe('"a\nb"');
    expect(admin.escaparCSV('a\rb')).toBe('"a\rb"');
  });
});

describe('construirCSV', () => {
  it('genera cabecera + filas separadas por \\n', () => {
    const csv = admin.construirCSV(['nombre', 'email'], [
      ['Juan', 'juan@mail.com'],
      ['Ana', 'ana@mail.com'],
    ]);
    expect(csv).toBe('nombre,email\nJuan,juan@mail.com\nAna,ana@mail.com');
  });

  it('escapa correctamente los campos con comas dentro de las filas', () => {
    const csv = admin.construirCSV(['a', 'b'], [['x,y', 'z']]);
    expect(csv).toBe('a,b\n"x,y",z');
  });

  it('soporta cero filas (solo cabecera)', () => {
    expect(admin.construirCSV(['a', 'b'], [])).toBe('a,b');
  });
});

describe('fechaISO', () => {
  it('convierte una fecha válida a ISO', () => {
    expect(admin.fechaISO('2026-07-04T00:00:00.000Z')).toBe('2026-07-04T00:00:00.000Z');
  });
  it('devuelve cadena vacía para falsy o fecha inválida', () => {
    expect(admin.fechaISO(null)).toBe('');
    expect(admin.fechaISO('')).toBe('');
    expect(admin.fechaISO('no-es-fecha')).toBe('');
  });
});

// Aritmética de paginación de GET /audit. Reproduce las EXACTAS expresiones
// del handler para verificar los invariantes de clamping y desplazamiento.
// page = max(1, parseInt(page)||1); limit = min(100, max(1, parseInt(limit)||20))
// skip = (page-1)*limit; pages = ceil(total/limit)
function paginar(pageRaw, limitRaw, total) {
  const page = Math.max(1, parseInt(pageRaw, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 20));
  const skip = (page - 1) * limit;
  const pages = Math.ceil(total / limit);
  return { page, limit, skip, pages };
}

describe('paginación (GET /audit)', () => {
  it('valores por defecto: page=1, limit=20', () => {
    expect(paginar(undefined, undefined, 55)).toEqual({ page: 1, limit: 20, skip: 0, pages: 3 });
  });

  it('calcula skip correctamente', () => {
    expect(paginar('3', '10', 100)).toEqual({ page: 3, limit: 10, skip: 20, pages: 10 });
  });

  it('clamp de limit a un máximo de 100', () => {
    expect(paginar('1', '9999', 500).limit).toBe(100);
  });

  it('clamp de limit a un mínimo de 1', () => {
    expect(paginar('1', '0', 5).limit).toBe(20);   // 0 es falsy -> default 20
    expect(paginar('1', '-5', 5).limit).toBe(1);   // -5 -> max(1, -5)=1
  });

  it('clamp de page a un mínimo de 1', () => {
    expect(paginar('0', '10', 5).page).toBe(1);
    expect(paginar('-3', '10', 5).page).toBe(1);
  });

  it('entradas no numéricas caen al valor por defecto', () => {
    const r = paginar('abc', 'xyz', 40);
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
    expect(r.pages).toBe(2);
  });

  it('total=0 produce 0 páginas', () => {
    expect(paginar('1', '20', 0).pages).toBe(0);
  });
});
