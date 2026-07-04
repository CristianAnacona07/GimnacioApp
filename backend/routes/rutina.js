const express = require('express');
const router = express.Router();
const Rutina = require('../models/rutina');
const User = require('../models/user');
const { verificarToken, soloAdmin, resolverUsuarioId, filtroPropiedad } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');

router.post('/asignar', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { usuarioId, nombre, ejercicios, dia, enfoque } = req.body;

    // El socio destino debe pertenecer al mismo gym del admin.
    const socio = await User.findOne({ _id: usuarioId, gymId: req.gymId }).select('_id').lean();
    if (!socio) return res.status(404).json({ mensaje: 'Socio no encontrado en este gimnasio' });

    const rutinaExistente = await Rutina.findOne({ gymId: req.gymId, usuarioId, dia });
    if (rutinaExistente) {
      return res.status(400).json({
        mensaje: `El socio ya tiene una rutina para el día ${dia}. Editá la existente o elegí otro día.`
      });
    }

    const nuevaRutina = new Rutina({ gymId: req.gymId, usuarioId, nombre, ejercicios, dia, enfoque });
    await nuevaRutina.save();
    await registrarAuditoria(req, 'ASIGNAR_RUTINA', {
      recurso: 'Rutina',
      recursoId: nuevaRutina._id,
      detalle: { usuarioId, dia, nombre }
    });
    res.status(201).json({ mensaje: 'Rutina asignada con éxito', rutina: nuevaRutina });
  } catch (error) {
    // Duplicado por el índice único {gymId,usuarioId,dia} (carrera con el findOne previo)
    if (error.code === 11000) {
      return res.status(400).json({ mensaje: `El socio ya tiene una rutina para el día ${req.body.dia}. Editá la existente o elegí otro día.` });
    }
    res.status(500).json({ mensaje: 'Error al asignar rutina' });
  }
});

router.get('/:usuarioId', verificarToken, async (req, res) => {
  try {
    const usuarioId = resolverUsuarioId(req, req.params.usuarioId);
    const rutinas = await Rutina.find({ gymId: req.gymId, usuarioId }).lean();
    res.json(rutinas);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/actualizar/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    // No permitir reasignar la rutina a otro gym/usuario vía body (mass assignment).
    const { gymId, usuarioId, _id, ...datos } = req.body;
    const rutina = await Rutina.findOneAndUpdate(
      { _id: req.params.id, gymId: req.gymId },
      datos,
      { new: true }
    ).lean();
    if (!rutina) return res.status(404).json({ mensaje: 'Rutina no encontrada' });
    res.json({ mensaje: 'Rutina actualizada', rutina });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar' });
  }
});

router.delete('/eliminar/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const resultado = await Rutina.softDelete({ _id: req.params.id, gymId: req.gymId });
    if (resultado.modifiedCount === 0) return res.status(404).json({ mensaje: 'Rutina no encontrada' });
    await registrarAuditoria(req, 'ELIMINAR_RUTINA', {
      recurso: 'Rutina',
      recursoId: req.params.id
    });
    res.json({ mensaje: 'Rutina borrada correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al borrar' });
  }
});

router.patch('/reset-dia/:usuarioId', verificarToken, async (req, res) => {
  try {
    const usuarioId = resolverUsuarioId(req, req.params.usuarioId);

    // El usuario objetivo debe pertenecer al gym del solicitante (evita IDOR
    // por enumeración de IDs entre gimnasios).
    const usuarioObjetivo = await User.findOne({ _id: usuarioId, gymId: req.gymId }).select('_id').lean();
    if (!usuarioObjetivo) return res.status(404).json({ mensaje: 'Usuario no encontrado en este gimnasio' });

    await Rutina.updateMany(
      { gymId: req.gymId, usuarioId },
      { $set: { 'ejercicios.$[].completado': false } }
    );
    res.json({ mensaje: 'Ejercicios reseteados correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.patch('/:rutinaId/ejercicio/:ejercicioIdx', verificarToken, async (req, res) => {
  try {
    const { rutinaId, ejercicioIdx } = req.params;
    const { completado } = req.body;

    // Validar el índice: evita inyectar claves arbitrarias en el path del update.
    const idx = Number(ejercicioIdx);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ mensaje: 'Índice de ejercicio inválido' });
    }

    // El socio sólo puede modificar sus propias rutinas; el admin, las del gym.
    const rutinaExistente = await Rutina.findOne(
      { _id: rutinaId, gymId: req.gymId, ...filtroPropiedad(req) }
    ).lean();
    if (!rutinaExistente) return res.status(404).json({ mensaje: 'No existe esa rutina' });

    // Validar el rango: evita crear índices sparse en el array de ejercicios.
    if (idx >= rutinaExistente.ejercicios.length) {
      return res.status(400).json({ mensaje: 'Índice de ejercicio fuera de rango' });
    }

    const rutina = await Rutina.findOneAndUpdate(
      { _id: rutinaId, gymId: req.gymId, ...filtroPropiedad(req) },
      { $set: { [`ejercicios.${idx}.completado`]: !!completado } },
      { new: true }
    ).lean();

    if (!rutina) return res.status(404).json({ mensaje: 'No existe esa rutina' });
    res.json(rutina);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
