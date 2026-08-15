const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
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
        const { usuarioId, monto, metodoId, concepto, dias, reemplazar } = req.body;

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
            prisma.user.update({ where: { id: socioActual.id }, data: { fechaVencimiento: nuevaFechaVencimiento } }),
            prisma.transaccion.create({
                data: {
                    gymId: req.gymId,
                    usuarioId,
                    monto,
                    metodoId: metodoId || undefined,
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
