// Pruebas del buscador global (routes/buscador.js).
//
// Lo que se comprueba aquí no es que encuentre cosas, sino QUÉ PUEDE VER cada
// rol: es la única barrera entre "buscar a un socio" y "listar el gimnasio
// entero desde otra cuenta". Se prueban los helpers puros que la ruta cuelga
// del router, así no hace falta una base de datos real (igual que tests/csv.test.js).

import { describe, it, expect, beforeAll } from 'vitest';

let buscador;
beforeAll(async () => {
  const mod = await import('../routes/buscador.js');
  buscador = mod.default;
});

const req = (role, { userId = 'yo', gymId = 'gymA' } = {}) => ({
  userRole: role,
  userId,
  gymId
});

describe('filtroPersonas — alcance por rol', () => {
  it('el socio no puede buscar personas en absoluto', () => {
    expect(buscador.filtroPersonas(req('socio'), 'juan')).toBeNull();
  });

  it('el entrenador solo alcanza a los socios que tiene asignados', () => {
    const filtro = buscador.filtroPersonas(req('entrenador', { userId: 'entr1' }), 'juan');

    expect(filtro.gymId).toBe('gymA');
    expect(filtro.role).toBe('socio');
    expect(filtro.entrenadorId).toBe('entr1');
  });

  it('el admin busca socios, entrenadores y admins, sin atarse a un entrenador', () => {
    const filtro = buscador.filtroPersonas(req('admin'), 'juan');

    expect(filtro.gymId).toBe('gymA');
    expect(filtro.role).toEqual({ in: ['socio', 'entrenador', 'admin'] });
    expect(filtro.entrenadorId).toBeUndefined();
  });

  it('siempre queda atado al gimnasio de quien pregunta', () => {
    for (const rol of ['admin', 'superadmin', 'entrenador']) {
      const filtro = buscador.filtroPersonas(req(rol, { gymId: 'gymB' }), 'juan');
      expect(filtro.gymId).toBe('gymB');
    }
  });

  it('busca por nombre, correo, cédula (ILIKE insensible a mayúsculas) y código exacto', () => {
    const filtro = buscador.filtroPersonas(req('admin'), '123456');
    const claves = filtro.OR.map((c) => Object.keys(c)[0]);

    expect(claves).toEqual(['nombre', 'email', 'identificacion', 'codigoAcceso']);
    // nombre/email/identificacion van por ILIKE (contains, insensitive)...
    expect(filtro.OR[0]).toEqual({ nombre: { contains: '123456', mode: 'insensitive' } });
    // ...el código va literal, no por ILIKE: es un valor exacto de 6 dígitos.
    expect(filtro.OR[3].codigoAcceso).toBe('123456');
  });
});

describe('ordenarPorRol', () => {
  it('pone los socios delante de entrenadores y admins', () => {
    const orden = buscador
      .ordenarPorRol([{ role: 'admin' }, { role: 'entrenador' }, { role: 'socio' }])
      .map((p) => p.role);

    expect(orden).toEqual(['socio', 'entrenador', 'admin']);
  });

  it('no muta la lista original', () => {
    const original = [{ role: 'admin' }, { role: 'socio' }];
    buscador.ordenarPorRol(original);
    expect(original[0].role).toBe('admin');
  });
});

describe('aPersona — forma de la respuesta', () => {
  it('no filtra campos sensibles y calcula los días restantes', () => {
    const enTresDias = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const salida = buscador.aPersona({
      id: 'u1',
      nombre: 'Juan',
      email: 'j@x.com',
      role: 'socio',
      password: 'hash-que-no-debe-salir',
      twoFactorSecret: 'tampoco',
      fechaVencimiento: enTresDias,
      identificacion: '109',
      telefono: '300'
    });

    expect(salida._id).toBe('u1');
    expect(salida.password).toBeUndefined();
    expect(salida.twoFactorSecret).toBeUndefined();
    expect(salida.identificacion).toBe('109');
    // El teléfono tampoco viaja: la lupa no lo muestra.
    expect(salida.telefono).toBeUndefined();
    expect(salida.diasRestantes).toBe(3);
  });

  it('devuelve días negativos cuando la membresía ya venció', () => {
    const haceDosDias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const salida = buscador.aPersona({ id: 'u1', nombre: 'Ana', role: 'socio', fechaVencimiento: haceDosDias });

    expect(salida.diasRestantes).toBeLessThan(0);
  });

  it('devuelve null cuando no hay membresía, para distinguirlo de "vencida"', () => {
    const salida = buscador.aPersona({ id: 'u1', nombre: 'Ana', role: 'socio' });

    expect(salida.diasRestantes).toBeNull();
  });

  it('rellena con cadena vacía lo que el socio no tenga cargado', () => {
    const salida = buscador.aPersona({ id: 'u1', nombre: 'Ana', role: 'socio' });

    expect(salida.fotoUrl).toBe('');
    expect(salida.codigoAcceso).toBe('');
    expect(salida.identificacion).toBe('');
  });
});
