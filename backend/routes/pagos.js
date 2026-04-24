const express = require('express');
const router = express.Router();
const MetodoPago = require('../models/pagos');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// Obtener todos los métodos de pago (cualquier usuario autenticado)
router.get('/', verificarToken, async (req, res) => {
  try {
    const metodosPago = await MetodoPago.find().sort({ createdAt: -1 });
    res.json(metodosPago);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un método de pago por ID
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const metodoPago = await MetodoPago.findById(req.params.id);
    if (!metodoPago) return res.status(404).json({ error: 'Método de pago no encontrado' });
    res.json(metodoPago);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear un método de pago (solo admin)
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const nuevoMetodo = new MetodoPago(req.body);
    await nuevoMetodo.save();
    res.status(201).json(nuevoMetodo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar un método de pago (solo admin)
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const metodoPagoActualizado = await MetodoPago.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!metodoPagoActualizado) return res.status(404).json({ error: 'Método de pago no encontrado' });
    res.json(metodoPagoActualizado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un método de pago (solo admin)
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const metodoPagoEliminado = await MetodoPago.findByIdAndDelete(req.params.id);
    if (!metodoPagoEliminado) return res.status(404).json({ error: 'Método de pago no encontrado' });
    res.json({ mensaje: 'Método de pago eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
