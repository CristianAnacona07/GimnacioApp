const express = require('express');
const router = express.Router();
const Gym  = require('../models/gym');
const User = require('../models/user');
const { verificarToken, soloAdmin, soloSuperAdmin } = require('../middleware/auth');

// ── PÚBLICAS ────────────────────────────────────────────────────

// Buscar gyms activos (pantalla de selección)
router.get('/buscar', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const filtro = q
      ? { activo: true, nombre: { $regex: q, $options: 'i' } }
      : { activo: true };

    const gyms = await Gym.find(filtro)
      .select('nombre slug logo slogan colores modulos')
      .limit(20).lean();

    res.json(gyms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener gym por slug
router.get('/:slug', async (req, res) => {
  try {
    const gym = await Gym.findOne({ slug: req.params.slug, activo: true })
      .select('nombre slug logo slogan colores modulos').lean();
    if (!gym) return res.status(404).json({ error: 'Gimnasio no encontrado' });
    res.json(gym);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Crear gym (solo superadmin)
router.post('/crear', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const { nombre, slug, logo, slogan, colores, modulos } = req.body;
    const existe = await Gym.findOne({ slug });
    if (existe) return res.status(400).json({ error: 'Ya existe un gimnasio con ese código' });

    const gym = new Gym({ nombre, slug, logo, slogan, colores, modulos });
    await gym.save();
    res.status(201).json(gym);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: 'El código ya está en uso' });
    res.status(500).json({ error: error.message });
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
    res.json(gym);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar gym
router.delete('/:id', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    await Gym.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Gimnasio eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── ADMIN DEL GYM ────────────────────────────────────────────────

// Actualizar configuración del gym (admin o superadmin)
router.put('/:id/configuracion', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, logo, slogan, colores, modulos } = req.body;
    const gym = await Gym.findByIdAndUpdate(
      req.params.id,
      { nombre, logo, slogan, colores, modulos },
      { new: true, runValidators: true }
    );
    if (!gym) return res.status(404).json({ error: 'Gimnasio no encontrado' });
    res.json(gym);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
