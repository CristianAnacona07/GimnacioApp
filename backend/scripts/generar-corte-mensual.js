/**
 * Corre a mano el corte mensual de facturación (ver
 * lib/planPlataformaVigencia.js) sin esperar al último día real del mes ni
 * tocar el reloj del sistema — pasando una fecha simulada.
 *
 * En producción esto se dispara solo, dentro del barrido horario
 * (iniciarBarridoVigencia). Este script es para:
 *   - probarlo en local antes de confiar en el automático
 *   - correrlo a mano una vez si por lo que sea el barrido no llegó a
 *     disparar el último día del mes
 *
 *   # simula que hoy es el ultimo dia de agosto de 2026
 *   FECHA=2026-08-31 node scripts/generar-corte-mensual.js
 *
 *   # sin FECHA, usa la fecha real de hoy — solo genera algo si HOY es
 *   # efectivamente el ultimo dia del mes
 *   node scripts/generar-corte-mensual.js
 */
require('dotenv').config();
const { getPrismaClient } = require('../prisma/client');
const { generarCortesDelMes } = require('../lib/planPlataformaVigencia');

async function main() {
  const prisma = getPrismaClient();
  await prisma.$queryRaw`SELECT 1`;

  const fecha = process.env.FECHA ? new Date(`${process.env.FECHA}T12:00:00`) : new Date();
  if (process.env.FECHA && isNaN(fecha.getTime())) {
    console.error('❌ FECHA inválida, usá el formato AAAA-MM-DD');
    process.exit(1);
  }

  console.log(`Simulando corte con fecha: ${fecha.toISOString().slice(0, 10)}`);
  const { generados } = await generarCortesDelMes(prisma, fecha);

  if (generados === 0) {
    console.log('No se generó ningún corte — o esa fecha no es el último día del mes,');
    console.log('o ya existía un corte para ese gimnasio ese día (idempotencia).');
  } else {
    console.log(`✅ ${generados} corte(s) generado(s) como "pendiente" en Facturación.`);
  }
  await prisma.$disconnect();
}

main().catch((err) => { console.error('❌', err.message); process.exit(1); });
