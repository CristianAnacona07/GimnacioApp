const express = require('express');
const router = express.Router();
const Noticia = require('../models/noticia');
const { verificarToken, soloAdmin } = require('../middleware/auth');

router.get('/', verificarToken, async (req, res) => {
  try {
    const query = { gymId: req.gymId || null };
    const noticias = await Noticia.find(query).sort({ createdAt: -1 });
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
    res.json(noticia);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const noticia = await Noticia.findOneAndDelete({ _id: req.params.id, gymId: req.gymId });
    if (!noticia) return res.status(404).json({ error: 'Noticia no encontrada' });
    res.json({ mensaje: 'Noticia eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
