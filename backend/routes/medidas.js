const express = require('express');
const router = express.Router();
const Medidas = require('../models/medidas');
const { verificarToken } = require('../middleware/auth');

// Guardar nueva medición
router.post('/', verificarToken, async (req, res) => {
  try {
    const { usuarioId, peso, cintura, cadera, pecho, brazo, muslo } = req.body;
    const medida = new Medidas({ usuarioId, peso, cintura, cadera, pecho, brazo, muslo });
    await medida.save();
    res.status(201).json(medida);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener historial de medidas de un usuario
router.get('/:usuarioId', verificarToken, async (req, res) => {
  try {
    const medidas = await Medidas.find({ usuarioId: req.params.usuarioId })
      .sort({ fecha: 1 })
      .lean();
    res.json(medidas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar una medición
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { peso, cintura, cadera, pecho, brazo, muslo } = req.body;
    const medida = await Medidas.findByIdAndUpdate(
      req.params.id,
      { peso, cintura, cadera, pecho, brazo, muslo },
      { new: true }
    );
    res.json(medida);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar una medición
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    await Medidas.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Medida eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
