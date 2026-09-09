const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { emitirAGym, emitirAUsuario } = require('../helpers/tiempoReal');
const { ObjectId } = require('bson');
const { datosCheckout } = require('../lib/wompi');

const prisma = getPrismaClient();

const conId = (s) => {
  if (!s) return s;
  const { id, ...resto } = s;
  return { ...resto, _id: id, monto: Number(s.monto) };
};

/**
 * El socio arranca el pago en línea de un plan.
 *
 * No extiende nada por sí solo: queda pendiente hasta que la pasarela confirme
 * que el dinero entró. Un botón que sumara días al tocarlo sería un botón para
 * regalarse meses.
 *
 * El precio y los días se copian del plan acá, no se leen al aprobar: si el
 * gimnasio sube el precio mientras tanto, se respeta lo que el socio vio.
 */
router.post('/', verificarToken, async (req, res) => {
  try {
    const { planId, metodoId } = req.body;

    const plan = await prisma.plan.findFirst({
      where: { id: planId, gymId: req.gymId },
      select: { id: true, nombre: true, precio: true, dias: true }
    });
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado en este gimnasio' });

    // El método es opcional y solo informativo: sirve para que en recepción
    // sepan dónde buscar el comprobante.
    let metodo = null;
    if (metodoId) {
      const m = await prisma.metodoPago.findFirst({
        where: { id: metodoId, gymId: req.gymId }, select: { id: true }
      });
      metodo = m?.id || null;
    }

    // Un aviso pendiente por socio. El índice parcial de la base es quien lo
    // garantiza de verdad; esto solo evita el 500 en el caso normal.
    const yaHay = await prisma.solicitudPago.findFirst({
      where: { socioId: req.userId, estado: 'pendiente' },
      select: { id: true }
    });
    if (yaHay) {
      return res.status(409).json({ error: 'Ya tenés un aviso de pago esperando confirmación' });
    }

    // Sin pasarela no se crea nada: un aviso que nadie puede resolver dejaría
    // al socio bloqueado para siempre (solo se admite uno pendiente por socio).
    const gym = await prisma.gym.findUnique({
      where: { id: req.gymId },
      // select gana sobre el omit global; los dos juntos Prisma no los admite.
      select: { wompiPublicKey: true, wompiIntegritySecret: true }
    });
    if (!gym?.wompiPublicKey || !gym?.wompiIntegritySecret) {
      return res.status(409).json({ error: 'Este gimnasio todavía no tiene pago en línea' });
    }

    // La referencia que va a viajar a la pasarela y volver en el evento. Lleva
    // el id de la solicitud para poder rastrearla a mano si hace falta, y algo
    // aleatorio para que no se pueda adivinar la del vecino.
    const id = new ObjectId().toHexString();
    const referencia = `${id}-${require('crypto').randomBytes(6).toString('hex')}`;

    const solicitud = await prisma.solicitudPago.create({
      data: {
        id,
        gymId: req.gymId,
        socioId: req.userId,
        planId: plan.id,
        monto: plan.precio,
        dias: plan.dias,
        metodoId: metodo,
        referencia
      },
      include: { plan: { select: { nombre: true } } }
    });

    // Lo que el navegador necesita para abrir el checkout. El secreto se usa
    // acá y no sale: solo viaja la firma ya calculada.
    const checkout = datosCheckout({
      referencia,
      pesos: plan.precio,
      publicKey: gym.wompiPublicKey,
      secretoIntegridad: gym.wompiIntegritySecret,
      redirectUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/socio/planes` : undefined
    });

    // Para que en recepción les aparezca sin recargar.
    emitirAGym(req.gymId, 'solicitud:nueva', { socioId: req.userId, plan: plan.nombre });

    res.status(201).json({ ...conId(solicitud), checkout });
  } catch (error) {
    // El índice parcial rebota el segundo aviso aunque dos toques lleguen juntos.
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Ya tenés un aviso de pago esperando confirmación' });
    }
    res.status(500).json({ error: 'No se pudo registrar el aviso de pago' });
  }
});

/**
 * Cómo está la membresía del socio, y si acaba de pagarla.
 *
 * Lo consulta su pantalla de Planes al volver de la pasarela: es lo que le
 * permite mostrarle "quedaste activo" sin que tenga que buscar el dato.
 *
 * `reciEnPagado` dura una ventana corta a propósito. El saludo es para el
 * momento de volver del pago; si se quedara pegado, a los tres días seguiría
 * diciéndole "acabás de pagar" a alguien que ya se olvidó.
 */
router.get('/estado', verificarToken, async (req, res) => {
  try {
    const socio = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { fechaVencimiento: true, plan: { select: { nombre: true, dias: true } } }
    });
    if (!socio) return res.status(404).json({ error: 'Usuario no encontrado' });

    const hoy = new Date();
    let diasRestantes = 0;
    if (socio.fechaVencimiento) {
      diasRestantes = Math.ceil((new Date(socio.fechaVencimiento) - hoy) / (1000 * 60 * 60 * 24));
      if (diasRestantes < 0) diasRestantes = 0;
    }

    const ultima = await prisma.solicitudPago.findFirst({
      where: { socioId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { nombre: true } } }
    });

    const VENTANA_MIN = 30;
    const recienPagado = !!(ultima && ultima.estado === 'aprobada' && ultima.resueltaEn &&
      (hoy - new Date(ultima.resueltaEn)) < VENTANA_MIN * 60 * 1000);

    res.json({
      diasRestantes,
      vence: socio.fechaVencimiento,
      plan: socio.plan?.nombre || null,
      // El tope de la barra: los días del plan que tiene. Sin plan no hay
      // referencia contra la cual dibujarla.
      diasDelPlan: socio.plan?.dias || null,
      pendiente: ultima && ultima.estado === 'pendiente'
        ? { plan: ultima.plan?.nombre || null, dias: ultima.dias }
        : null,
      recienPagado: recienPagado
        ? { plan: ultima.plan?.nombre || null, dias: ultima.dias }
        : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar el estado' });
  }
});

/** Lo que el socio tiene pendiente, para no ofrecerle avisar dos veces. */
router.get('/mia', verificarToken, async (req, res) => {
  try {
    const solicitud = await prisma.solicitudPago.findFirst({
      where: { socioId: req.userId, estado: 'pendiente' },
      include: { plan: { select: { nombre: true } } }
    });
    res.json(solicitud ? conId(solicitud) : null);
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar el aviso' });
  }
});

/** Los avisos pendientes del gimnasio. */
router.get('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const solicitudes = await prisma.solicitudPago.findMany({
      where: { gymId: req.gymId, estado: 'pendiente' },
      include: {
        plan: { select: { nombre: true } },
        socio: { select: { id: true, nombre: true, fotoUrl: true, fechaVencimiento: true } },
        metodo: { select: { titulo: true } }
      },
      orderBy: { createdAt: 'asc' },
      take: 200
    });
    res.json(solicitudes.map(conId));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los avisos de pago' });
  }
});

/**
 * Aprobar: registra el pago y extiende la membresía, con el precio y los días
 * que quedaron guardados en el aviso. Nadie escribe cifras.
 *
 * Las tres escrituras van en una sola transacción: si algo falla, no queda un
 * socio con días regalados ni un aviso aprobado sin su pago.
 */
router.post('/:id/aprobar', verificarToken, soloAdmin, async (req, res) => {
  try {
    const solicitud = await prisma.solicitudPago.findFirst({
      where: { id: req.params.id, gymId: req.gymId, estado: 'pendiente' },
      include: { socio: { select: { id: true, fechaVencimiento: true } } }
    });
    if (!solicitud) return res.status(404).json({ error: 'Aviso no encontrado o ya resuelto' });

    // Mismo criterio que el registro de pago normal: se suma sobre lo que le
    // quede, para no quitarle días que ya pagó.
    const hoy = new Date();
    const base = solicitud.socio.fechaVencimiento && solicitud.socio.fechaVencimiento > hoy
      ? new Date(solicitud.socio.fechaVencimiento)
      : hoy;
    const vence = new Date(base);
    vence.setDate(vence.getDate() + solicitud.dias);

    const transaccionId = new ObjectId().toHexString();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: solicitud.socioId },
        data: { fechaVencimiento: vence, planId: solicitud.planId }
      }),
      prisma.transaccion.create({
        data: {
          id: transaccionId,
          gymId: req.gymId,
          usuarioId: solicitud.socioId,
          monto: solicitud.monto,
          planId: solicitud.planId,
          metodoId: solicitud.metodoId || undefined,
          concepto: 'Membresía',
          diasAgregados: solicitud.dias,
          registradoPor: req.userId
        }
      }),
      prisma.solicitudPago.update({
        where: { id: solicitud.id },
        data: { estado: 'aprobada', resueltaPor: req.userId, resueltaEn: hoy, transaccionId }
      })
    ]);

    await registrarAuditoria(req, 'APROBAR_SOLICITUD_PAGO', {
      recurso: 'SolicitudPago',
      recursoId: solicitud.id,
      detalle: { monto: Number(solicitud.monto), dias: solicitud.dias }
    });

    emitirAUsuario(solicitud.socioId, 'avisos:revisar', {});

    res.json({ mensaje: 'Pago confirmado', vence, dias: solicitud.dias });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo confirmar el pago' });
  }
});

/** Rechazar: el pago no apareció. No toca la membresía. */
router.post('/:id/rechazar', verificarToken, soloAdmin, async (req, res) => {
  try {
    const actualizado = await prisma.solicitudPago.updateMany({
      where: { id: req.params.id, gymId: req.gymId, estado: 'pendiente' },
      data: { estado: 'rechazada', resueltaPor: req.userId, resueltaEn: new Date() }
    });
    if (!actualizado.count) return res.status(404).json({ error: 'Aviso no encontrado o ya resuelto' });

    await registrarAuditoria(req, 'RECHAZAR_SOLICITUD_PAGO', {
      recurso: 'SolicitudPago', recursoId: req.params.id
    });
    res.json({ mensaje: 'Aviso descartado' });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo descartar el aviso' });
  }
});

module.exports = router;
