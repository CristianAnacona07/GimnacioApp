require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getPrismaClient } = require('../prisma/client');

// Credenciales por variables de entorno (no hardcodear secretos en el repo).
// Uso: SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... node scripts/crear-superadmin.js
const EMAIL    = (process.env.SUPERADMIN_EMAIL || '').toLowerCase().trim();
const PASSWORD = process.env.SUPERADMIN_PASSWORD || '';

async function crear() {
  if (!EMAIL || !PASSWORD) {
    console.error('❌ Define SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD como variables de entorno.');
    process.exit(1);
  }

  const prisma = getPrismaClient();
  await prisma.$queryRaw`SELECT 1`;
  console.log('✅ Conectado');

  // El unique compuesto es (email, gym_id); el superadmin vive con gymId null
  // (además hay un índice único parcial que impide dos superadmins con el mismo email).
  const existe = await prisma.user.findFirst({ where: { email: EMAIL, gymId: null } });
  if (existe) {
    if (existe.role !== 'superadmin') {
      await prisma.user.update({ where: { id: existe.id }, data: { role: 'superadmin', gymId: null } });
      console.log('✅ Rol actualizado a superadmin:', EMAIL);
    } else {
      console.log('ℹ️  Ya es superadmin:', EMAIL);
    }
    await prisma.$disconnect();
    return;
  }

  const salt = await bcrypt.genSalt(10);
  await prisma.user.create({
    data: {
      nombre:   'Super Admin',
      email:    EMAIL,
      password: await bcrypt.hash(PASSWORD, salt),
      role:     'superadmin',
      gymId:    null
    }
  });

  console.log('✅ Superadmin creado:', EMAIL);
  console.log('🔑 Contraseña temporal:', PASSWORD);
  console.log('⚠️  Cambiala desde la app lo antes posible.');
  await prisma.$disconnect();
}

crear().catch(err => { console.error('❌', err.message); process.exit(1); });
