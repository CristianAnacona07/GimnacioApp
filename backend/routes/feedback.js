const express = require('express');
const router = express.Router();
const Feedback = require('../models/feedback');
const User = require('../models/user');
const { verificarToken, soloSuperAdmin } = require('../middleware/auth');

// POST /api/feedback — cualquier socio/admin autenticado puede enviar
router.post('/', verificarToken, async (req, res) => {
  try {
    const { mensaje, gymNombre } = req.body;
    if (!mensaje?.trim()) return res.status(400).json({ mensaje: 'El mensaje es requerido' });
    if (!req.gymId) return res.status(400).json({ mensaje: 'El usuario debe pertenecer a un gimnasio para enviar feedback' });

    const usuario = await User.findById(req.userId).select('nombre').lean();

    const feedback = await Feedback.create({
      usuarioId:     req.userId,
      nombreUsuario: usuario?.nombre || 'Usuario',
      gymId:         req.gymId,
      gymNombre:     gymNombre || null,
      mensaje:       mensaje.trim()
    });

    res.status(201).json(feedback);
  } catch (err) {
    res.status(500).json({ mensaje: 'Error al guardar el feedback' });
  }
});

// GET /api/feedback — solo superadmin
router.get('/', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const filtro = {};
    const paginar = req.query.page !== undefined;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    let q = Feedback.find(filtro).sort({ createdAt: -1 });
    if (paginar) q = q.skip((page - 1) * limit).limit(limit);
    const feedbacks = await q.lean();

    if (paginar) {
      const total = await Feedback.countDocuments(filtro);
      return res.json({ data: feedbacks, total, page, limit, pages: Math.ceil(total / limit) });
    }
    res.json(feedbacks);
  } catch {
    res.status(500).json({ mensaje: 'Error al obtener feedbacks' });
  }
});

// PATCH /api/feedback/:id/leido — marcar como leído (solo superadmin)
router.patch('/:id/leido', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    await Feedback.findByIdAndUpdate(req.params.id, { leido: true });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ mensaje: 'Error' });
  }
});

module.exports = router;
