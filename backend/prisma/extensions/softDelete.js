const { Prisma } = require('@prisma/client');

/**
 * Reemplaza a backend/models/plugins/softDelete.js (Mongoose).
 *
 * Añade `deletedAt` (null = activo) y hace que las lecturas/actualizaciones de
 * los modelos con soft-delete excluyan automáticamente las filas borradas,
 * salvo que la query pase `{ withDeleted: true }`.
 *
 * Uso: `model.softDelete(where)` marca deletedAt; `model.restore(where)` lo limpia.
 * Para ver borrados: `prisma.gym.findMany({ where: {...}, withDeleted: true })`.
 *
 * La lógica de cada pieza vive en funciones puras exportadas aparte (applyFilter,
 * argsSoftDelete, argsRestore, esSoftDeletable) para poder probarla sin conexión
 * a una base de datos real, igual que se probaba el pre-hook de Mongoose antes.
 */
const SOFT_DELETE_MODELS = ['Gym', 'Noticia', 'MetodoPago', 'Plan', 'PlanPlataforma', 'Rutina', 'Transaccion', 'User'];

function esSoftDeletable(modelName) {
  return SOFT_DELETE_MODELS.includes(modelName);
}

// Inyecta { deletedAt: null } en el `where` de una query, salvo que traiga
// `withDeleted: true` (en cuyo caso se retira ese flag antes de pasar la query).
function applyFilter(args) {
  if (args?.withDeleted) {
    const { withDeleted, ...rest } = args;
    return rest;
  }
  return { ...args, where: { ...(args?.where ?? {}), deletedAt: null } };
}

// Args que produce `model.softDelete(where)`.
function argsSoftDelete(where) {
  return { where, data: { deletedAt: new Date() } };
}

// Args que produce `model.restore(where)` — necesita `withDeleted: true` para
// poder alcanzar filas que ya están marcadas como borradas.
function argsRestore(where) {
  return { where, data: { deletedAt: null }, withDeleted: true };
}

// Único punto de intercepción reusado por las 6 operaciones hookeadas.
async function interceptar({ model, args, query }) {
  return query(esSoftDeletable(model) ? applyFilter(args) : args);
}

const softDeleteExtension = Prisma.defineExtension((prisma) =>
  prisma.$extends({
    name: 'softDelete',
    query: {
      $allModels: {
        findMany: interceptar,
        findFirst: interceptar,
        findUnique: interceptar,
        count: interceptar,
        update: interceptar,
        updateMany: interceptar,
      },
    },
    model: {
      $allModels: {
        async softDelete(where) {
          const ctx = Prisma.getExtensionContext(this);
          if (!esSoftDeletable(ctx.$name)) {
            throw new Error(`${ctx.$name} no tiene soft-delete`);
          }
          return ctx.updateMany(argsSoftDelete(where));
        },
        async restore(where) {
          const ctx = Prisma.getExtensionContext(this);
          if (!esSoftDeletable(ctx.$name)) {
            throw new Error(`${ctx.$name} no tiene soft-delete`);
          }
          return ctx.updateMany(argsRestore(where));
        },
      },
    },
  })
);

module.exports = {
  softDeleteExtension,
  SOFT_DELETE_MODELS,
  esSoftDeletable,
  applyFilter,
  argsSoftDelete,
  argsRestore,
  interceptar,
};
