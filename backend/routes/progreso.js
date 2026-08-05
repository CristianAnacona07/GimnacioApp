const express = require('express');
const router = express.Router();
const Progreso = require('../models/progreso');
const User = require('../models/user');
const { verificarToken, resolverUsuarioId, esAdmin, filtroPropiedad } = require('../middleware/auth');

// Valida que peso y repeticiones, si vienen, sean números finitos dentro de rango.
// Devuelve un mensaje de error si algo es inválido, o null si todo es correcto.
function validarRegistro({ pesoKg, repeticiones }) {
  for (const [campo, valor, max] of [['pesoKg', pesoKg, 1000], ['repeticiones', repeticiones, 1000]]) {
    if (valor === undefined || valor === null || valor === '') continue;
    const num = Number(valor);
    if (!Number.isFinite(num) || num < 0 || num > max) {
      return `Valor inválido para ${campo}`;
    }
  }
  return null;
}

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

router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { pesoKg, repeticiones } = req.body;
    const errorValidacion = validarRegistro({ pesoKg, repeticiones });
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });
    // El socio sólo edita sus propios registros; el admin, los de su gym.
    const registro = await Progreso.findOneAndUpdate(
      { _id: req.params.id, gymId: req.gymId, ...filtroPropiedad(req) },
      { pesoKg, repeticiones },
      { new: true }
    );
    if (!registro) return res.status(404).json({ mensaje: 'Registro no encontrado' });
    res.json(registro);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const registro = await Progreso.findOneAndDelete({ _id: req.params.id, gymId: req.gymId, ...filtroPropiedad(req) });
    if (!registro) return res.status(404).json({ mensaje: 'Registro no encontrado' });
    res.json({ mensaje: 'Registro eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
