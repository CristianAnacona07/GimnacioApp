const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const router = express.Router();
const Gym  = require('../models/gym');
const User = require('../models/user');
const { verificarToken, soloAdmin, soloSuperAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { generarToken, hashToken } = require('../helpers/tokens');
const { enviarInvitacionAdmin } = require('../helpers/email');

// ── ALTA DEL ADMINISTRADOR DE UN GIMNASIO ────────────────────────
// La cuenta se crea sin contraseña utilizable: se guarda un hash de un valor
// aleatorio que nadie conoce, y la única forma de entrar es el enlace que llega
// por correo. Así no hay que inventar (ni transmitir) una contraseña temporal.

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITACION_DIAS = 7;

const normalizarEmail = (valor) => String(valor || '').toLowerCase().trim();

// Lanza un Error con `.status` para que el handler decida el código de respuesta.
function errorHttp(mensaje, status) {
  const err = new Error(mensaje);
  err.status = status;
  return err;
}

/**
 * Crea el administrador del gimnasio (o reenvía la invitación si ya existe) y
 * le envía el enlace para definir su contraseña.
 */
async function invitarAdmin({ gym, email, nombre, req }) {
  const emailNorm = normalizarEmail(email);
  if (!EMAIL_RX.test(emailNorm)) throw errorHttp('El correo del administrador no es válido', 400);

  // El índice único es {email, gymId}: la búsqueda va acotada a este gimnasio.
  let usuario = await User.findOne({ email: emailNorm, gymId: gym._id });
  const creado = !usuario;

  if (usuario) {
    if (usuario.role !== 'admin') {
      throw errorHttp('Ese correo ya existe en el gimnasio con otro rol', 400);
    }
  } else {
    const passwordInutilizable = await bcrypt.hash(generarToken(), await bcrypt.genSalt(10));
    usuario = new User({
      gymId: gym._id,
      nombre: (nombre || '').trim() || emailNorm.split('@')[0],
      email: emailNorm,
      password: passwordInutilizable,
      role: 'admin',
    });
  }

  const token = generarToken();
  usuario.resetToken = hashToken(token);
  usuario.resetTokenExpiry = new Date(Date.now() + INVITACION_DIAS * 24 * 3600 * 1000);
  await usuario.save();

  const invitacionEnviada = await enviarInvitacionAdmin({
    email: emailNorm,
    nombre: usuario.nombre,
    gymNombre: gym.nombre,
    token,
    dias: INVITACION_DIAS,
  });

  await registrarAuditoria(req, creado ? 'CREAR_ADMIN_GYM' : 'REINVITAR_ADMIN_GYM', {
    recurso: 'User',
    recursoId: usuario._id,
    detalle: { gymId: gym._id, email: emailNorm, invitacionEnviada },
  });

  return { _id: usuario._id, email: emailNorm, nombre: usuario.nombre, creado, invitacionEnviada };
}

// ── PÚBLICAS ────────────────────────────────────────────────────

// Buscar gyms activos (pantalla de selección)
router.get('/buscar', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const filtro = q
      ? { activo: true, nombre: { $regex: q, $options: 'i' } }
      : { activo: true };

    const gyms = await Gym.find(filtro)
      .select('nombre slug logo slogan colores modulos spotifyPlaylist')
      .limit(20).lean();

    res.json(gyms);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener gym por slug
router.get('/:slug', async (req, res) => {
  try {
    const gym = await Gym.findOne({ slug: req.params.slug, activo: true })
      .select('nombre slug logo slogan colores modulos spotifyPlaylist').lean();
    if (!gym) return res.status(404).json({ error: 'Gimnasio no encontrado' });
    res.json(gym);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── SUPERADMIN ───────────────────────────────────────────────────

// Todos los gyms (activos e inactivos)
router.get('/', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const gyms = await Gym.find().sort({ createdAt: -1 }).lean();
    // Contar socios por gym
    const counts = await User.aggregate([
      { $match: { role: { $in: ['socio', 'admin'] } } },
      { $group: { _id: '$gymId', total: { $sum: 1 } } }
    ]);
    const countMap = Object.fromEntries(counts.map(c => [String(c._id), c.total]));
    res.json(gyms.map(g => ({ ...g, totalUsuarios: countMap[String(g._id)] || 0 })));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear gym (solo superadmin)
router.post('/crear', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const { nombre, slug, logo, slogan, colores, modulos, spotifyPlaylist, adminEmail, adminNombre } = req.body;
    const existe = await Gym.findOne({ slug });
    if (existe) return res.status(400).json({ error: 'Ya existe un gimnasio con ese código' });

    // El correo del admin se valida ANTES de crear el gimnasio: así un correo
    // mal escrito no deja un gimnasio a medio configurar.
    const quiereAdmin = !!normalizarEmail(adminEmail);
    if (quiereAdmin && !EMAIL_RX.test(normalizarEmail(adminEmail))) {
      return res.status(400).json({ error: 'El correo del administrador no es válido' });
    }

    const gym = new Gym({ nombre, slug, logo, slogan, colores, modulos, spotifyPlaylist });
    await gym.save();
    await registrarAuditoria(req, 'CREAR_GYM', { recurso: 'Gym', recursoId: gym._id });

    // El gimnasio ya está creado: si la invitación falla se informa, pero no se
    // revierte nada (el superadmin puede reintentarla desde la ficha del gym).
    let admin = null;
    if (quiereAdmin) {
      try {
        admin = await invitarAdmin({ gym, email: adminEmail, nombre: adminNombre, req });
      } catch (err) {
        admin = { error: err.message };
      }
    }

    res.status(201).json({ ...gym.toObject(), admin });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: 'El código ya está en uso' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Administradores del gimnasio (para la ficha del superadmin)
router.get('/:id/admins', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Identificador de gimnasio inválido' });
    }
    const admins = await User.find({ gymId: req.params.id, role: 'admin' })
      .select('nombre email emailVerified createdAt').lean();
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Invitar a un administrador (o reenviarle el enlace si ya existe)
router.post('/:id/admin', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Identificador de gimnasio inválido' });
    }
    const gym = await Gym.findById(req.params.id);
    if (!gym) return res.status(404).json({ error: 'Gimnasio no encontrado' });

    const admin = await invitarAdmin({ gym, email: req.body.email, nombre: req.body.nombre, req });
    res.status(201).json(admin);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.code === 11000) return res.status(400).json({ error: 'Ese correo ya está registrado en el gimnasio' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Activar / desactivar gym
router.patch('/:id/estado', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const gym = await Gym.findByIdAndUpdate(
      req.params.id,
      { activo: req.body.activo },
      { new: true }
    );
    if (!gym) return res.status(404).json({ error: 'Gimnasio no encontrado' });
    await registrarAuditoria(req, 'CAMBIAR_ESTADO_GYM', { recurso: 'Gym', recursoId: req.params.id, detalle: { activo: req.body.activo } });
    res.json(gym);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar gym
router.delete('/:id', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Identificador de gimnasio inválido' });
    }

    // No permitir eliminar un gimnasio que aún tiene usuarios asociados (evita huérfanos)
    const userCount = await User.countDocuments({ gymId: req.params.id });
    if (userCount > 0) {
      return res.status(400).json({ error: 'No se puede eliminar un gimnasio con usuarios activos' });
    }

    const resultado = await Gym.softDelete({ _id: req.params.id });
    if (!resultado || resultado.modifiedCount === 0) {
      return res.status(404).json({ error: 'Gimnasio no encontrado' });
    }
    await registrarAuditoria(req, 'ELIMINAR_GYM', { recurso: 'Gym', recursoId: req.params.id });
    res.json({ mensaje: 'Gimnasio eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── ADMIN DEL GYM ────────────────────────────────────────────────

// Actualizar configuración del gym (admin o superadmin)
router.put('/:id/configuracion', verificarToken, soloAdmin, async (req, res) => {
  try {
    // El admin sólo puede configurar SU propio gym; el superadmin, cualquiera.
    if (req.userRole !== 'superadmin' && String(req.gymId) !== String(req.params.id)) {
      return res.status(403).json({ error: 'No autorizado para configurar este gimnasio' });
    }
    const { nombre, logo, slogan, colores, modulos, spotifyPlaylist } = req.body;
    const cambios = { nombre, logo, slogan, colores, modulos };
    if (typeof spotifyPlaylist === 'string') cambios.spotifyPlaylist = spotifyPlaylist;

    // El subdominio (slug) solo lo puede cambiar el superadmin: afecta el enrutamiento
    // multi-tenant (<slug>.dominio) y es único entre gimnasios.
    if (req.userRole === 'superadmin' && typeof req.body.slug === 'string') {
      const slug = req.body.slug.toLowerCase().trim();
      if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(slug)) {
        return res.status(400).json({ error: 'Subdominio inválido (usa minúsculas, números y guiones)' });
      }
      cambios.slug = slug;
    }

    const gym = await Gym.findByIdAndUpdate(
      req.params.id,
      cambios,
      { new: true, runValidators: true }
    );
    if (!gym) return res.status(404).json({ error: 'Gimnasio no encontrado' });
    await registrarAuditoria(req, 'EDITAR_GYM', { recurso: 'Gym', recursoId: req.params.id });
    res.json(gym);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: 'Ese subdominio ya está en uso' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
