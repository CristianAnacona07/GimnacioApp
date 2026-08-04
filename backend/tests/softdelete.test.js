// Pruebas del plugin de borrado lógico (models/plugins/softDelete.js).
// No requiere una conexión a MongoDB: se construye una Query real de Mongoose y
// se invoca directamente el pre-hook registrado por el plugin, comprobando que
// añade { deletedAt: null } al filtro (salvo con { withDeleted: true }).

import { describe, it, expect, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import softDelete from '../models/plugins/softDelete.js';

let Modelo;
let schema;
beforeAll(() => {
  schema = new mongoose.Schema({ nombre: String });
  schema.plugin(softDelete);
  // Nombre único para no colisionar con otros modelos registrados.
  Modelo = mongoose.model('SoftDeleteTest_' + Date.now(), schema);
});

// Invoca de forma síncrona y determinista el pre-hook que el plugin registró
// para la operación `name`, con la Query `q` como contexto (`this`), y devuelve
// el filtro resultante. El hook del plugin es una función síncrona sin `next`.
function filtroTrasHook(q, name) {
  const entry = schema.s.hooks._pres.get(name)[0];
  const fn = entry.fn || entry;
  fn.call(q);
  return q.getFilter();
}

describe('softDelete: campo deletedAt', () => {
  it('añade el campo deletedAt al esquema con default null', () => {
    const path = Modelo.schema.path('deletedAt');
    expect(path).toBeTruthy();
    expect(path.instance).toBe('Date');
    expect(path.options.default).toBeNull();
  });

  it('expone los métodos estáticos softDelete y restore', () => {
    expect(typeof Modelo.softDelete).toBe('function');
    expect(typeof Modelo.restore).toBe('function');
  });

  it('registra el pre-hook en todas las operaciones de lectura/actualización', () => {
    const pres = schema.s.hooks._pres;
    for (const op of ['find', 'findOne', 'findOneAndUpdate', 'countDocuments',
      'count', 'updateMany', 'updateOne', 'findOneAndDelete']) {
      expect(pres.get(op)?.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('softDelete: filtrado automático en lecturas', () => {
  it('find() añade { deletedAt: null }', () => {
    const filtro = filtroTrasHook(Modelo.find({ nombre: 'x' }), 'find');
    expect(filtro).toMatchObject({ nombre: 'x', deletedAt: null });
  });

  it('findOne() añade { deletedAt: null }', () => {
    const filtro = filtroTrasHook(Modelo.findOne({ nombre: 'y' }), 'findOne');
    expect(filtro).toMatchObject({ nombre: 'y', deletedAt: null });
  });

  it('countDocuments() añade { deletedAt: null }', () => {
    const filtro = filtroTrasHook(Modelo.countDocuments({ nombre: 'c' }), 'countDocuments');
    expect(filtro).toMatchObject({ nombre: 'c', deletedAt: null });
  });

  it('con { withDeleted: true } NO se añade el filtro', () => {
    const q = Modelo.find({ nombre: 'z' }).setOptions({ withDeleted: true });
    const filtro = filtroTrasHook(q, 'find');
    expect(filtro).toMatchObject({ nombre: 'z' });
    expect(filtro.deletedAt).toBeUndefined();
  });

  it('updateOne() también queda restringido a documentos no borrados', () => {
    const filtro = filtroTrasHook(Modelo.updateOne({ nombre: 'u' }, { $set: {} }), 'updateOne');
    expect(filtro).toMatchObject({ nombre: 'u', deletedAt: null });
  });
});
