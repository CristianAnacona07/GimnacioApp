const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, soloSuperAdmin } = require('../middleware/auth');
const { paginar } = require('../lib/pagination');

const prisma = getPrismaClient();

function conId(f) {
  if (!f) return f;
  const { id, ...rest } = f;
  return { ...rest, _id: id };
}

// POST /api/feedback — cualquier socio/admin autenticado puede enviar
router.post('/', verificarToken, async (req, res) => {
  try {
    const { mensaje, gymNombre } = req.body;
    if (!mensaje?.trim()) return res.status(400).json({ mensaje: 'El mensaje es requerido' });
    if (!req.gymId) return res.status(400).json({ mensaje: 'El usuario debe pertenecer a un gimnasio para enviar feedback' });

    const usuario = await prisma.user.findUnique({ where: { id: req.userId }, select: { nombre: true } });

    const feedback = await prisma.feedback.create({
      data: {
        usuarioId:     req.userId,
        nombreUsuario: usuario?.nombre || 'Usuario',
        gymId:         req.gymId,
        gymNombre:     gymNombre || null,
        mensaje:       mensaje.trim()
      }
    });

    res.status(201).json(conId(feedback));
  } catch (err) {
    res.status(500).json({ mensaje: 'Error al guardar el feedback' });
  }
});

// GET /api/feedback — solo superadmin
router.get('/', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const resultado = await paginar(req, prisma.feedback, { orderBy: { createdAt: 'desc' } });
    if (Array.isArray(resultado)) return res.json(resultado.map(conId));
    res.json({ ...resultado, data: resultado.data.map(conId) });
  } catch {
    res.status(500).json({ mensaje: 'Error al obtener feedbacks' });
  }
});

// PATCH /api/feedback/:id/leido — marcar como leído (solo superadmin)
router.patch('/:id/leido', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    await prisma.feedback.update({ where: { id: req.params.id }, data: { leido: true } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ mensaje: 'Error' });
  }
});

module.exports = router;
