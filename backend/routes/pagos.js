const express = require('express');
const router = express.Router();
const MetodoPago = require('../models/pagos'); // Asegúrate que el archivo en models se llame pagos.js

// Obtener todos los métodos de pago
router.get('/', async (req, res) => {
  try {
    const metodosPago = await MetodoPago.find().sort({ createdAt: -1 });
    res.json(metodosPago);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear un método de pago
router.post('/', async (req, res) => {
  try {
    console.log('📥 Nuevo Método de Pago:', req.body);
    const nuevoMetodo = new MetodoPago(req.body);
    await nuevoMetodo.save();
    res.status(201).json(nuevoMetodo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un método de pago por ID
router.get('/:id', async (req, res) => {
  try {
    const metodoPago = await MetodoPago.findById(req.params.id);
    if (!metodoPago) {
      return res.status(404).json({ error: 'Metodo de Pago no encontrado' });
    }
    res.json(metodoPago);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar un método de pago por ID
router.put('/:id', async (req, res) => {
  try {
    const metodoPagoActualizado = await MetodoPago.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!metodoPagoActualizado) {
      return res.status(404).json({ error: 'Metodo de Pago no encontrado' });
    }
    res.json(metodoPagoActualizado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un método de pago por ID
router.delete('/:id', async (req, res) => {
  try {
    const metodoPagoEliminado = await MetodoPago.findByIdAndDelete(req.params.id);
    if (!metodoPagoEliminado) {
      return res.status(404).json({ error: 'Metodo de Pago no encontrado' });
    }
    res.json({ mensaje: 'Metodo de Pago eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});




module.exports = router;