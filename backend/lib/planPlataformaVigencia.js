// Un mes de vigencia del plan de plataforma — usado tanto al asignar/reasignar
// un plan (gym.js) como al registrar un pago "pagada" (pagosPlataforma.js), así
// que vive en un solo lugar en vez de dos copias que puedan desalinearse.
function sumarUnMes(fecha) {
  const f = new Date(fecha);
  f.setMonth(f.getMonth() + 1);
  return f;
}

// Inversa de sumarUnMes — se usa cuando un pago "pagada" pasa a otro estado
// (por ejemplo, se anula): el mes que ese pago le había sumado a la vigencia
// se le vuelve a restar, para que anular de verdad revierta el efecto.
function restarUnMes(fecha) {
  const f = new Date(fecha);
  f.setMonth(f.getMonth() - 1);
  return f;
}

/**
 * Activa un plan recién asignado (o reasignado) a un gimnasio: fija la
 * vigencia UN mes desde ahora y, a la vez, deja un registro "pagada" en
 * Facturación por ese mismo mes — así ningún gimnasio queda activo sin que
 * Facturación explique por qué (antes la activación era invisible: no
 * generaba ninguna fila, y un gym como recién creado podía verse "Activo"
 * sin un solo pago en su historial).
 */
async function activarPlan(prisma, { gymId, planPlataforma, campo, sociosActivos = 0 }) {
  const monto = campo === 'mensual'
    ? Number(planPlataforma.precioMensual)
    : Number(planPlataforma.precioPorSuscriptor) * sociosActivos;

  const ahora = new Date();
  const vence = sumarUnMes(ahora);
  await prisma.gym.update({
    where: { id: gymId },
    data: { planActivadoEn: ahora, planVenceEn: vence }
  });
  await prisma.pagoPlataforma.create({
    data: { gymId, monto, metodo: 'Automático', estado: 'pagada', fecha: ahora, hasta: vence }
  });
}

// Días de gracia entre que vence la suscripción y se desactiva el gimnasio
// de verdad. Compartida entre el chequeo que bloquea el login (acá abajo) y
// el cálculo de "pendiente" en Facturación (pagosPlataforma.js), para que
// ambos lados cuenten los mismos días.
const DIAS_GRACIA = 5;

function finDeGracia(planVenceEn) {
  const f = new Date(planVenceEn);
  f.setDate(f.getDate() + DIAS_GRACIA);
  return f;
}

// Desactiva de una todos los gimnasios cuya suscripción venció hace más de
// DIAS_GRACIA días y siguen marcados como activos — mismo efecto que anular
// el pago o tocar "Desactivar" a mano. No depende de un cron: se llama en los
// puntos de contacto donde importa que el estado esté al día (login, listado
// de Gimnasios del superadmin), así funciona igual en Vercel serverless que
// en el proceso persistente del VPS/Docker (que además corre esto mismo por
// intervalo en segundo plano, ver server.js).
async function desactivarGymsVencidos(prisma) {
  const limite = new Date();
  limite.setDate(limite.getDate() - DIAS_GRACIA);
  await prisma.gym.updateMany({
    where: { activo: true, planVenceEn: { lt: limite } },
    data: { activo: false }
  });
}

// Arranca el barrido periódico — solo tiene sentido en un proceso
// persistente (Docker/VPS, ver server.js e index.js en modo dev): en Vercel
// serverless no hay nada vivo para sostener un setInterval, así que ahí la
// desactivación automática depende solo de los chequeos al vuelo que ya
// corren en el login y en el listado/dashboard del superadmin.
function iniciarBarridoVigencia(prisma) {
  const UNA_HORA = 60 * 60 * 1000;
  desactivarGymsVencidos(prisma).catch(() => {});
  setInterval(() => { desactivarGymsVencidos(prisma).catch(() => {}); }, UNA_HORA);
}

module.exports = { sumarUnMes, restarUnMes, activarPlan, DIAS_GRACIA, finDeGracia, desactivarGymsVencidos, iniciarBarridoVigencia };
