const express = require('express');
const router = express.Router();
const MetodoPago = require('../models/pagos');
const { verificarToken, soloAdmin } = require('../middleware/auth');

router.get('/', verificarToken, async (req, res) => {
  try {
    const metodos = await MetodoPago.find({ gymId: req.gymId }).sort({ createdAt: -1 });
    res.json(metodos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', verificarToken, async (req, res) => {
  try {
    const metodo = await MetodoPago.findOne({ _id: req.params.id, gymId: req.gymId });
    if (!metodo) return res.status(404).json({ error: 'Método de pago no encontrado' });
    res.json(metodo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const metodo = new MetodoPago({ ...req.body, gymId: req.gymId });
    await metodo.save();
    res.status(201).json(metodo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { gymId, _id, ...datos } = req.body; // no permitir mover el método de pago de gym
    const metodo = await MetodoPago.findOneAndUpdate(
      { _id: req.params.id, gymId: req.gymId },
      datos,
      { new: true }
    );
    if (!metodo) return res.status(404).json({ error: 'Método de pago no encontrado' });
    res.json(metodo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const metodo = await MetodoPago.findOneAndDelete({ _id: req.params.id, gymId: req.gymId });
    if (!metodo) return res.status(404).json({ error: 'Método de pago no encontrado' });
    res.json({ mensaje: 'Método de pago eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
