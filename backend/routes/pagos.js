const express = require('express');
const router = express.Router();
const MetodoPago = require('../models/pagos');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');

router.get('/', verificarToken, async (req, res) => {
  try {
    const metodos = await MetodoPago.find({ gymId: req.gymId }).sort({ createdAt: -1 });
    res.json(metodos);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:id', verificarToken, async (req, res) => {
  try {
    const metodo = await MetodoPago.findOne({ _id: req.params.id, gymId: req.gymId });
    if (!metodo) return res.status(404).json({ error: 'Método de pago no encontrado' });
    res.json(metodo);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const metodo = new MetodoPago({ ...req.body, gymId: req.gymId });
    await metodo.save();
    await registrarAuditoria(req, 'CREAR_METODO_PAGO', { recurso: 'MetodoPago', recursoId: metodo._id });
    res.status(201).json(metodo);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
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
    await registrarAuditoria(req, 'EDITAR_METODO_PAGO', { recurso: 'MetodoPago', recursoId: metodo._id });
    res.json(metodo);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const resultado = await MetodoPago.softDelete({ _id: req.params.id, gymId: req.gymId });
    if (!resultado.modifiedCount) return res.status(404).json({ error: 'Método de pago no encontrado' });
    await registrarAuditoria(req, 'ELIMINAR_METODO_PAGO', { recurso: 'MetodoPago', recursoId: req.params.id });
    res.json({ mensaje: 'Método de pago eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
