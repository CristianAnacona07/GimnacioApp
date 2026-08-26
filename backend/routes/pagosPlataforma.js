// Facturación de la PLATAFORMA: lo que cada gimnasio le paga a la
// plataforma, registrado a mano por el superadmin. No confundir con
// /api/transacciones, que es lo que los SOCIOS le pagan a su gimnasio.
const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { esIdValido } = require('../lib/ids');
const { verificarToken, soloSuperAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');

const prisma = getPrismaClient();
const { sumarUnMes, restarUnMes, finDeGracia, primerDiaDelMes, ultimoDiaDelMes } = require('../lib/planPlataformaVigencia');

const ESTADOS_VALIDOS = ['pagada', 'vencida', 'pendiente', 'anulada'];

function conId(p) {
  if (!p) return p;
  const { id, gym, ...rest } = p;
  return { ...rest, _id: id, gymNombre: gym?.nombre || null };
}

// Agrega a cada fila lo que el gimnasio tiene HOY (socios activos, valor
// unitario y el total que resulta de multiplicarlos) — a propósito distinto
// del "monto" ya cobrado en esa fila, que es historia y no cambia. Ver acá
// al lado si un pago viejo quedó corto respecto a lo que el gym factura hoy.
async function conDatosVivos(prisma, pagos) {
  const gymIds = [...new Set(pagos.map((p) => p.gymId))];
  if (!gymIds.length) return pagos;

  const [gyms, socios] = await Promise.all([
    prisma.gym.findMany({
      where: { id: { in: gymIds } },
      select: { id: true, planPlataformaId: true, planPlataformaCampo: true }
    }),
    prisma.user.groupBy({
      by: ['gymId'],
      where: { gymId: { in: gymIds }, role: 'socio', deletedAt: null, fechaVencimiento: { gt: new Date() } },
      _count: { _all: true }
    })
  ]);

  const planIds = [...new Set(gyms.map((g) => g.planPlataformaId).filter(Boolean))];
  const planes = planIds.length ? await prisma.planPlataforma.findMany({ where: { id: { in: planIds } } }) : [];
  const planPorId = new Map(planes.map((pl) => [pl.id, pl]));
  const sociosPorGym = new Map(socios.map((s) => [s.gymId, s._count._all]));
  const gymPorId = new Map(gyms.map((g) => [g.id, g]));

  return pagos.map((p) => {
    const gym = gymPorId.get(p.gymId);
    const plan = gym?.planPlataformaId ? planPorId.get(gym.planPlataformaId) : null;
    const sociosActivos = sociosPorGym.get(p.gymId) || 0;

    let tipoValor = null, valorUnitario = null, totalActual = null;
    if (plan && gym.planPlataformaCampo === 'mensual') {
      tipoValor = 'mensual';
      valorUnitario = Number(plan.precioMensual);
      totalActual = valorUnitario;
    } else if (plan && gym.planPlataformaCampo === 'porSuscriptor') {
      tipoValor = 'porSuscriptor';
      valorUnitario = Number(plan.precioPorSuscriptor);
      totalActual = valorUnitario * sociosActivos;
    }
    // Sin plan asignado (o sin campo guardado): tipoValor/valorUnitario/
    // totalActual quedan null — mejor mostrar "sin plan" en pantalla que
    // inventar un número.

    return { ...p, sociosActivos, tipoValor, valorUnitario, totalActual };
  });
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
// Un pago "pagada" cuyo plazo venció entra primero a "pendiente" — los
// DIAS_GRACIA de margen para pagar antes de que el gimnasio se desactive de
// verdad (ver desactivarGymsVencidos) — y recién pasada la gracia pasa a
// "vencida". Un pago "anulada" es una decisión ya tomada por el superadmin,
// sin gracia: si su plazo pasó, es "vencida" de una — coincide con que
// anular ya desactiva el gimnasio al toque, sin esperar.
function estadoEfectivo(p) {
  const limite = p.hasta || p.gym?.planVenceEn;
  if (!limite || new Date(limite) >= new Date()) return p.estado;
  if (p.estado === 'pagada') return new Date() < finDeGracia(limite) ? 'pendiente' : 'vencida';
  if (p.estado === 'anulada') return 'vencida';
  return p.estado;
}

// Lista con filtro opcional por estado y rango de fechas — igual que el
// historial de un solo tenant, pero acá "el tenant" es la plataforma entera.
router.get('/', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const { estado, desde, hasta } = req.query;
    const where = {};
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde);
      if (hasta) {
        // "hasta" es una fecha sin hora: incluye todo ese día.
        const fin = new Date(hasta);
        fin.setHours(23, 59, 59, 999);
        where.fecha.lte = fin;
      }
    }

    const pagos = await prisma.pagoPlataforma.findMany({
      where,
      include: { gym: { select: { nombre: true, planVenceEn: true } } },
      orderBy: { fecha: 'desc' }
    });

    let resultado = pagos.map(p => conId({ ...p, estado: estadoEfectivo(p) }));
    if (estado && ESTADOS_VALIDOS.includes(estado)) {
      resultado = resultado.filter(p => p.estado === estado);
    }

    // Orden por estado (lo que importa mirar primero) y, dentro de cada
    // estado, por fecha más reciente — antes solo ordenaba por fecha, y una
    // "Anulada" vieja con fecha reciente (por ejemplo un pago corregido a
    // mano) tapaba a las "Pagada" en la vista "Todos". Se ordena DESPUÉS de
    // calcular estadoEfectivo(): el estado guardado en la base puede no ser
    // el real (una "pagada" vencida hace rato en realidad es "vencida"), así
    // que Prisma no lo puede hacer solo con su propio orderBy.
    const PRIORIDAD_ESTADO = { pagada: 0, pendiente: 1, vencida: 2, anulada: 3 };
    resultado.sort((a, b) => {
      const porEstado = (PRIORIDAD_ESTADO[a.estado] ?? 9) - (PRIORIDAD_ESTADO[b.estado] ?? 9);
      if (porEstado !== 0) return porEstado;
      return new Date(b.fecha) - new Date(a.fecha);
    });

    resultado = await conDatosVivos(prisma, resultado);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Registro manual de un pago — el monto no se calcula solo: lo sugiere el
// plan asignado al elegir el gimnasio (ver claveOpcionPlan en el frontend),
// pero el superadmin puede escribir cualquier valor. Registrar un pago acá ES
// pagarlo — no hay elección de estado en el formulario, siempre nace
// "pagada" (los otros estados solo tienen sentido corrigiendo uno ya cargado,
// ver PUT más abajo).
router.post('/', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const { gymId, monto, fecha, hasta, metodo } = req.body;
    if (!esIdValido(gymId)) return res.status(400).json({ error: 'Gimnasio inválido' });
    if (monto === undefined || monto === null || isNaN(Number(monto)) || Number(monto) < 0) {
      return res.status(400).json({ error: 'El monto es obligatorio y debe ser un número válido' });
    }

    const gym = await prisma.gym.findUnique({
      where: { id: gymId }, select: { id: true, nombre: true, planVenceEn: true }
    });
    if (!gym) return res.status(404).json({ error: 'Gimnasio no encontrado' });

    // Desde/Vence son SIEMPRE el mes calendario completo (01 al último día
    // real) del mes al que cae "fecha" — nunca "un mes desde ese día". El
    // "hasta" que mande el cliente se ignora a propósito: antes un pago del
    // 21 vencía el 21 del mes siguiente (un mes "rodante"), y ahora cualquier
    // pago de agosto cubre el 01/08 al 31/08 entero, sin importar qué día del
    // mes se haya registrado — así todo el sistema de facturación queda
    // alineado al mismo "mes guía" que usa el corte automático de fin de mes
    // (ver generarCortesDelMes).
    const referencia = fecha ? new Date(fecha) : new Date();
    const fechaInicio = primerDiaDelMes(referencia);
    const fechaHasta = ultimoDiaDelMes(referencia);

    const pago = await prisma.pagoPlataforma.create({
      data: {
        gymId,
        monto,
        fecha: fechaInicio,
        hasta: fechaHasta,
        metodo: metodo || '',
        estado: 'pagada'
      },
      include: { gym: { select: { nombre: true } } }
    });

    // Registrar un pago también reactiva el gimnasio si había quedado
    // desactivado por un "Anular" anterior — un pago nuevo y válido no debería
    // dejar el gym bloqueado para sus socios/admin.
    await prisma.gym.update({
      where: { id: gymId },
      data: { planActivadoEn: fechaInicio, planVenceEn: fechaHasta, activo: true }
    });

    await registrarAuditoria(req, 'REGISTRAR_PAGO_PLATAFORMA', {
      recurso: 'PagoPlataforma', recursoId: pago.id, detalle: { gymId, gymNombre: gym.nombre, monto: String(monto) }
    });
    res.status(201).json(conId(pago));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Editar un pago ya cargado (corregir un dato mal puesto, o anularlo). Sin
// borrado real: "anulada" ya es el estado que reemplaza esa idea, así el
// historial de facturación nunca pierde una fila.
router.put('/:id', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    if (!esIdValido(req.params.id)) return res.status(400).json({ error: 'Identificador inválido' });
    const actual = await prisma.pagoPlataforma.findUnique({ where: { id: req.params.id } });
    if (!actual) return res.status(404).json({ error: 'Pago no encontrado' });

    const { monto, fecha, metodo, estado } = req.body;
    const data = {};
    if (monto !== undefined) {
      if (isNaN(Number(monto)) || Number(monto) < 0) return res.status(400).json({ error: 'Monto inválido' });
      data.monto = monto;
    }
    if (fecha !== undefined) data.fecha = new Date(fecha);
    if (metodo !== undefined) data.metodo = metodo;
    if (estado !== undefined) {
      if (!ESTADOS_VALIDOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
      data.estado = estado;
    }

    const pago = await prisma.pagoPlataforma.update({
      where: { id: req.params.id },
      data,
      include: { gym: { select: { nombre: true } } }
    });

    // El mes que un pago "pagada" le sumó a la vigencia se revierte si deja
    // de estar pagado (por ejemplo, al anularlo) — y viceversa, si un pago
    // que no estaba pagado pasa a estarlo, suma su mes como si se acabara de
    // crear así. Sin esto, anular un pago no tenía ningún efecto real sobre
    // el gimnasio: seguía apareciendo activo aunque ese pago ya no contara.
    //
    // Anular también apaga el gimnasio de verdad (gym.activo = false): antes
    // "Anular" solo corregía la fecha de vencimiento pero el gym seguía
    // recibiendo logins y apareciendo en la web pública — el mismo botón
    // "Desactivar" de la tarjeta de Gimnasios, pero disparado desde acá.
    // Volver a pasar el pago a "pagada" reactiva el gym simétricamente.
    if (data.estado && data.estado !== actual.estado) {
      const eraPagada = actual.estado === 'pagada';
      const esPagadaAhora = data.estado === 'pagada';
      if (eraPagada !== esPagadaAhora) {
        const gymActual = await prisma.gym.findUnique({ where: { id: actual.gymId }, select: { planVenceEn: true } });
        const dataGym = {};
        if (gymActual?.planVenceEn) {
          dataGym.planVenceEn = esPagadaAhora ? sumarUnMes(gymActual.planVenceEn) : restarUnMes(gymActual.planVenceEn);
        }
        if (data.estado === 'anulada') dataGym.activo = false;
        else if (esPagadaAhora) dataGym.activo = true;
        if (Object.keys(dataGym).length) {
          await prisma.gym.update({ where: { id: actual.gymId }, data: dataGym });
        }
      }
    }

    await registrarAuditoria(req, 'EDITAR_PAGO_PLATAFORMA', { recurso: 'PagoPlataforma', recursoId: pago.id, detalle: data });
    res.json(conId(pago));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
