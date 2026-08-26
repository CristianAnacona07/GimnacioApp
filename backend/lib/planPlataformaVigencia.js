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

// Mes calendario completo — el "mes guía" de la facturación: el 1° y el
// último día real del mes al que pertenece `fecha` (28/29/30/31 según
// corresponda, no "un mes exacto desde donde caiga"). Reemplaza a
// sumarUnMes/restarUnMes para el Desde/Vence de un pago: antes un pago
// registrado el 21 vencía el 21 del mes siguiente (un mes "rodante" desde
// cuando se pagó); ahora cualquier pago de agosto cubre el 01/08 al 31/08
// entero, sin importar qué día del mes se haya registrado.
function primerDiaDelMes(fecha) {
  const f = new Date(fecha);
  return new Date(f.getFullYear(), f.getMonth(), 1);
}
function ultimoDiaDelMes(fecha) {
  const f = new Date(fecha);
  return new Date(f.getFullYear(), f.getMonth() + 1, 0);
}

/**
 * Activa un plan recién asignado (o reasignado) a un gimnasio: fija la
 * vigencia hasta el ÚLTIMO DÍA DEL MES CALENDARIO en curso — no "un mes
 * desde hoy" — y deja un registro "pagada" en Facturación por ese mismo mes
 * completo, así ningún gimnasio queda activo sin que Facturación explique
 * por qué (antes la activación era invisible: no generaba ninguna fila, y
 * un gym recién creado podía verse "Activo" sin un solo pago en su
 * historial).
 */
async function activarPlan(prisma, { gymId, planPlataforma, campo, sociosActivos = 0 }) {
  const monto = campo === 'mensual'
    ? Number(planPlataforma.precioMensual)
    : Number(planPlataforma.precioPorSuscriptor) * sociosActivos;

  const ahora = new Date();
  const desde = primerDiaDelMes(ahora);
  const vence = ultimoDiaDelMes(ahora);
  await prisma.gym.update({
    where: { id: gymId },
    data: { planActivadoEn: ahora, planVenceEn: vence }
  });
  await prisma.pagoPlataforma.create({
    data: { gymId, monto, metodo: 'Automático', estado: 'pagada', fecha: desde, hasta: vence }
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

// Corte automático de fin de mes: el último día de cada mes, genera UNA
// factura "pendiente" en Facturación por cada gimnasio activo con plan
// asignado — 17 socios activos hoy × $10.000 = $170.000, por ejemplo. No
// marca nada como pagado ni toca planVenceEn/activo: solo dice cuánto
// debería cobrarse ese mes, para que el superadmin no tenga que calcularlo
// a mano ni acordarse de hacerlo. El superadmin la pasa a "Pagada" cuando el
// gimnasio efectivamente le transfiere (mismo PUT que ya existía).
//
// Se cuentan los socios ACTIVOS DE ESE DÍA (el último del mes), no un
// promedio ni una foto de otro momento — así el corte de agosto refleja los
// socios con los que el gimnasio termina agosto, sin importar cuántos entren
// o salgan al día siguiente.
const METODO_CORTE = 'Corte automático';

/**
 * @param {Date} [fechaCorte] Para pruebas: simular "hoy" sin esperar al fin
 *        de mes real ni tocar el reloj del sistema (ver
 *        scripts/generar-corte-mensual.js). Por defecto, ahora mismo.
 */
async function generarCortesDelMes(prisma, fechaCorte = new Date()) {
  const ultimoDiaDelMes = new Date(fechaCorte.getFullYear(), fechaCorte.getMonth() + 1, 0).getDate();
  if (fechaCorte.getDate() !== ultimoDiaDelMes) return { generados: 0 }; // no es el último día: nada que hacer

  const inicioDelDia = new Date(fechaCorte.getFullYear(), fechaCorte.getMonth(), fechaCorte.getDate());

  // Mismo filtro que "sociosActivos"/ingresosEstimados del dashboard (gym.js):
  // sin planPlataformaCampo guardado no se sabe si es mensual o por
  // suscriptor, así que se lo salta en vez de inventar un monto.
  const gyms = await prisma.gym.findMany({
    where: { activo: true, planPlataformaId: { not: null }, planPlataformaCampo: { not: null } },
    select: { id: true, planPlataformaId: true, planPlataformaCampo: true }
  });
  if (!gyms.length) return { generados: 0 };

  const planes = await prisma.planPlataforma.findMany();
  const planPorId = new Map(planes.map((p) => [p.id, p]));

  let generados = 0;
  for (const g of gyms) {
    const plan = planPorId.get(g.planPlataformaId);
    if (!plan) continue; // plan eliminado (soft-delete): no inventa un corte

    // Idempotencia: el barrido que llama a esto corre cada hora, así que el
    // último día del mes lo va a llamar ~24 veces — sin esto, 24 facturas.
    const yaExiste = await prisma.pagoPlataforma.findFirst({
      where: { gymId: g.id, metodo: METODO_CORTE, fecha: { gte: inicioDelDia } },
      select: { id: true }
    });
    if (yaExiste) continue;

    let monto;
    if (g.planPlataformaCampo === 'mensual') {
      monto = Number(plan.precioMensual);
    } else {
      const sociosActivos = await prisma.user.count({
        where: { gymId: g.id, role: 'socio', deletedAt: null, fechaVencimiento: { gt: fechaCorte } }
      });
      monto = Number(plan.precioPorSuscriptor) * sociosActivos;
    }

    await prisma.pagoPlataforma.create({
      data: { gymId: g.id, monto, fecha: fechaCorte, hasta: fechaCorte, metodo: METODO_CORTE, estado: 'pendiente' }
    });
    generados++;
  }
  return { generados };
}

// Arranca el barrido periódico — solo tiene sentido en un proceso
// persistente (Docker/VPS, ver server.js e index.js en modo dev): en Vercel
// serverless no hay nada vivo para sostener un setInterval, así que ahí la
// desactivación automática depende solo de los chequeos al vuelo que ya
// corren en el login y en el listado/dashboard del superadmin. El corte
// mensual, en cambio, SÍ necesita este barrido — a diferencia de
// desactivarGymsVencidos no hay ningún otro punto de contacto que lo dispare
// al vuelo, así que en Vercel simplemente no se generaría solo (habría que
// correrlo a mano con el script).
function iniciarBarridoVigencia(prisma) {
  const UNA_HORA = 60 * 60 * 1000;
  const barrer = () => {
    desactivarGymsVencidos(prisma).catch(() => {});
    generarCortesDelMes(prisma).catch(() => {});
  };
  barrer();
  setInterval(barrer, UNA_HORA);
}

module.exports = {
  sumarUnMes, restarUnMes, primerDiaDelMes, ultimoDiaDelMes, activarPlan, DIAS_GRACIA, finDeGracia,
  desactivarGymsVencidos, generarCortesDelMes, METODO_CORTE, iniciarBarridoVigencia
};
