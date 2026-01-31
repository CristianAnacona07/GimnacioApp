const express = require('express');
const router = express.Router();
const Rutina = require('../models/rutina');
const cron = require('node-cron');

// Función auxiliar para no repetir código
const limpiarCacheSocio = (req, usuarioId) => {
    const clearCache = req.app.get('clearUserCache');
    if (clearCache && usuarioId) {
        clearCache(usuarioId);
    }
};

// 1. CREAR o ASIGNAR (Limpia caché del socio receptor)
router.post('/asignar', async (req, res) => {
    try {
        const { usuarioId, nombre, ejercicios, dia, enfoque } = req.body;
        const nuevaRutina = new Rutina({ usuarioId, nombre, ejercicios, dia, enfoque });
        await nuevaRutina.save();

        limpiarCacheSocio(req, usuarioId); // 🔥 Limpia caché

        res.status(201).json({ mensaje: 'Rutina asignada con éxito', rutina: nuevaRutina });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al asignar rutina', error: error.message });
    }
});

// 2. OBTENER (Usa .lean() para máxima velocidad)
router.get('/:usuarioId', async (req, res) => {
    try {
        const { usuarioId } = req.params;
        // Agregamos .lean() para que la respuesta sea un objeto JS plano y más rápido
        const rutina = await Rutina.find({ usuarioId: usuarioId }).lean(); 
        res.json(rutina);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. ACTUALIZAR GENERAL
router.put('/actualizar/:id', async (req, res) => {
    try {
        const rutinaActualizada = await Rutina.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true }
        ).lean();

        if (rutinaActualizada) {
            limpiarCacheSocio(req, rutinaActualizada.usuarioId); // 🔥 Limpia caché
        }

        res.json({ mensaje: 'Rutina actualizada', rutina: rutinaActualizada });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar', error: error.message });
    }
});

// 4. ELIMINAR
router.delete('/eliminar/:id', async (req, res) => {
    try {
        const rutina = await Rutina.findById(req.params.id);
        if (rutina) {
            const idSocio = rutina.usuarioId;
            await Rutina.findByIdAndDelete(req.params.id);
            limpiarCacheSocio(req, idSocio); // 🔥 Limpia caché tras borrar
        }
        res.json({ mensaje: 'Rutina borrada correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al borrar', error: error.message });
    }
});

// 5. MARCAR EJERCICIO (PATCH)
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

        limpiarCacheSocio(req, rutina.usuarioId); // 🔥 Limpia caché para que el socio vea el check azul

        res.json(rutina);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;