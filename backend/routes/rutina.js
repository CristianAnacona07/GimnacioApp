const express = require('express');
const router = express.Router();
const Rutina = require('../models/rutina');


// 1. CREAR o ASIGNAR (Limpio y con validación de duplicados)
router.post('/asignar', async (req, res) => {
    try {
        const { usuarioId, nombre, ejercicios, dia, enfoque } = req.body;

        // 🔍 PASO CLAVE: Verificamos si ya existe una rutina para ese socio y ese día
        const rutinaExistente = await Rutina.findOne({ usuarioId, dia });

        if (rutinaExistente) {
            // Si la encuentra, detenemos el proceso y enviamos un error 400
            return res.status(400).json({ 
                mensaje: `El socio ya tiene una rutina asignada para el día ${dia}. Por favor, edita la existente o elige otro día.` 
            });
        }

        // Si no existe, procedemos a guardar normalmente
        const nuevaRutina = new Rutina({ usuarioId, nombre, ejercicios, dia, enfoque });
        await nuevaRutina.save();

        res.status(201).json({ mensaje: 'Rutina asignada con éxito', rutina: nuevaRutina });
    } catch (error) {
        console.error('❌ Error al asignar rutina:', error);
        res.status(500).json({ mensaje: 'Error al asignar rutina', error: error.message });
    }
});

// 2. OBTENER
router.get('/:usuarioId', async (req, res) => {
    try {
        const { usuarioId } = req.params;
        const rutina = await Rutina.find({ usuarioId: usuarioId }).lean(); 
        res.json(rutina);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. ACTUALIZAR
router.put('/actualizar/:id', async (req, res) => {
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

// 4. ELIMINAR (Ahora instantáneo)
router.delete('/eliminar/:id', async (req, res) => {
    try {
        await Rutina.findByIdAndDelete(req.params.id);
        res.json({ mensaje: 'Rutina borrada correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al borrar', error: error.message });
    }
});

// 5. MARCAR EJERCICIO
router.patch('/:rutinaId/ejercicio/:ejercicioIdx', async (req, res) => {
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