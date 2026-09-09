const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { eventoLegitimo, pagoAprobado, referenciaDelEvento } = require('../lib/wompi');
const { emitirAUsuario, emitirAGym } = require('../helpers/tiempoReal');
const { ObjectId } = require('bson');

const prisma = getPrismaClient();

/**
 * Lo que Wompi nos avisa cuando una transacción cambia de estado.
 *
 * Va sin token: la llama la pasarela, no un usuario. Lo que la protege es la
 * firma del evento, calculada con el secreto de eventos de ESE gimnasio — por
 * eso primero se busca la solicitud por referencia y recién ahí se sabe con qué
 * secreto verificar. Un evento que no cierre con la firma no toca nada.
 *
 * Es idempotente: Wompi reintenta hasta tres veces en 24 horas, y el mismo pago
 * no puede sumar los días dos veces.
 */
router.post('/eventos', async (req, res) => {
  try {
    const referencia = referenciaDelEvento(req.body);
    if (!referencia) return res.status(400).json({ error: 'Evento sin referencia' });

    const solicitud = await prisma.solicitudPago.findUnique({
      where: { referencia },
      include: {
        socio: { select: { id: true, fechaVencimiento: true } },
        // El secreto está escondido por defecto: acá hace falta, y solo acá.
        // select explícito: gana sobre el omit global, y los dos juntos Prisma
        // no los admite en la misma consulta.
        gym: { select: { id: true, wompiEventsSecret: true } }
      }
    });
    // Referencia desconocida: puede ser de otro sistema. No se dice cuál existe
    // y cuál no, pero tampoco es un error nuestro.
    if (!solicitud) return res.status(404).json({ error: 'Referencia desconocida' });

    if (!eventoLegitimo(req.body, solicitud.gym?.wompiEventsSecret)) {
      // Sin 200: si no cierra la firma, no vino de Wompi y no hay nada que
      // reintentar.
      return res.status(401).json({ error: 'Firma inválida' });
    }

    // Ya resuelta: Wompi está reintentando. Se contesta 200 para que deje de
    // hacerlo, sin volver a sumar días.
    if (solicitud.estado !== 'pendiente') {
      return res.json({ recibido: true, yaEstaba: solicitud.estado });
    }

    if (!pagoAprobado(req.body)) {
      // Rechazada, anulada o con error: el aviso se cierra sin activar nada.
      const estado = req.body?.data?.transaction?.status;
      if (['DECLINED', 'VOIDED', 'ERROR'].includes(estado)) {
        await prisma.solicitudPago.update({
          where: { id: solicitud.id },
          data: { estado: 'rechazada', resueltaEn: new Date() }
        });
        emitirAUsuario(solicitud.socioId, 'avisos:revisar', {});
      }
      // PENDING y demás estados intermedios: se acusa recibo y se espera el
      // siguiente evento.
      return res.json({ recibido: true, estado });
    }

    // Aprobado: se activa igual que un pago de mostrador, con el precio y los
    // días que quedaron guardados en el aviso. Nadie escribe cifras.
    const ahora = new Date();
    const base = solicitud.socio.fechaVencimiento && solicitud.socio.fechaVencimiento > ahora
      ? new Date(solicitud.socio.fechaVencimiento)
      : ahora;
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
          gymId: solicitud.gymId,
          usuarioId: solicitud.socioId,
          monto: solicitud.monto,
          planId: solicitud.planId,
          metodoId: solicitud.metodoId || undefined,
          concepto: 'Membresía (pago en línea)',
          diasAgregados: solicitud.dias
          // Sin registradoPor: no lo registró una persona.
        }
      }),
      prisma.solicitudPago.update({
        where: { id: solicitud.id },
        data: { estado: 'aprobada', resueltaEn: ahora, transaccionId }
      })
    ]);

    // Para que al socio se le actualice la pantalla sin recargar, y en
    // recepción vean que el pago entró.
    emitirAUsuario(solicitud.socioId, 'avisos:revisar', {});
    emitirAGym(solicitud.gymId, 'solicitud:resuelta', { socioId: solicitud.socioId });

    res.json({ recibido: true, activado: true });
  } catch (error) {
    // 500 a propósito: Wompi reintenta, y un fallo nuestro (base caída) sí
    // conviene que se reintente.
    res.status(500).json({ error: 'Error al procesar el evento' });
  }
});

module.exports = router;
