// Un mes de vigencia del plan de plataforma — usado tanto al asignar/reasignar
// un plan (gym.js) como al registrar un pago "pagada" (pagosPlataforma.js), así
// que vive en un solo lugar en vez de dos copias que puedan desalinearse.
const { emitirAGym } = require('../helpers/tiempoReal');

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

// El servidor corre en UTC y el gimnasio no (Colombia, UTC-5 todo el año,
// sin horario de verano) — mismo problema que ya está documentado en el
// modelo Cita. No importa mientras se comparen INSTANTES precisos (p. ej.
// finDeGracia/estadoEfectivo), pero si se construye un "día calendario" a
// partir de `new Date()` tal cual, entre las 19:00 y la medianoche hora
// Colombia el reloj UTC del servidor ya marca el día siguiente — un pago
// "mensual" registrado a esa hora quedaba fechado un día adelantado. Esta
// función devuelve el día calendario correcto en Colombia (medianoche UTC de
// ESE día), para usar en vez de `new Date()` en cualquier cálculo de
// Desde/Vence rodante.
const OFFSET_COLOMBIA_HORAS = 5;
function hoyEnColombia() {
  const enColombia = new Date(Date.now() - OFFSET_COLOMBIA_HORAS * 60 * 60 * 1000);
  return new Date(Date.UTC(enColombia.getUTCFullYear(), enColombia.getUTCMonth(), enColombia.getUTCDate()));
}

/**
 * Antes de crear una factura "pagada" nueva para un gimnasio, anula
 * cualquier otra fila suya que siga "pagada" y cuya cobertura llegue hasta
 * el inicio de esta nueva (o más allá) — sin esto, reasignar un plan (o
 * registrar otro pago) mientras el período anterior no había terminado
 * dejaba las dos filas como "Pagada" al mismo tiempo, como si el gimnasio
 * hubiera pagado dos veces el mismo mes. Una "pagada" de un período YA
 * cerrado (mes anterior) no se toca: es historia real, no un duplicado.
 *
 * @param {Date} [refInicio] Desde cuándo arranca la factura nueva —
 *        normalmente hoy, pero puede ser otra fecha si se está registrando
 *        un pago con una fecha elegida a mano.
 */
async function anularPagadasVigentes(prisma, gymId, refInicio = hoyEnColombia()) {
  await prisma.pagoPlataforma.updateMany({
    where: { gymId, estado: 'pagada', hasta: { gte: refInicio } },
    data: { estado: 'anulada' }
  });
}

/**
 * Activa un plan recién asignado (o reasignado) a un gimnasio, y deja un
 * registro "pagada" en Facturación por el primer período, así ningún
 * gimnasio queda activo sin que Facturación explique por qué (antes la
 * activación era invisible: no generaba ninguna fila, y un gym recién
 * creado podía verse "Activo" sin un solo pago en su historial).
 *
 * Dos ciclos según el campo del plan (misma distinción que
 * generarCortesDelMes/POST pagosPlataforma):
 * - "porSuscriptor" se alinea al MES CALENDARIO en curso (01 al último día
 *   real) — necesita poder contar socios activos justo el último día.
 * - "mensual" es un monto fijo que no depende de ningún conteo, así que usa
 *   el ciclo rodante de siempre: arranca a correr HOY y vence exactamente
 *   un mes después, sin importar en qué día del mes calendario caiga.
 */
async function activarPlan(prisma, { gymId, planPlataforma, campo, sociosActivos = 0 }) {
  const monto = campo === 'mensual'
    ? Number(planPlataforma.precioMensual)
    : Number(planPlataforma.precioPorSuscriptor) * sociosActivos;

  const ahora = new Date();
  const hoy = hoyEnColombia();
  const desde = campo === 'mensual' ? hoy : primerDiaDelMes(hoy);
  const vence = campo === 'mensual' ? sumarUnMes(hoy) : ultimoDiaDelMes(hoy);
  await anularPagadasVigentes(prisma, gymId, hoy);
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

// "vencida" y "pendiente" no son valores que nadie escriba a mano: se derivan
// de si la cobertura del pago ya pasó. Se usa el "hasta" propio del pago
// cuando existe (todo pago nuevo lo trae); los pagos viejos que quedaron sin
// "hasta" (de antes de que esa columna existiera) usan en su lugar la
// vigencia actual del gimnasio — nunca "fecha" del pago, que es solo cuándo
// se registró, no hasta cuándo cubre: usarla como respaldo marcaba como
// vencidos pagos viejos de gimnasios que en realidad siguen activos por un
// pago más reciente.
//
// Un pago "pendiente" cuyo plazo venció (el corte automático de fin de mes
// arranca directo en este estado) sigue mostrándose "pendiente" mientras dure
// la gracia, y pasa a "vencida" cuando se acaba — sin esta rama, un corte
// nunca escalaba a "vencida" en la tabla aunque el gimnasio ya se hubiera
// desactivado de verdad por detrás (ver desactivarGymsVencidos). Un pago
// "anulada" es una decisión ya tomada por el superadmin, sin gracia: si su
// plazo pasó, es "vencida" de una — coincide con que anular ya desactiva el
// gimnasio al toque, sin esperar.
//
// Un pago "pagada" con su propio "hasta" es historia cerrada: ese mes se
// cobró, y no hay nada que reevaluar solo porque el calendario siguió
// avanzando — sin este corte, marcar pagada una factura vencida (lo normal:
// se paga días después del corte, dentro de la gracia) la seguía mostrando
// "pendiente" hasta que pasara la gracia, como si no se hubiera cobrado. La
// degradación pendiente/vencida de acá abajo solo aplica entonces a pagos
// VIEJOS que quedaron sin su propio "hasta" (de antes de que esa columna
// existiera) y caen al respaldo de la vigencia del gimnasio: ahí sí hace
// falta decidir si ya venció la gracia para renovar.
//
// Vive acá (no en pagosPlataforma.js) porque routes/notificaciones.js
// también la necesita para el aviso de la campanita del admin — un solo
// lugar en vez de dos copias que puedan desalinearse.
function estadoEfectivo(p) {
  const limite = p.hasta || p.gym?.planVenceEn;
  if (!limite || new Date(limite) >= new Date()) return p.estado;
  if (p.estado === 'pagada' && p.hasta) return 'pagada';
  if (p.estado === 'pagada' || p.estado === 'pendiente') {
    return new Date() < finDeGracia(limite) ? 'pendiente' : 'vencida';
  }
  if (p.estado === 'anulada') return 'vencida';
  return p.estado;
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

// Corte automático — genera UNA factura "pendiente" en Facturación por cada
// gimnasio activo con plan asignado. No marca nada como pagado ni toca
// planVenceEn/activo: solo dice cuánto debería cobrarse, para que el
// superadmin no tenga que calcularlo a mano ni acordarse de hacerlo. El
// superadmin la pasa a "Pagada" cuando el gimnasio efectivamente le
// transfiere (mismo PUT que ya existía).
//
// Dos corte distintos según el campo del plan (misma distinción que
// activarPlan/POST pagosPlataforma):
// - "porSuscriptor" corta el ÚLTIMO DÍA DEL MES CALENDARIO, para todos los
//   gimnasios de ese tipo a la vez, contando los socios ACTIVOS DE ESE DÍA
//   (no un promedio ni una foto de otro momento).
// - "mensual" no depende de ningún conteo, así que cada gimnasio tiene su
//   propia fecha ancla (planVenceEn) y se corta apenas esa fecha se cumple,
//   sin importar el día del mes calendario — por eso corre en CADA barrido
//   (cada hora), no solo el último día del mes.
const METODO_CORTE = 'Corte automático';

/**
 * @param {Date} [fechaCorte] Para pruebas: simular "hoy" sin esperar al fin
 *        de mes real ni tocar el reloj del sistema (ver
 *        scripts/generar-corte-mensual.js). Por defecto, ahora mismo.
 */
async function generarCortesDelMes(prisma, fechaCorte = new Date()) {
  const porSuscriptor = await generarCortePorSuscriptor(prisma, fechaCorte);
  const mensual = await generarCorteMensualRodante(prisma, fechaCorte);
  return { generados: porSuscriptor + mensual };
}

async function generarCortePorSuscriptor(prisma, fechaCorte) {
  const ultimoDiaDelMes = new Date(fechaCorte.getFullYear(), fechaCorte.getMonth() + 1, 0).getDate();
  if (fechaCorte.getDate() !== ultimoDiaDelMes) return 0; // no es el último día: nada que hacer

  const inicioDelDia = new Date(fechaCorte.getFullYear(), fechaCorte.getMonth(), fechaCorte.getDate());

  const gyms = await prisma.gym.findMany({
    where: { activo: true, planPlataformaId: { not: null }, planPlataformaCampo: 'porSuscriptor' },
    select: { id: true, planPlataformaId: true }
  });
  if (!gyms.length) return 0;

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

    const sociosActivos = await prisma.user.count({
      where: { gymId: g.id, role: 'socio', deletedAt: null, fechaVencimiento: { gt: fechaCorte } }
    });
    const monto = Number(plan.precioPorSuscriptor) * sociosActivos;

    await prisma.pagoPlataforma.create({
      data: { gymId: g.id, monto, fecha: fechaCorte, hasta: fechaCorte, metodo: METODO_CORTE, estado: 'pendiente' }
    });
    // Así el admin ve la factura pendiente en su campanita al toque, sin
    // esperar al sondeo de 5 minutos — mismo patrón que crear-noticia.
    emitirAGym(g.id, 'avisos:revisar');
    generados++;
  }
  return generados;
}

// A diferencia del corte por suscriptor (todos el mismo día), acá cada
// gimnasio "mensual" tiene su propia fecha ancla: apenas su planVenceEn se
// cumple, se le genera la factura pendiente por otro mes rodante desde esa
// misma fecha — sin importar el día del mes calendario en que caiga.
async function generarCorteMensualRodante(prisma, ahora) {
  const gyms = await prisma.gym.findMany({
    where: {
      activo: true,
      planPlataformaId: { not: null },
      planPlataformaCampo: 'mensual',
      planVenceEn: { not: null, lte: ahora }
    },
    select: { id: true, planPlataformaId: true, planVenceEn: true }
  });
  if (!gyms.length) return 0;

  const planes = await prisma.planPlataforma.findMany();
  const planPorId = new Map(planes.map((p) => [p.id, p]));

  let generados = 0;
  for (const g of gyms) {
    const plan = planPorId.get(g.planPlataformaId);
    if (!plan) continue; // plan eliminado (soft-delete): no inventa un corte

    // Idempotencia: el barrido corre cada hora, así que sin esto se
    // generaría una factura nueva en cada vuelta mientras nadie la pague —
    // ya existe una si hay una fila que arranca justo en este planVenceEn.
    const yaExiste = await prisma.pagoPlataforma.findFirst({
      where: { gymId: g.id, fecha: { gte: g.planVenceEn } },
      select: { id: true }
    });
    if (yaExiste) continue;

    const monto = Number(plan.precioMensual);
    const hasta = sumarUnMes(g.planVenceEn);

    await prisma.pagoPlataforma.create({
      data: { gymId: g.id, monto, fecha: g.planVenceEn, hasta, metodo: METODO_CORTE, estado: 'pendiente' }
    });
    emitirAGym(g.id, 'avisos:revisar');
    generados++;
  }
  return generados;
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
  sumarUnMes, restarUnMes, primerDiaDelMes, ultimoDiaDelMes, hoyEnColombia, activarPlan,
  anularPagadasVigentes, DIAS_GRACIA, finDeGracia,
  estadoEfectivo, desactivarGymsVencidos, generarCortesDelMes, METODO_CORTE, iniciarBarridoVigencia
};
