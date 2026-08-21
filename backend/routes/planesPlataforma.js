// Planes de SUSCRIPCIÓN A LA PLATAFORMA: lo que el superadmin le cobra a un
// gimnasio por usar la app. No confundir con /api/planes, que son los planes
// de membresía que cada gimnasio le vende a SUS socios — misma forma
// (nombre + precio), significado de dinero completamente distinto.
const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, soloSuperAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');

const prisma = getPrismaClient();

function conId(p) {
  if (!p) return p;
  const { id, ...rest } = p;
  return { ...rest, _id: id };
}

// Lista única, no por gimnasio: a diferencia de /api/planes no hace falta
// paginar (son pocos planes de plataforma, no cientos por tenant).
router.get('/', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const planes = await prisma.planPlataforma.findMany({ orderBy: { precioMensual: 'asc' } });
    res.json(planes.map(conId));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const { _id, id, ...datos } = req.body;
    const plan = await prisma.planPlataforma.create({ data: datos });
    await registrarAuditoria(req, 'CREAR_PLAN_PLATAFORMA', { recurso: 'PlanPlataforma', recursoId: plan.id, detalle: { nombre: plan.nombre } });
    res.status(201).json(conId(plan));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const { _id, id, ...datos } = req.body;
    const actual = await prisma.planPlataforma.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!actual) return res.status(404).json({ error: 'Plan no encontrado' });

    const plan = await prisma.planPlataforma.update({ where: { id: actual.id }, data: datos });
    await registrarAuditoria(req, 'EDITAR_PLAN_PLATAFORMA', { recurso: 'PlanPlataforma', recursoId: plan.id, detalle: { nombre: plan.nombre } });
    res.json(conId(plan));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Borrar un plan no rompe los gimnasios que lo tenían asignado: la FK es
// ON DELETE SET NULL, quedan sin plan en vez de dar error.
router.delete('/:id', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const resultado = await prisma.planPlataforma.softDelete({ id: req.params.id });
    if (!resultado.count) return res.status(404).json({ error: 'Plan no encontrado' });
    await registrarAuditoria(req, 'ELIMINAR_PLAN_PLATAFORMA', { recurso: 'PlanPlataforma', recursoId: req.params.id });
    res.json({ mensaje: 'Plan eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
