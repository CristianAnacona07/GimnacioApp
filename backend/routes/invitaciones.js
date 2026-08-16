const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, soloRecepcion } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { toApiGym } = require('../lib/gymMapper');

const prisma = getPrismaClient();

// Cuánto vive una invitación sin usarse.
const VIGENCIA_MS = 48 * 60 * 60 * 1000;

// Crear una invitación (admin o recepcionista). Devuelve el token; el link
// completo y el QR los arma el frontend con su propio origen.
router.post('/', verificarToken, soloRecepcion, async (req, res) => {
  try {
    const invitacion = await prisma.invitacion.create({
      data: {
        gymId: req.gymId,
        token: crypto.randomBytes(24).toString('hex'),
        creadaPor: req.userId,
        expiraEn: new Date(Date.now() + VIGENCIA_MS)
      }
    });
    await registrarAuditoria(req, 'CREAR_INVITACION', { recurso: 'Invitacion', recursoId: invitacion.id });
    res.status(201).json({ token: invitacion.token, expiraEn: invitacion.expiraEn });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear la invitación' });
  }
});

// Validar una invitación (público): la pantalla de registro la usa para saber
// a qué gimnasio pertenece el link y pintar su logo y colores.
router.get('/:token', async (req, res) => {
  try {
    const invitacion = await prisma.invitacion.findFirst({
      where: { token: req.params.token, usada: false, expiraEn: { gt: new Date() } }
    });
    if (!invitacion) {
      return res.status(404).json({ mensaje: 'La invitación no existe, ya fue usada o venció' });
    }
    const gym = await prisma.gym.findFirst({
      where: { id: invitacion.gymId, activo: true },
      select: { id: true, nombre: true, slug: true, logo: true, slogan: true,
        colorPrimario: true, colorSecundario: true, colorFondo: true, colorNavbar: true, colorMenu: true, colorDias: true,
        moduloRutinas: true, moduloProgreso: true, moduloMedidas: true, moduloPagos: true, moduloNoticias: true, moduloCronometro: true,
        spotifyPlaylist: true }
    });
    if (!gym) return res.status(404).json({ mensaje: 'El gimnasio ya no está activo' });
    res.json({ gym: toApiGym(gym), expiraEn: invitacion.expiraEn });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al validar la invitación' });
  }
});

module.exports = router;
