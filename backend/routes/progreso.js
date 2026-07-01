const express = require('express');
const router = express.Router();
const Progreso = require('../models/progreso');
const User = require('../models/user');
const { verificarToken, resolverUsuarioId, esAdmin } = require('../middleware/auth');

router.post('/', verificarToken, async (req, res) => {
  try {
    const { ejercicioNombre, pesoKg, repeticiones } = req.body;
    // El socio sólo escribe progreso a su nombre; el admin puede indicar usuarioId.
    const usuarioId = resolverUsuarioId(req, req.body.usuarioId);
    // Si el admin indica otro usuario, verificar que pertenezca a su gym.
    if (esAdmin(req) && String(usuarioId) !== String(req.userId)) {
      const socio = await User.findOne({ _id: usuarioId, gymId: req.gymId }).select('_id').lean();
      if (!socio) return res.status(404).json({ error: 'Usuario no encontrado en este gimnasio' });
    }
    const registro = new Progreso({ gymId: req.gymId, usuarioId, ejercicioNombre, pesoKg, repeticiones });
    await registro.save();
    res.status(201).json(registro);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:usuarioId/:ejercicio', verificarToken, async (req, res) => {
  try {
    const usuarioId = resolverUsuarioId(req, req.params.usuarioId);
    const registros = await Progreso.find({
      gymId: req.gymId,
      usuarioId,
      ejercicioNombre: decodeURIComponent(req.params.ejercicio)
    }).sort({ fecha: 1 }).lean();
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:usuarioId', verificarToken, async (req, res) => {
  try {
    const usuarioId = resolverUsuarioId(req, req.params.usuarioId);
    const ejercicios = await Progreso.distinct('ejercicioNombre', {
      gymId: req.gymId,
      usuarioId
    });
    res.json(ejercicios);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
