const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Invitacion = require('../models/invitacion');
const Gym = require('../models/gym');
const { verificarToken, soloRecepcion } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');

// Cuánto vive una invitación sin usarse.
const VIGENCIA_MS = 48 * 60 * 60 * 1000;

// Crear una invitación (admin o recepcionista). Devuelve el token; el link
// completo y el QR los arma el frontend con su propio origen.
router.post('/', verificarToken, soloRecepcion, async (req, res) => {
  try {
    const invitacion = await Invitacion.create({
      gymId: req.gymId,
      token: crypto.randomBytes(24).toString('hex'),
      creadaPor: req.userId,
      expiraEn: new Date(Date.now() + VIGENCIA_MS)
    });
    await registrarAuditoria(req, 'CREAR_INVITACION', { recurso: 'Invitacion', recursoId: invitacion._id });
    res.status(201).json({ token: invitacion.token, expiraEn: invitacion.expiraEn });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear la invitación' });
  }
});

// Validar una invitación (público): la pantalla de registro la usa para saber
// a qué gimnasio pertenece el link y pintar su logo y colores.
router.get('/:token', async (req, res) => {
  try {
    const invitacion = await Invitacion.findOne({
      token: req.params.token,
      usada: false,
      expiraEn: { $gt: new Date() }
    }).lean();
    if (!invitacion) {
      return res.status(404).json({ mensaje: 'La invitación no existe, ya fue usada o venció' });
    }
    const gym = await Gym.findOne({ _id: invitacion.gymId, activo: true })
      .select('nombre slug logo slogan colores modulos spotifyPlaylist').lean();
    if (!gym) return res.status(404).json({ mensaje: 'El gimnasio ya no está activo' });
    res.json({ gym, expiraEn: invitacion.expiraEn });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al validar la invitación' });
  }
});

module.exports = router;
