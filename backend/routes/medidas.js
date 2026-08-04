const express = require('express');
const router = express.Router();
const Medidas = require('../models/medidas');
const User = require('../models/user');
const { verificarToken, resolverUsuarioId, filtroPropiedad, esAdmin } = require('../middleware/auth');

// Límites razonables (en cm/kg) para las medidas corporales.
const LIMITES_MEDIDAS = {
  peso: { max: 300 },
  cintura: { max: 300 },
  cadera: { max: 300 },
  pecho: { max: 300 },
  brazo: { max: 150 },
  muslo: { max: 200 },
};

// Valida que los campos numéricos, si vienen, sean números finitos dentro de rango.
// Devuelve un mensaje de error si algo es inválido, o null si todo es correcto.
function validarMedidas(datos) {
  for (const [campo, { max }] of Object.entries(LIMITES_MEDIDAS)) {
    const valor = datos[campo];
    if (valor === undefined || valor === null || valor === '') continue;
    const num = Number(valor);
    if (!Number.isFinite(num) || num < 0 || num > max) {
      return `Valor inválido para ${campo}`;
    }
  }
  return null;
}

router.post('/', verificarToken, async (req, res) => {
  try {
    const { peso, cintura, cadera, pecho, brazo, muslo } = req.body;
    const errorValidacion = validarMedidas({ peso, cintura, cadera, pecho, brazo, muslo });
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });
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
    const errorValidacion = validarMedidas({ peso, cintura, cadera, pecho, brazo, muslo });
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });
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
