// Pruebas de la extensión de soft-delete de Prisma (prisma/extensions/softDelete.js),
// que reemplaza a models/plugins/softDelete.js (Mongoose).
//
// No requiere una conexión a Postgres real: se llaman directamente las
// funciones puras que la extensión usa por dentro (applyFilter, argsSoftDelete,
// argsRestore, interceptar), igual que el test original invocaba el pre-hook
// de Mongoose directamente sin conectar a Mongo.

import { describe, it, expect, vi } from 'vitest';
import {
  SOFT_DELETE_MODELS,
  esSoftDeletable,
  applyFilter,
  argsSoftDelete,
  argsRestore,
  interceptar,
} from '../prisma/extensions/softDelete.js';

describe('esSoftDeletable', () => {
  it('es true para los 7 modelos con borrado suave', () => {
    for (const modelo of ['Gym', 'Noticia', 'MetodoPago', 'Plan', 'Rutina', 'Transaccion', 'User']) {
      expect(esSoftDeletable(modelo)).toBe(true);
    }
    expect(SOFT_DELETE_MODELS).toHaveLength(7);
  });

  it('es false para modelos sin borrado suave (Asistencia, AuditLog, Dispositivo, Feedback, Medidas, Progreso)', () => {
    for (const modelo of ['Asistencia', 'AuditLog', 'Dispositivo', 'Feedback', 'Medidas', 'Progreso']) {
      expect(esSoftDeletable(modelo)).toBe(false);
    }
  });
});

describe('applyFilter: filtrado automático en lecturas', () => {
  it('findMany/findFirst/etc. reciben { deletedAt: null } añadido al where', () => {
    const args = applyFilter({ where: { nombre: 'x' } });
    expect(args.where).toMatchObject({ nombre: 'x', deletedAt: null });
  });

  it('funciona igual sin un `where` previo', () => {
    const args = applyFilter({});
    expect(args.where).toEqual({ deletedAt: null });
  });

  it('con { withDeleted: true } NO se añade el filtro, y el flag se retira de los args', () => {
    const args = applyFilter({ where: { nombre: 'z' }, withDeleted: true });
    expect(args.where).toEqual({ nombre: 'z' });
    expect(args.where.deletedAt).toBeUndefined();
    expect(args.withDeleted).toBeUndefined();
  });

  it('preserva el resto de argumentos (select, orderBy, take...)', () => {
    const args = applyFilter({ where: { a: 1 }, select: { id: true }, take: 5 });
    expect(args.select).toEqual({ id: true });
    expect(args.take).toBe(5);
  });
});

describe('interceptar: único punto de enganche de las 6 operaciones', () => {
  it('en un modelo con soft-delete, pasa el where filtrado a `query`', async () => {
    const query = vi.fn().mockResolvedValue('resultado');
    const resultado = await interceptar({ model: 'Gym', args: { where: { slug: 'kodiak' } }, query });

    expect(query).toHaveBeenCalledWith({ where: { slug: 'kodiak', deletedAt: null } });
    expect(resultado).toBe('resultado');
  });

  it('en un modelo SIN soft-delete, pasa los args tal cual, sin tocar nada', async () => {
    const query = vi.fn().mockResolvedValue('ok');
    const argsOriginales = { where: { gymId: 'g1' } };
    await interceptar({ model: 'Asistencia', args: argsOriginales, query });

    expect(query).toHaveBeenCalledWith(argsOriginales);
  });

  it('respeta withDeleted:true también a través de este punto de enganche', async () => {
    const query = vi.fn().mockResolvedValue('ok');
    await interceptar({ model: 'User', args: { where: { id: 'u1' }, withDeleted: true }, query });

    expect(query).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });
});

describe('argsSoftDelete / argsRestore: lo que produce model.softDelete()/model.restore()', () => {
  it('softDelete(where) marca deletedAt con la fecha actual', () => {
    const antes = Date.now();
    const args = argsSoftDelete({ id: 'x1' });
    expect(args.where).toEqual({ id: 'x1' });
    expect(args.data.deletedAt).toBeInstanceOf(Date);
    expect(args.data.deletedAt.getTime()).toBeGreaterThanOrEqual(antes);
  });

  it('restore(where) limpia deletedAt y pide withDeleted:true para alcanzar filas ya borradas', () => {
    const args = argsRestore({ id: 'x1' });
    expect(args).toEqual({ where: { id: 'x1' }, data: { deletedAt: null }, withDeleted: true });
  });
});
