const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');

const prisma = getPrismaClient();

function conId(m) {
  if (!m) return m;
  const { id, ...rest } = m;
  return { ...rest, _id: id };
}

router.get('/', verificarToken, async (req, res) => {
  try {
    const metodos = await prisma.metodoPago.findMany({ where: { gymId: req.gymId }, orderBy: { createdAt: 'desc' } });
    res.json(metodos.map(conId));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:id', verificarToken, async (req, res) => {
  try {
    const metodo = await prisma.metodoPago.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
    if (!metodo) return res.status(404).json({ error: 'Método de pago no encontrado' });
    res.json(conId(metodo));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { gymId, _id, id, ...datos } = req.body;
    const metodo = await prisma.metodoPago.create({ data: { ...datos, gymId: req.gymId } });
    await registrarAuditoria(req, 'CREAR_METODO_PAGO', { recurso: 'MetodoPago', recursoId: metodo.id });
    res.status(201).json(conId(metodo));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { gymId, _id, id, ...datos } = req.body; // no permitir mover el método de pago de gym
    const actual = await prisma.metodoPago.findFirst({ where: { id: req.params.id, gymId: req.gymId }, select: { id: true } });
    if (!actual) return res.status(404).json({ error: 'Método de pago no encontrado' });

    const metodo = await prisma.metodoPago.update({ where: { id: actual.id }, data: datos });
    await registrarAuditoria(req, 'EDITAR_METODO_PAGO', { recurso: 'MetodoPago', recursoId: metodo.id });
    res.json(conId(metodo));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const resultado = await prisma.metodoPago.softDelete({ id: req.params.id, gymId: req.gymId });
    if (!resultado.count) return res.status(404).json({ error: 'Método de pago no encontrado' });
    await registrarAuditoria(req, 'ELIMINAR_METODO_PAGO', { recurso: 'MetodoPago', recursoId: req.params.id });
    res.json({ mensaje: 'Método de pago eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
