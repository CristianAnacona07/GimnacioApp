const express = require('express');
const router = express.Router();
const Plan = require('../models/planes');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');

router.get('/', verificarToken, async (req, res) => {
  try {
    const filtro = { gymId: req.gymId };
    const paginar = req.query.page !== undefined;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    let q = Plan.find(filtro).sort({ createdAt: -1 });
    if (paginar) q = q.skip((page - 1) * limit).limit(limit);
    const planes = await q.lean();
    if (paginar) {
      const total = await Plan.countDocuments(filtro);
      return res.json({ data: planes, total, page, limit, pages: Math.ceil(total / limit) });
    }
    res.json(planes);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:id', verificarToken, async (req, res) => {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, gymId: req.gymId });
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const plan = new Plan({ ...req.body, gymId: req.gymId });
    await plan.save();
    await registrarAuditoria(req, 'CREAR_PLAN', { recurso: 'Plan', recursoId: plan._id, detalle: { nombre: plan.nombre } });
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { gymId, _id, ...datos } = req.body; // no permitir mover el plan de gym
    const plan = await Plan.findOneAndUpdate(
      { _id: req.params.id, gymId: req.gymId },
      datos,
      { new: true }
    );
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });
    await registrarAuditoria(req, 'EDITAR_PLAN', { recurso: 'Plan', recursoId: plan._id, detalle: { nombre: plan.nombre } });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const resultado = await Plan.softDelete({ _id: req.params.id, gymId: req.gymId });
    const eliminado = resultado && (resultado.deletedCount || resultado.modifiedCount || resultado.nModified);
    if (!eliminado) return res.status(404).json({ error: 'Plan no encontrado' });
    await registrarAuditoria(req, 'ELIMINAR_PLAN', { recurso: 'Plan', recursoId: req.params.id });
    res.json({ mensaje: 'Plan eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
