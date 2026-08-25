/**
 * Rescate de una cuenta superadmin bloqueada.
 *
 * Existe para el caso en que el dueño de la cuenta no puede entrar y tampoco
 * puede recuperarla por correo (SMTP caído, credenciales de Gmail vencidas,
 * etc.). `crear-superadmin.js` NO sirve para esto: si la cuenta ya existe se
 * limita a informar "ya es superadmin" y no toca la contraseña.
 *
 * Por defecto solo DIAGNOSTICA — imprime el estado de la cuenta y no escribe
 * nada. Mismo criterio que scripts/etl-mongo-to-postgres.js: para que escriba
 * hay que pedírselo explícitamente.
 *
 *   # 1) ver qué pasa con la cuenta (no modifica nada)
 *   node scripts/rescatar-superadmin.js
 *
 *   # 2) fijarle una contraseña nueva
 *   RESCATE_EMAIL=alguien@ejemplo.com RESCATE_PASSWORD='clave-larga-nueva' \
 *     CONFIRMAR_RESCATE=si node scripts/rescatar-superadmin.js
 *
 * Dentro del VPS se corre a través del contenedor:
 *   docker compose -f docker-compose.prod.yml exec backend \
 *     env RESCATE_EMAIL=... RESCATE_PASSWORD='...' CONFIRMAR_RESCATE=si \
 *     node scripts/rescatar-superadmin.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getPrismaClient } = require('../prisma/client');

const EMAIL     = (process.env.RESCATE_EMAIL || '').toLowerCase().trim();
const PASSWORD  = process.env.RESCATE_PASSWORD || '';
const CONFIRMAR = process.env.CONFIRMAR_RESCATE === 'si';

async function main() {
  const prisma = getPrismaClient();
  await prisma.$queryRaw`SELECT 1`;

  // withDeleted: la causa más común de "credenciales incorrectas" con la
  // contraseña correcta es que la fila está borrada en blando — la extensión
  // de soft delete la filtra y el login no encuentra a nadie.
  // omit password:false — el cliente lo oculta por defecto (prisma/client.js),
  // y sin esto `s.password` sería undefined en TODAS las filas y el
  // diagnóstico informaría "sin contraseña" hasta para cuentas que sí tienen.
  const superadmins = await prisma.user.findMany({
    where: { role: 'superadmin', gymId: null },
    orderBy: { createdAt: 'asc' },
    omit: { password: false },
    withDeleted: true
  });

  console.log(`\n=== Cuentas superadmin en esta base (${superadmins.length}) ===`);
  for (const s of superadmins) {
    const estado = s.deletedAt ? `BORRADA (${s.deletedAt.toISOString()})` : 'activa';
    const clave  = s.password ? 'tiene contraseña' : 'SIN contraseña (cuenta de Google)';
    console.log(`  · ${s.email}  [${estado}]  ${clave}  creada ${s.createdAt.toISOString().slice(0, 10)}`);
  }

  if (!CONFIRMAR) {
    console.log('\nModo diagnóstico: no se modificó nada.');
    console.log('Para fijar una contraseña nueva, volvé a correrlo con:');
    console.log("  RESCATE_EMAIL=... RESCATE_PASSWORD='...' CONFIRMAR_RESCATE=si");
    await prisma.$disconnect();
    return;
  }

  if (!EMAIL || !PASSWORD) {
    console.error('\n❌ Con CONFIRMAR_RESCATE=si hay que definir RESCATE_EMAIL y RESCATE_PASSWORD.');
    process.exit(1);
  }
  if (PASSWORD.length < 8) {
    console.error('\n❌ La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const objetivo = superadmins.find(s => s.email === EMAIL);
  if (!objetivo) {
    console.error(`\n❌ No hay ninguna cuenta superadmin con el correo ${EMAIL}.`);
    console.error('   Revisá la lista de arriba: el correo tiene que coincidir exacto.');
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(10);
  await prisma.user.update({
    where: { id: objetivo.id },
    // deletedAt: null la revive si estaba borrada en blando; si ya estaba
    // activa es un no-op. debeCambiarPassword en false para que entre directo
    // y no lo mande a la pantalla de cambio forzado.
    data: {
      password: await bcrypt.hash(PASSWORD, salt),
      deletedAt: null,
      debeCambiarPassword: false
    },
    withDeleted: true
  });

  console.log(`\n✅ Contraseña actualizada para ${EMAIL}`);
  if (objetivo.deletedAt) console.log('✅ La cuenta estaba borrada y quedó restaurada.');
  console.log('   Entrá por /login (o /sa) con esa contraseña y cambiala desde /plataforma.');
  await prisma.$disconnect();
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
