const express = require('express');
const router = express.Router();
const Medidas = require('../models/medidas');
const User = require('../models/user');
const { verificarToken, resolverUsuarioId, filtroPropiedad, esAdmin } = require('../middleware/auth');

router.post('/', verificarToken, async (req, res) => {
  try {
    const { peso, cintura, cadera, pecho, brazo, muslo } = req.body;
    const usuarioId = resolverUsuarioId(req, req.body.usuarioId);
    // Si el admin indica otro usuario, verificar que pertenezca a su gym.
    if (esAdmin(req) && String(usuarioId) !== String(req.userId)) {
      const socio = await User.findOne({ _id: usuarioId, gymId: req.gymId }).select('_id').lean();
      if (!socio) return res.status(404).json({ error: 'Usuario no encontrado en este gimnasio' });
    }
    const medida = new Medidas({ gymId: req.gymId, usuarioId, peso, cintura, cadera, pecho, brazo, muslo });
    await medida.save();
    res.status(201).json(medida);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:usuarioId', verificarToken, async (req, res) => {
  try {
    const usuarioId = resolverUsuarioId(req, req.params.usuarioId);
    const medidas = await Medidas.find({ gymId: req.gymId, usuarioId })
      .sort({ fecha: 1 }).lean();
    res.json(medidas);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { peso, cintura, cadera, pecho, brazo, muslo } = req.body;
    // El socio sólo edita sus propias medidas; el admin, las del gym.
    const medida = await Medidas.findOneAndUpdate(
      { _id: req.params.id, gymId: req.gymId, ...filtroPropiedad(req) },
      { peso, cintura, cadera, pecho, brazo, muslo },
      { new: true }
    );
    if (!medida) return res.status(404).json({ mensaje: 'Medida no encontrada' });
    res.json(medida);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const medida = await Medidas.findOneAndDelete({ _id: req.params.id, gymId: req.gymId, ...filtroPropiedad(req) });
    if (!medida) return res.status(404).json({ mensaje: 'Medida no encontrada' });
    res.json({ mensaje: 'Medida eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
