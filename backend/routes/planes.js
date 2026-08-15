const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { paginar } = require('../lib/pagination');

const prisma = getPrismaClient();

function conId(p) {
  if (!p) return p;
  const { id, ...rest } = p;
  return { ...rest, _id: id };
}

router.get('/', verificarToken, async (req, res) => {
  try {
    const resultado = await paginar(req, prisma.plan, { where: { gymId: req.gymId }, orderBy: { createdAt: 'desc' } });
    if (Array.isArray(resultado)) return res.json(resultado.map(conId));
    res.json({ ...resultado, data: resultado.data.map(conId) });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:id', verificarToken, async (req, res) => {
  try {
    const plan = await prisma.plan.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json(conId(plan));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { gymId, _id, id, ...datos } = req.body;
    const plan = await prisma.plan.create({ data: { ...datos, gymId: req.gymId } });
    await registrarAuditoria(req, 'CREAR_PLAN', { recurso: 'Plan', recursoId: plan.id, detalle: { nombre: plan.nombre } });
    res.status(201).json(conId(plan));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { gymId, _id, id, ...datos } = req.body; // no permitir mover el plan de gym
    const actual = await prisma.plan.findFirst({ where: { id: req.params.id, gymId: req.gymId }, select: { id: true } });
    if (!actual) return res.status(404).json({ error: 'Plan no encontrado' });

    const plan = await prisma.plan.update({ where: { id: actual.id }, data: datos });
    await registrarAuditoria(req, 'EDITAR_PLAN', { recurso: 'Plan', recursoId: plan.id, detalle: { nombre: plan.nombre } });
    res.json(conId(plan));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const resultado = await prisma.plan.softDelete({ id: req.params.id, gymId: req.gymId });
    if (!resultado.count) return res.status(404).json({ error: 'Plan no encontrado' });
    await registrarAuditoria(req, 'ELIMINAR_PLAN', { recurso: 'Plan', recursoId: req.params.id });
    res.json({ mensaje: 'Plan eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
