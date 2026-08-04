const express = require('express');
const router = express.Router();
const Noticia = require('../models/noticia');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');

router.get('/', verificarToken, async (req, res) => {
  try {
    const filtro = { gymId: req.gymId || null };
    const paginar = req.query.page !== undefined;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    let q = Noticia.find(filtro).sort({ createdAt: -1 });
    if (paginar) q = q.skip((page - 1) * limit).limit(limit);
    const noticias = await q;
    if (paginar) {
      const total = await Noticia.countDocuments(filtro);
      return res.json({ data: noticias, total, page, limit, pages: Math.ceil(total / limit) });
    }
    res.json(noticias);
  } catch (error) {
    console.error('Error Noticias:', error);
    res.status(500).json({ error: 'Error al obtener noticias' });
  }
});

router.get('/:id', verificarToken, async (req, res) => {
  try {
    const noticia = await Noticia.findOne({ _id: req.params.id, gymId: req.gymId });
    if (!noticia) return res.status(404).json({ error: 'Noticia no encontrada' });
    res.json(noticia);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', verificarToken, soloAdmin, async (req, res) => {
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

    const noticiaGuardada = await new Noticia(datosNoticia).save();
    await registrarAuditoria(req, 'CREAR_NOTICIA', { recurso: 'Noticia', recursoId: noticiaGuardada._id, detalle: { titulo: noticiaGuardada.titulo } });
    res.status(201).json(noticiaGuardada);
  } catch (error) {
    res.status(400).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { titulo, descripcion, dia, horaInicio, horaFin, estado, imageUrl, whatsappUrl } = req.body;
    const datos = { titulo, descripcion };
    if (dia !== undefined) datos.dia = dia;
    if (horaInicio !== undefined) datos.horaInicio = horaInicio;
    if (horaFin !== undefined) datos.horaFin = horaFin;
    if (estado !== undefined) datos.estado = estado;
    if (imageUrl !== undefined) datos.imageUrl = imageUrl;
    if (whatsappUrl !== undefined) datos.whatsappUrl = whatsappUrl;

    const noticia = await Noticia.findOneAndUpdate(
      { _id: req.params.id, gymId: req.gymId },
      datos,
      { new: true, runValidators: true }
    );
    if (!noticia) return res.status(404).json({ error: 'Noticia no encontrada' });
    await registrarAuditoria(req, 'EDITAR_NOTICIA', { recurso: 'Noticia', recursoId: noticia._id, detalle: { titulo: noticia.titulo } });
    res.json(noticia);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const resultado = await Noticia.softDelete({ _id: req.params.id, gymId: req.gymId });
    if (resultado.modifiedCount === 0) return res.status(404).json({ error: 'Noticia no encontrada' });
    await registrarAuditoria(req, 'ELIMINAR_NOTICIA', { recurso: 'Noticia', recursoId: req.params.id });
    res.json({ mensaje: 'Noticia eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
