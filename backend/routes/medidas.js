const express = require('express');
const router = express.Router();
const Medidas = require('../models/medidas');
const { verificarToken } = require('../middleware/auth');

router.post('/', verificarToken, async (req, res) => {
  try {
    const { usuarioId, peso, cintura, cadera, pecho, brazo, muslo } = req.body;
    const medida = new Medidas({ gymId: req.gymId, usuarioId, peso, cintura, cadera, pecho, brazo, muslo });
    await medida.save();
    res.status(201).json(medida);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:usuarioId', verificarToken, async (req, res) => {
  try {
    const medidas = await Medidas.find({ gymId: req.gymId, usuarioId: req.params.usuarioId })
      .sort({ fecha: 1 }).lean();
    res.json(medidas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { peso, cintura, cadera, pecho, brazo, muslo } = req.body;
    const medida = await Medidas.findOneAndUpdate(
      { _id: req.params.id, gymId: req.gymId },
      { peso, cintura, cadera, pecho, brazo, muslo },
      { new: true }
    );
    res.json(medida);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', verificarToken, async (req, res) => {
  try {
    await Medidas.findOneAndDelete({ _id: req.params.id, gymId: req.gymId });
    res.json({ mensaje: 'Medida eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
