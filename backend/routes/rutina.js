const express = require('express');
const router = express.Router();
const Rutina = require('../models/rutina');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// CREAR / ASIGNAR (solo admin)
router.post('/asignar', verificarToken, soloAdmin, async (req, res) => {
    try {
        const { usuarioId, nombre, ejercicios, dia, enfoque } = req.body;

        const rutinaExistente = await Rutina.findOne({ usuarioId, dia });
        if (rutinaExistente) {
            return res.status(400).json({
                mensaje: `El socio ya tiene una rutina asignada para el día ${dia}. Por favor, edita la existente o elige otro día.`
            });
        }

        const nuevaRutina = new Rutina({ usuarioId, nombre, ejercicios, dia, enfoque });
        await nuevaRutina.save();

        res.status(201).json({ mensaje: 'Rutina asignada con éxito', rutina: nuevaRutina });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al asignar rutina', error: error.message });
    }
});

// OBTENER RUTINAS DE UN USUARIO
router.get('/:usuarioId', verificarToken, async (req, res) => {
    try {
        const rutina = await Rutina.find({ usuarioId: req.params.usuarioId }).lean();
        res.json(rutina);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ACTUALIZAR (solo admin)
router.put('/actualizar/:id', verificarToken, soloAdmin, async (req, res) => {
    try {
        const rutinaActualizada = await Rutina.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        ).lean();
        res.json({ mensaje: 'Rutina actualizada', rutina: rutinaActualizada });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar', error: error.message });
    }
});

// ELIMINAR (solo admin)
router.delete('/eliminar/:id', verificarToken, soloAdmin, async (req, res) => {
    try {
        await Rutina.findByIdAndDelete(req.params.id);
        res.json({ mensaje: 'Rutina borrada correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al borrar', error: error.message });
    }
});

// RESET DIARIO — pone todos los completado en false
router.patch('/reset-dia/:usuarioId', verificarToken, async (req, res) => {
    try {
        await Rutina.updateMany(
            { usuarioId: req.params.usuarioId },
            { $set: { 'ejercicios.$[].completado': false } }
        );
        res.json({ mensaje: 'Ejercicios reseteados correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// RESET DIARIO — pone todos los completado en false
router.patch('/reset-dia/:usuarioId', verificarToken, async (req, res) => {
    try {
        await Rutina.updateMany(
            { usuarioId: req.params.usuarioId },
            { $set: { 'ejercicios.$[].completado': false } }
        );
        res.json({ mensaje: 'Ejercicios reseteados' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// MARCAR EJERCICIO COMPLETADO (usuario autenticado)
router.patch('/:rutinaId/ejercicio/:ejercicioIdx', verificarToken, async (req, res) => {
    try {
        const { rutinaId, ejercicioIdx } = req.params;
        const { completado } = req.body;

        const rutina = await Rutina.findByIdAndUpdate(
            rutinaId,
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
