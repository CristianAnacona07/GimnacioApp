const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, resolverUsuarioId, esAdmin, filtroPropiedad } = require('../middleware/auth');

const prisma = getPrismaClient();

function conId(p) {
  if (!p) return p;
  const { id, ...rest } = p;
  return { ...rest, _id: id };
}

// Valida que peso y repeticiones, si vienen, sean números finitos dentro de rango.
// Devuelve un mensaje de error si algo es inválido, o null si todo es correcto.
function validarRegistro({ pesoKg, repeticiones }) {
  for (const [campo, valor, max] of [['pesoKg', pesoKg, 1000], ['repeticiones', repeticiones, 1000]]) {
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
    const { ejercicioNombre, pesoKg, repeticiones } = req.body;
    // El socio sólo escribe progreso a su nombre; el admin puede indicar usuarioId.
    const usuarioId = resolverUsuarioId(req, req.body.usuarioId);
    // Si el admin indica otro usuario, verificar que pertenezca a su gym.
    if (esAdmin(req) && String(usuarioId) !== String(req.userId)) {
      const socio = await prisma.user.findFirst({ where: { id: usuarioId, gymId: req.gymId }, select: { id: true } });
      if (!socio) return res.status(404).json({ error: 'Usuario no encontrado en este gimnasio' });
    }
    const registro = await prisma.progreso.create({ data: { gymId: req.gymId, usuarioId, ejercicioNombre, pesoKg, repeticiones } });
    res.status(201).json(conId(registro));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:usuarioId/:ejercicio', verificarToken, async (req, res) => {
  try {
    const usuarioId = resolverUsuarioId(req, req.params.usuarioId);
    const registros = await prisma.progreso.findMany({
      where: { gymId: req.gymId, usuarioId, ejercicioNombre: decodeURIComponent(req.params.ejercicio) },
      // El id desempata registros con la misma fecha (series guardadas en tanda)
      // para que el orden sea siempre el de inserción.
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }]
    });
    res.json(registros.map(conId));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:usuarioId', verificarToken, async (req, res) => {
  try {
    const usuarioId = resolverUsuarioId(req, req.params.usuarioId);
    const filas = await prisma.progreso.findMany({
      where: { gymId: req.gymId, usuarioId },
      distinct: ['ejercicioNombre'],
      select: { ejercicioNombre: true }
    });
    res.json(filas.map((f) => f.ejercicioNombre));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { pesoKg, repeticiones } = req.body;
    const errorValidacion = validarRegistro({ pesoKg, repeticiones });
    if (errorValidacion) return res.status(400).json({ mensaje: errorValidacion });
    // El socio sólo edita sus propios registros; el admin, los de su gym.
    const actual = await prisma.progreso.findFirst({
      where: { id: req.params.id, gymId: req.gymId, ...filtroPropiedad(req) },
      select: { id: true }
    });
    if (!actual) return res.status(404).json({ mensaje: 'Registro no encontrado' });
    const registro = await prisma.progreso.update({ where: { id: actual.id }, data: { pesoKg, repeticiones } });
    res.json(conId(registro));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const actual = await prisma.progreso.findFirst({
      where: { id: req.params.id, gymId: req.gymId, ...filtroPropiedad(req) },
      select: { id: true }
    });
    if (!actual) return res.status(404).json({ mensaje: 'Registro no encontrado' });
    await prisma.progreso.delete({ where: { id: actual.id } });
    res.json({ mensaje: 'Registro eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
