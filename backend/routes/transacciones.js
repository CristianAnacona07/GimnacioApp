const express = require('express');
const router = express.Router();
const Transaccion = require('../models/transaccion');
const User = require('../models/user');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');

// Registrar un pago/transacción para un socio del gimnasio.
router.post('/registrar', verificarToken, soloAdmin, async (req, res) => {
    try {
        const { usuarioId, monto, metodoId, concepto, dias } = req.body;

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
        const socio = await User.findOne({ _id: usuarioId, gymId: req.gymId });
        if (!socio) {
            return res.status(404).json({ error: 'Usuario no encontrado en este gimnasio' });
        }

        // Extender vencimiento desde max(hoy, vencimiento actual).
        if (diasAgregados > 0) {
            const ahora = new Date();
            const vencimientoActual = socio.fechaVencimiento && socio.fechaVencimiento > ahora
                ? new Date(socio.fechaVencimiento)
                : ahora;
            vencimientoActual.setDate(vencimientoActual.getDate() + diasAgregados);
            socio.fechaVencimiento = vencimientoActual;
            await socio.save();
        }

        const tx = new Transaccion({
            gymId: req.gymId,
            usuarioId,
            monto,
            metodoId: metodoId || undefined,
            concepto: concepto || 'Membresía',
            diasAgregados,
            registradoPor: req.userId
        });
        await tx.save();

        await registrarAuditoria(req, 'REGISTRAR_PAGO', {
            recurso: 'Transaccion',
            recursoId: tx._id,
            detalle: { monto, dias: diasAgregados }
        });

        res.status(201).json(tx);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Listar transacciones del gimnasio, más recientes primero (con paginación opcional).
router.get('/', verificarToken, soloAdmin, async (req, res) => {
    try {
        const filtro = { gymId: req.gymId };
        const paginar = req.query.page !== undefined;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

        let q = Transaccion.find(filtro).sort({ createdAt: -1 });
        if (paginar) q = q.skip((page - 1) * limit).limit(limit);
        const items = await q.lean();

        if (paginar) {
            const total = await Transaccion.countDocuments(filtro);
            return res.json({ data: items, total, page, limit, pages: Math.ceil(total / limit) });
        }
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Transacciones de un usuario concreto dentro del gimnasio.
router.get('/usuario/:id', verificarToken, soloAdmin, async (req, res) => {
    try {
        const socio = await User.findOne({ _id: req.params.id, gymId: req.gymId }).lean();
        if (!socio) {
            return res.status(404).json({ error: 'Usuario no encontrado en este gimnasio' });
        }

        const transacciones = await Transaccion
            .find({ gymId: req.gymId, usuarioId: req.params.id })
            .sort({ createdAt: -1 })
            .lean();

        res.json(transacciones);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
