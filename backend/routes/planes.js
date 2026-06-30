const express = require('express');
const router = express.Router();
const Plan = require('../models/planes');
const { verificarToken, soloAdmin } = require('../middleware/auth');

router.get('/', verificarToken, async (req, res) => {
  try {
    const planes = await Plan.find({ gymId: req.gymId }).sort({ createdAt: -1 });
    res.json(planes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', verificarToken, async (req, res) => {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, gymId: req.gymId });
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const plan = new Plan({ ...req.body, gymId: req.gymId });
    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const plan = await Plan.findOneAndDelete({ _id: req.params.id, gymId: req.gymId });
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json({ mensaje: 'Plan eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
