require('dotenv').config();
const { getPrismaClient } = require('../prisma/client');

/**
 * Deja cargados los cinco escalones con los que se vende la plataforma.
 *
 * Uso:
 *   node scripts/crear-planes-plataforma.js          # muestra qué haría
 *   CONFIRMAR=si node scripts/crear-planes-plataforma.js
 *
 * Es idempotente y sólo agrega: si un plan con ese nombre ya existe, lo deja
 * como está y avisa — nunca le pisa el precio a un plan que algún gimnasio
 * pueda tener asignado. Tampoco borra planes viejos ni reasigna gimnasios:
 * cambiarle el plan a un gimnasio cambia lo que se le factura, y eso se hace
 * a mano desde el panel.
 *
 * Los cinco se cobran POR MES. `precioPorSuscriptor` va en 0 a propósito: es
 * lo que hace que el panel no ofrezca el cobro por socio (ver el @if sobre
 * ese campo en superadmin.html). La columna sigue existiendo, así que si
 * alguna vez hace falta se carga a mano y la opción reaparece sola.
 */
const PLANES = [
  { nombre: 'Inicial', precioMensual:   89000, maxSocios:  60 },
  { nombre: 'Bronce',  precioMensual:  179000, maxSocios: 150 },
  { nombre: 'Plata',   precioMensual:  379000, maxSocios: 400 },
  { nombre: 'Oro',     precioMensual:  699000, maxSocios: 800 },
  // Sin tope: es el escalón más alto, se cotiza por sedes y soporte.
  { nombre: 'Élite',   precioMensual: 1090000, maxSocios: null }
];

const CONFIRMADO = process.env.CONFIRMAR === 'si';

async function main() {
  const prisma = getPrismaClient();
  await prisma.$queryRaw`SELECT 1`;
  console.log('✅ Conectado a la base\n');

  const existentes = await prisma.planPlataforma.findMany({ select: { nombre: true } });
  const yaEstan = new Set(existentes.map(p => p.nombre));

  const aCrear = PLANES.filter(p => !yaEstan.has(p.nombre));
  const salteados = PLANES.filter(p => yaEstan.has(p.nombre));

  for (const p of salteados) {
    console.log(`•  ${p.nombre.padEnd(8)} ya existe — se deja como está`);
  }
  for (const p of aCrear) {
    const tope = p.maxSocios ? `hasta ${p.maxSocios} socios` : 'sin tope';
    console.log(`+  ${p.nombre.padEnd(8)} $${p.precioMensual.toLocaleString('es')} /mes · ${tope}`);
  }

  if (!aCrear.length) {
    console.log('\nNo hay nada que crear.');
    return;
  }

  if (!CONFIRMADO) {
    console.log(`\n⚠️  Prueba en seco: no se escribió nada.`);
    console.log('   Para crearlos de verdad:  CONFIRMAR=si node scripts/crear-planes-plataforma.js');
    return;
  }

  // De a uno y no createMany: la extensión que genera los ids de 24 hex sólo
  // intercepta operaciones de nivel superior, y así el error de uno no deja
  // a los otros a medio crear sin decir cuál falló.
  for (const p of aCrear) {
    await prisma.planPlataforma.create({
      data: {
        nombre: p.nombre,
        precioMensual: p.precioMensual,
        precioPorSuscriptor: 0,
        maxSocios: p.maxSocios
      }
    });
    console.log(`✅ ${p.nombre} creado`);
  }

  console.log('\nListo. Asigná el plan de cada gimnasio desde el panel del superadmin.');
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(async () => { await getPrismaClient().$disconnect(); });
