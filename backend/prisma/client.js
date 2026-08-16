const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { objectIdExtension } = require('./extensions/objectId');
const { softDeleteExtension } = require('./extensions/softDelete');

// Campos que Mongoose marcaba select:false (password, tokens, 2FA). Prisma no
// tiene un equivalente declarativo: se excluyen aquí por defecto y cada sitio
// que hoy hace `.select('+password')` etc. debe pasar `omit: { password: false }`
// explícitamente en esa query puntual.
const OMIT_SENSIBLES = {
  user: {
    password: true,
    verifyToken: true,
    verifyTokenExpiry: true,
    twoFactorSecret: true,
    twoFactorBackupCodes: true,
  },
  dispositivo: {
    apiKeyHash: true,
  },
};

let client = null;

function getPrismaClient() {
  if (client) return client;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está definido. Configura las variables de entorno antes de arrancar.');
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const base = new PrismaClient({ adapter, omit: OMIT_SENSIBLES });
  client = base.$extends(objectIdExtension).$extends(softDeleteExtension);
  return client;
}

module.exports = { getPrismaClient };
