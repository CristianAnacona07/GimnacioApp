const express = require('express');
const router = express.Router();
const Plan = require('../models/planes');

// Obtener todos los planes
router.get('/', async (req, res) => {
  try {
    const planes = await Plan.find().sort({ createdAt: -1 });
    res.json(planes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un plan por ID
router.get('/:id', async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear un plan
router.post('/', async (req, res) => {
  try {
    console.log('📥 Datos recibidos en backend:', req.body);
    const plan = new Plan(req.body);
    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar un plan
router.put('/:id', async (req, res) => {
  try {
    console.log('📝 Actualizando plan:', req.params.id);
    console.log('📝 Nuevos datos:', req.body);
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un plan
router.delete('/:id', async (req, res) => {
  try {
    console.log('🗑️ Eliminando plan:', req.params.id);
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }
    res.json({ mensaje: 'Plan eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;    