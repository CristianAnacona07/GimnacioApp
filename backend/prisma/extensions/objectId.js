const { ObjectId } = require('bson');
const { Prisma } = require('@prisma/client');

// Genera un id con forma de ObjectId de Mongo (24 hex) en cada create/createMany
// que no traiga id explícito, para mantener el mismo formato que los datos
// migrados desde MongoDB.
//
// OJO: esto sólo intercepta operaciones de nivel superior (p.ej. `rutina.create`).
// Un `create` anidado dentro de una relación (p.ej. `{ ejercicios: { create: [...] } }`)
// NO pasa por este hook — hay que generar esos ids a mano (ver lib/rutinaMapper.js).
const objectIdExtension = Prisma.defineExtension((prisma) =>
  prisma.$extends({
    name: 'objectId',
    query: {
      $allModels: {
        async create({ args, query }) {
          args.data = args.data ?? {};
          if (!args.data.id) args.data.id = new ObjectId().toHexString();
          return query(args);
        },
        async createMany({ args, query }) {
          const rows = Array.isArray(args.data) ? args.data : [args.data];
          for (const row of rows) {
            if (!row.id) row.id = new ObjectId().toHexString();
          }
          return query(args);
        },
      },
    },
  })
);

module.exports = { objectIdExtension };
