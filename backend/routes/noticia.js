const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, soloAdmin, requierePermiso } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { paginar } = require('../lib/pagination');
const { emitirAGym } = require('../helpers/tiempoReal');

const prisma = getPrismaClient();

function conId(n) {
  if (!n) return n;
  const { id, ...rest } = n;
  return { ...rest, _id: id };
}

router.get('/', verificarToken, async (req, res) => {
  try {
    const resultado = await paginar(req, prisma.noticia, { where: { gymId: req.gymId || null }, orderBy: { createdAt: 'desc' } });
    if (Array.isArray(resultado)) return res.json(resultado.map(conId));
    res.json({ ...resultado, data: resultado.data.map(conId) });
  } catch (error) {
    console.error('Error Noticias:', error);
    res.status(500).json({ error: 'Error al obtener noticias' });
  }
});

router.get('/:id', verificarToken, async (req, res) => {
  try {
    const noticia = await prisma.noticia.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
    if (!noticia) return res.status(404).json({ error: 'Noticia no encontrada' });
    res.json(conId(noticia));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', verificarToken, requierePermiso('noticias', 'edicion'), async (req, res) => {
  try {
    const datosNoticia = {
      gymId: req.gymId,
      titulo: req.body.titulo,
      descripcion: req.body.descripcion
    };
    if (req.body.dia && req.body.dia !== '') datosNoticia.dia = req.body.dia;
    if (req.body.horaInicio && req.body.horaInicio !== '') datosNoticia.horaInicio = req.body.horaInicio;
    if (req.body.horaFin && req.body.horaFin !== '') datosNoticia.horaFin = req.body.horaFin;
    if (req.body.imageUrl !== undefined) datosNoticia.imageUrl = req.body.imageUrl;
    if (req.body.whatsappUrl !== undefined) datosNoticia.whatsappUrl = req.body.whatsappUrl;

    const noticiaGuardada = await prisma.noticia.create({ data: datosNoticia });
    await registrarAuditoria(req, 'CREAR_NOTICIA', { recurso: 'Noticia', recursoId: noticiaGuardada.id, detalle: { titulo: noticiaGuardada.titulo } });
    // Los avisos se calculan al vuelo, así que no se manda el aviso ya hecho:
    // se avisa de que hay algo que recalcular y cada cliente pide los suyos.
    emitirAGym(req.gymId, 'avisos:revisar', { motivo: 'noticia' });
    res.status(201).json(conId(noticiaGuardada));
  } catch (error) {
    res.status(400).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id', verificarToken, requierePermiso('noticias', 'edicion'), async (req, res) => {
  try {
    const { titulo, descripcion, dia, horaInicio, horaFin, estado, imageUrl, whatsappUrl } = req.body;
    const datos = { titulo, descripcion };
    if (dia !== undefined) datos.dia = dia;
    if (horaInicio !== undefined) datos.horaInicio = horaInicio;
    if (horaFin !== undefined) datos.horaFin = horaFin;
    if (estado !== undefined) datos.estado = estado;
    if (imageUrl !== undefined) datos.imageUrl = imageUrl;
    if (whatsappUrl !== undefined) datos.whatsappUrl = whatsappUrl;

    const actual = await prisma.noticia.findFirst({ where: { id: req.params.id, gymId: req.gymId }, select: { id: true } });
    if (!actual) return res.status(404).json({ error: 'Noticia no encontrada' });

    const noticia = await prisma.noticia.update({ where: { id: actual.id }, data: datos });
    await registrarAuditoria(req, 'EDITAR_NOTICIA', { recurso: 'Noticia', recursoId: noticia.id, detalle: { titulo: noticia.titulo } });
    res.json(conId(noticia));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const resultado = await prisma.noticia.softDelete({ id: req.params.id, gymId: req.gymId });
    if (resultado.count === 0) return res.status(404).json({ error: 'Noticia no encontrada' });
    await registrarAuditoria(req, 'ELIMINAR_NOTICIA', { recurso: 'Noticia', recursoId: req.params.id });
    res.json({ mensaje: 'Noticia eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
