const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { Prisma } = require('@prisma/client'); // Decimal: el dinero no se suma con +
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { enviarRecibo, linkWhatsApp } = require('../helpers/whatsapp');
const { paginar } = require('../lib/pagination');

const prisma = getPrismaClient();

function conId(t) {
    if (!t) return t;
    const { id, ...rest } = t;
    return { ...rest, _id: id };
}

function diasRestantes(fechaVencimiento) {
    if (!fechaVencimiento) return 0;
    const d = Math.ceil((new Date(fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24));
    return d > 0 ? d : 0;
}

// Registrar un pago/transacción para un socio del gimnasio.
router.post('/registrar', verificarToken, soloAdmin, async (req, res) => {
    try {
        const { usuarioId, monto, metodoId, concepto, dias, reemplazar, planId } = req.body;

        if (!usuarioId) {
            return res.status(400).json({ error: 'usuarioId es obligatorio' });
        }

        // Validar monto: número finito >= 0.
        if (typeof monto !== 'number' || !Number.isFinite(monto) || monto < 0) {
            return res.status(400).json({ error: 'El monto debe ser un número mayor o igual a 0' });
        }

        // Validar días (si se proporciona): entero >= 0.
        let diasAgregados = 0;
        if (dias !== undefined && dias !== null) {
            if (!Number.isInteger(dias) || dias < 0) {
                return res.status(400).json({ error: 'Los días deben ser un entero mayor o igual a 0' });
            }
            diasAgregados = dias;
        }

        // El plan es opcional: un pago suelto escrito a mano no sale de ninguno.
        // Si viene, tiene que ser del gimnasio — si no, un id de otro gym
        // quedaría pegado al pago y la facturación contaría de más.
        let planValido = null;
        if (planId) {
            const plan = await prisma.plan.findFirst({
                where: { id: planId, gymId: req.gymId },
                select: { id: true }
            });
            if (!plan) return res.status(400).json({ error: 'Plan no encontrado en este gimnasio' });
            planValido = plan.id;
        }

        // Verificar que el socio pertenece al gimnasio del admin.
        const socioActual = await prisma.user.findFirst({ where: { id: usuarioId, gymId: req.gymId } });
        if (!socioActual) {
            return res.status(404).json({ error: 'Usuario no encontrado en este gimnasio' });
        }

        // Por defecto se extiende desde max(hoy, vencimiento actual), de modo que
        // renovar antes de tiempo no le quite al socio los días que ya pagó.
        // Con `reemplazar` la membresía se reescribe desde hoy, descartando lo que
        // le quedaba: es la salida para corregir una carga anterior equivocada.
        let nuevaFechaVencimiento = socioActual.fechaVencimiento;
        if (diasAgregados > 0) {
            const ahora = new Date();
            const base = !reemplazar && socioActual.fechaVencimiento && socioActual.fechaVencimiento > ahora
                ? new Date(socioActual.fechaVencimiento)
                : new Date(ahora);
            base.setDate(base.getDate() + diasAgregados);
            nuevaFechaVencimiento = base;
        }

        // Actualizar la membresía y registrar el pago de forma atómica: si el
        // insert de la transacción falla, la fecha de vencimiento no debe quedar
        // adelantada sin que exista el pago que la justifica (el código Mongoose
        // original hacía estos dos pasos sin ninguna garantía de atomicidad).
        const [socio, transaccion] = await prisma.$transaction([
            prisma.user.update({
                where: { id: socioActual.id },
                data: {
                    fechaVencimiento: nuevaFechaVencimiento,
                    // El plan del socio pasa a ser el que se le acaba de cobrar.
                    // Un pago suelto (sin plan) no le borra el que ya tenía.
                    ...(planValido ? { planId: planValido } : {})
                }
            }),
            prisma.transaccion.create({
                data: {
                    gymId: req.gymId,
                    usuarioId,
                    monto,
                    metodoId: metodoId || undefined,
                    planId: planValido || undefined,
                    concepto: concepto || 'Membresía',
                    diasAgregados,
                    registradoPor: req.userId
                }
            })
        ]);

        await registrarAuditoria(req, 'REGISTRAR_PAGO', {
            recurso: 'Transaccion',
            recursoId: transaccion.id,
            // `reemplazar` descarta días que el socio ya había pagado, así que
            // conviene poder rastrear quién y cuándo lo hizo.
            detalle: { monto, dias: diasAgregados, reemplazar: !!reemplazar }
        });

        // Recibo por WhatsApp: automático (plantilla) si está configurado + link de respaldo.
        const diasRest = diasRestantes(socio.fechaVencimiento);
        const montoTxt = `$${Number(monto).toLocaleString('es-CO')}`;
        const fechaVenceTxt = socio.fechaVencimiento
            ? new Date(socio.fechaVencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
            : '—';
        const texto = `Hola ${socio.nombre}, recibimos tu pago de ${montoTxt} (${concepto || 'Membresía'}). `
            + `Tu membresía queda activa hasta el ${fechaVenceTxt} (${diasRest} días). ¡Gracias! 💪`;
        const wa = await enviarRecibo(socio.telefono, [socio.nombre, montoTxt, fechaVenceTxt]);
        const link = linkWhatsApp(socio.telefono, texto);

        res.status(201).json({
            transaccion: conId(transaccion),
            socio: {
                _id: socio.id, nombre: socio.nombre,
                fechaVencimiento: socio.fechaVencimiento, diasRestantes: diasRest,
            },
            whatsapp: { enviado: wa.enviado, motivo: wa.motivo || null, link },
        });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Listar transacciones del gimnasio, más recientes primero (con paginación opcional).
/**
 * Lo facturado en un período, abierto por sede.
 *
 * El período llega calculado por el cliente (`desde`/`hasta` como instantes
 * ISO), no se arma acá: el servidor corre en UTC y el gimnasio no, así que
 * "del 1 al 30" salido de `date_trunc` se correría cinco horas y los pagos de
 * la última noche del mes caerían en el mes siguiente. Mismo criterio que en
 * las citas, donde el cliente manda su `hoy`.
 *
 * Solo cuenta lo efectivamente registrado en el período: nada de proyecciones.
 * Se abre por sede y por plan, y el conteo de socios activos va al lado como
 * referencia de cuánta gente hay detrás de esa plata.
 */
/**
 * Lo cobrado en varios meses seguidos, para el gráfico del historial.
 *
 * Los cortes llegan calculados por el cliente (`cortes`: instantes ISO
 * separados por coma, uno más que la cantidad de meses) por lo mismo que en
 * /facturacion: acá no se sabe en qué huso vive el gimnasio, así que armar los
 * meses en el servidor los correría de día.
 */
router.get('/facturacion/meses', verificarToken, soloAdmin, async (req, res) => {
  try {
    const cortes = String(req.query.cortes || '').split(',').filter(Boolean).map(c => new Date(c));
    if (cortes.length < 2 || cortes.length > 14 || cortes.some(c => isNaN(c))) {
      return res.status(400).json({ error: 'Cortes inválidos' });
    }
    for (let i = 1; i < cortes.length; i++) {
      if (cortes[i] <= cortes[i - 1]) return res.status(400).json({ error: 'Los cortes deben ir en orden' });
    }
    if (cortes[cortes.length - 1] - cortes[0] > 400 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'El rango no puede pasar de un año' });
    }

    // Mismo criterio que /facturacion: el admin de un local ve su local.
    const quien = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { sedeId: true, sede: { select: { esPrincipal: true } } }
    });
    const suSede = quien?.sedeId && !quien.sede?.esPrincipal ? quien.sedeId : null;

    const pagos = await prisma.transaccion.findMany({
      where: {
        gymId: req.gymId,
        fecha: { gte: cortes[0], lt: cortes[cortes.length - 1] },
        ...(suSede ? { usuario: { sedeId: suSede } } : {})
      },
      select: { monto: true, fecha: true },
      take: 20000
    });

    const meses = [];
    for (let i = 0; i < cortes.length - 1; i++) {
      meses.push({ desde: cortes[i].toISOString(), hasta: cortes[i + 1].toISOString(), cobrado: new Prisma.Decimal(0), pagos: 0 });
    }
    for (const p of pagos) {
      // Búsqueda lineal sobre doce cubos: no vale la pena nada más listo.
      for (let i = 0; i < meses.length; i++) {
        if (p.fecha >= cortes[i] && p.fecha < cortes[i + 1]) {
          meses[i].cobrado = meses[i].cobrado.plus(p.monto);
          meses[i].pagos++;
          break;
        }
      }
    }

    res.json({ meses: meses.map(m => ({ ...m, cobrado: Number(m.cobrado) })) });
  } catch (error) {
    res.status(500).json({ error: 'Error al calcular el historial' });
  }
});

router.get('/facturacion', verificarToken, soloAdmin, async (req, res) => {
  try {
    const desde = new Date(req.query.desde);
    const hasta = new Date(req.query.hasta);
    if (isNaN(desde) || isNaN(hasta) || hasta <= desde) {
      return res.status(400).json({ error: 'Rango de fechas inválido' });
    }
    // Tope de 62 días: esto es un corte mensual, no un histórico completo.
    if (hasta - desde > 62 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'El período no puede pasar de dos meses' });
    }

    // El admin de un local ve su local; el de la matriz ve todos.
    const quien = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { sedeId: true, sede: { select: { esPrincipal: true } } }
    });
    const suSede = quien?.sedeId && !quien.sede?.esPrincipal ? quien.sedeId : null;

    const sedes = await prisma.sede.findMany({
      where: { gymId: req.gymId, activa: true, ...(suSede ? { id: suSede } : {}) },
      select: { id: true, nombre: true, esPrincipal: true },
      orderBy: [{ esPrincipal: 'desc' }, { nombre: 'asc' }]
    });

    const dondeSocio = {
      gymId: req.gymId, role: 'socio',
      ...(suSede ? { sedeId: suSede } : {})
    };

    const [pagos, activos] = await Promise.all([
      // Los pagos del período, con la sede de quien pagó: la transacción no
      // guarda sede, vive en el socio.
      prisma.transaccion.findMany({
        where: {
          gymId: req.gymId,
          fecha: { gte: desde, lt: hasta },
          ...(suSede ? { usuario: { sedeId: suSede } } : {})
        },
        select: {
          monto: true,
          usuario: { select: { sedeId: true } },
          plan: { select: { id: true, nombre: true } }
        },
        take: 5000
      }),
      // Socio activo = con membresía sin vencer.
      prisma.user.findMany({
        where: { ...dondeSocio, fechaVencimiento: { gte: new Date() } },
        select: { id: true, sedeId: true }
      })
    ]);

    const cero = new Prisma.Decimal(0);
    const cubos = new Map();
    const cubo = (sedeId) => {
      const clave = sedeId || 'sin-sede';
      if (!cubos.has(clave)) cubos.set(clave, { cobrado: cero, pagos: 0, sociosActivos: 0 });
      return cubos.get(clave);
    };

    // Por plan, sobre los mismos pagos. Los que no salieron de un plan caen
    // todos juntos en "Otros cobros": son los montos escritos a mano, como una
    // clase suelta. Lo anterior a que el plan se guardara se repartió por
    // migración emparejando monto y días.
    const porPlan = new Map();
    const cuboPlan = (id, nombre) => {
      const clave = id || 'sin-plan';
      if (!porPlan.has(clave)) porPlan.set(clave, { _id: id, nombre, cobrado: cero, pagos: 0 });
      return porPlan.get(clave);
    };

    for (const p of pagos) {
      const c = cubo(p.usuario?.sedeId);
      c.cobrado = c.cobrado.plus(p.monto);
      c.pagos++;

      const cp = cuboPlan(p.plan?.id || null, p.plan?.nombre || 'Otros cobros');
      cp.cobrado = cp.cobrado.plus(p.monto);
      cp.pagos++;
    }
    for (const a of activos) cubo(a.sedeId).sociosActivos++;

    const filas = sedes.map(s => {
      const c = cubo(s.id);
      return {
        _id: s.id, nombre: s.nombre, esPrincipal: s.esPrincipal,
        cobrado: Number(c.cobrado), pagos: c.pagos,
        sociosActivos: c.sociosActivos
      };
    });

    // Los socios que quedaron sin sede solo aparecen si los hay: si no, sería
    // una fila en cero que confunde. Pero no se descartan, o el total mentiría.
    const huerfanos = cubos.get('sin-sede');
    if (huerfanos && (huerfanos.pagos || huerfanos.sociosActivos)) {
      filas.push({
        _id: null, nombre: 'Sin sede', esPrincipal: false,
        cobrado: Number(huerfanos.cobrado), pagos: huerfanos.pagos,
        sociosActivos: huerfanos.sociosActivos
      });
    }

    res.json({
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      soloSuSede: !!suSede,
      sedes: filas,
      // De mayor a menor: lo que más entra va primero.
      planes: [...porPlan.values()]
        .map(p => ({ _id: p._id, nombre: p.nombre, cobrado: Number(p.cobrado), pagos: p.pagos }))
        .sort((a, b) => b.cobrado - a.cobrado),
      total: filas.reduce((acc, f) => ({
        cobrado: acc.cobrado + f.cobrado,
        pagos: acc.pagos + f.pagos,
        sociosActivos: acc.sociosActivos + f.sociosActivos
      }), { cobrado: 0, pagos: 0, sociosActivos: 0 })
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al calcular la facturación' });
  }
});

router.get('/', verificarToken, soloAdmin, async (req, res) => {
    try {
        const resultado = await paginar(req, prisma.transaccion, { where: { gymId: req.gymId }, orderBy: { createdAt: 'desc' } });
        if (Array.isArray(resultado)) return res.json(resultado.map(conId));
        res.json({ ...resultado, data: resultado.data.map(conId) });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Transacciones de un usuario concreto dentro del gimnasio.
router.get('/usuario/:id', verificarToken, soloAdmin, async (req, res) => {
    try {
        const socio = await prisma.user.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
        if (!socio) {
            return res.status(404).json({ error: 'Usuario no encontrado en este gimnasio' });
        }

        const transacciones = await prisma.transaccion.findMany({
            where: { gymId: req.gymId, usuarioId: req.params.id },
            orderBy: { createdAt: 'desc' }
        });

        res.json(transacciones.map(conId));
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
