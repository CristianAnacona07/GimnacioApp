const express = require('express');
const router = express.Router();
const Plan = require('../models/planes');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// Obtener todos los planes (cualquier usuario autenticado)
router.get('/', verificarToken, async (req, res) => {
  try {
    const planes = await Plan.find().sort({ createdAt: -1 });
    res.json(planes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un plan por ID
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear un plan (solo admin)
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const plan = new Plan(req.body);
    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar un plan (solo admin)
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un plan (solo admin)
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json({ mensaje: 'Plan eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
