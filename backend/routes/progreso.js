const express = require('express');
const router = express.Router();
const Progreso = require('../models/progreso');
const { verificarToken } = require('../middleware/auth');

// Guardar un registro de progreso
router.post('/', verificarToken, async (req, res) => {
    try {
        const { usuarioId, ejercicioNombre, pesoKg, repeticiones } = req.body;
        const registro = new Progreso({ usuarioId, ejercicioNombre, pesoKg, repeticiones });
        await registro.save();
        res.status(201).json(registro);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener historial de un ejercicio específico de un usuario
router.get('/:usuarioId/:ejercicio', verificarToken, async (req, res) => {
    try {
        const { usuarioId, ejercicio } = req.params;
        const registros = await Progreso.find({
            usuarioId,
            ejercicioNombre: decodeURIComponent(ejercicio)
        })
        .sort({ fecha: 1 })
        .lean();
        res.json(registros);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener todos los ejercicios registrados por un usuario (sin duplicados)
router.get('/:usuarioId', verificarToken, async (req, res) => {
    try {
        const { usuarioId } = req.params;
        const ejercicios = await Progreso.distinct('ejercicioNombre', { usuarioId });
        res.json(ejercicios);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
