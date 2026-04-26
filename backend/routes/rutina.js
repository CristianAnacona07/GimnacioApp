const express = require('express');
const router = express.Router();
const Rutina = require('../models/rutina');
const { verificarToken, soloAdmin } = require('../middleware/auth');

router.post('/asignar', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { usuarioId, nombre, ejercicios, dia, enfoque } = req.body;

    const rutinaExistente = await Rutina.findOne({ gymId: req.gymId, usuarioId, dia });
    if (rutinaExistente) {
      return res.status(400).json({
        mensaje: `El socio ya tiene una rutina para el día ${dia}. Editá la existente o elegí otro día.`
      });
    }

    const nuevaRutina = new Rutina({ gymId: req.gymId, usuarioId, nombre, ejercicios, dia, enfoque });
    await nuevaRutina.save();
    res.status(201).json({ mensaje: 'Rutina asignada con éxito', rutina: nuevaRutina });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al asignar rutina', error: error.message });
  }
});

router.get('/:usuarioId', verificarToken, async (req, res) => {
  try {
    const rutinas = await Rutina.find({ gymId: req.gymId, usuarioId: req.params.usuarioId }).lean();
    res.json(rutinas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/actualizar/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const rutina = await Rutina.findOneAndUpdate(
      { _id: req.params.id, gymId: req.gymId },
      req.body,
      { new: true }
    ).lean();
    res.json({ mensaje: 'Rutina actualizada', rutina });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar', error: error.message });
  }
});

router.delete('/eliminar/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    await Rutina.findOneAndDelete({ _id: req.params.id, gymId: req.gymId });
    res.json({ mensaje: 'Rutina borrada correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al borrar', error: error.message });
  }
});

router.patch('/reset-dia/:usuarioId', verificarToken, async (req, res) => {
  try {
    await Rutina.updateMany(
      { gymId: req.gymId, usuarioId: req.params.usuarioId },
      { $set: { 'ejercicios.$[].completado': false } }
    );
    res.json({ mensaje: 'Ejercicios reseteados correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:rutinaId/ejercicio/:ejercicioIdx', verificarToken, async (req, res) => {
  try {
    const { rutinaId, ejercicioIdx } = req.params;
    const { completado } = req.body;

    const rutina = await Rutina.findOneAndUpdate(
      { _id: rutinaId, gymId: req.gymId },
      { $set: { [`ejercicios.${ejercicioIdx}.completado`]: completado } },
      { new: true }
    ).lean();

    if (!rutina) return res.status(404).json({ mensaje: 'No existe esa rutina' });
    res.json(rutina);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
