
const express = require('express');
const router = express.Router();
const Rutina = require('../models/rutina');

// 1. Ruta para CREAR o ASIGNAR una rutina a un socio (La usa el Admin)
router.post('/asignar', async (req, res) => {
    try {
        const { usuarioId, nombre, ejercicios, dia, enfoque } = req.body;

        const nuevaRutina = new Rutina({
            usuarioId,
            nombre,
            ejercicios,
            dia,
            enfoque
        });

        await nuevaRutina.save();
        res.status(201).json({ mensaje: 'Rutina asignada con éxito', rutina: nuevaRutina });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al asignar rutina', error: error.message });
    }
});

// 2. Ruta para obtener la rutina de un socio específico (La usa el Socio y el Admin)
// En tu backend (ejemplo del controlador)
router.get('/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;
  // Asegúrate de buscar por el campo 'usuarioId' que vimos en tu MongoDB
  const rutina = await Rutina.find({ usuarioId: usuarioId }); 
  res.json(rutina);
});
// En routes/rutina.js

// Ruta para actualizar (La usará el socio para marcar avances o el admin para corregir)
router.put('/actualizar/:id', async (req, res) => {
    try {
        const rutinaActualizada = await Rutina.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true }
        );
        res.json({ mensaje: 'Rutina actualizada', rutina: rutinaActualizada });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar', error: error.message });
    }
});

// Ruta para borrar una rutina (La usará el Admin)
router.delete('/eliminar/:id', async (req, res) => {
    try {
        await Rutina.findByIdAndDelete(req.params.id);
        res.json({ mensaje: 'Rutina borrada correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al borrar', error: error.message });
    }
});

module.exports = router;