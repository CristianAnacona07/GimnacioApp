const express = require('express');
const router = express.Router();
const Progreso = require('../models/progreso');
const { verificarToken } = require('../middleware/auth');

router.post('/', verificarToken, async (req, res) => {
  try {
    const { usuarioId, ejercicioNombre, pesoKg, repeticiones } = req.body;
    const registro = new Progreso({ gymId: req.gymId, usuarioId, ejercicioNombre, pesoKg, repeticiones });
    await registro.save();
    res.status(201).json(registro);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:usuarioId/:ejercicio', verificarToken, async (req, res) => {
  try {
    const { usuarioId, ejercicio } = req.params;
    const registros = await Progreso.find({
      gymId: req.gymId,
      usuarioId,
      ejercicioNombre: decodeURIComponent(ejercicio)
    }).sort({ fecha: 1 }).lean();
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:usuarioId', verificarToken, async (req, res) => {
  try {
    const ejercicios = await Progreso.distinct('ejercicioNombre', {
      gymId: req.gymId,
      usuarioId: req.params.usuarioId
    });
    res.json(ejercicios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
