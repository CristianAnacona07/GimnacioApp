const express = require('express');
const router = express.Router();
const Noticia = require('../models/noticia');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// Obtener todas las noticias (cualquier usuario autenticado)
router.get('/', verificarToken, async (req, res) => {
  try {
    const noticias = await Noticia.find().sort({ createdAt: -1 });
    res.json(noticias);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener una noticia por ID
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const noticia = await Noticia.findById(req.params.id);
    if (!noticia) return res.status(404).json({ error: 'Noticia no encontrada' });
    res.json(noticia);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear una noticia (solo admin)
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const datosNoticia = {
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
    res.status(400).json({ error: error.message, details: error.errors });
  }
});

// Actualizar una noticia (solo admin)
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { titulo, descripcion, dia, horaInicio, horaFin, estado, imageUrl, whatsappUrl } = req.body;
    const datosActualizacion = { titulo, descripcion };

    if (dia !== undefined) datosActualizacion.dia = dia;
    if (horaInicio !== undefined) datosActualizacion.horaInicio = horaInicio;
    if (horaFin !== undefined) datosActualizacion.horaFin = horaFin;
    if (estado !== undefined) datosActualizacion.estado = estado;
    if (imageUrl !== undefined) datosActualizacion.imageUrl = imageUrl;
    if (whatsappUrl !== undefined) datosActualizacion.whatsappUrl = whatsappUrl;

    const noticia = await Noticia.findByIdAndUpdate(
      req.params.id,
      datosActualizacion,
      { new: true, runValidators: true }
    );

    if (!noticia) return res.status(404).json({ error: 'Noticia no encontrada' });
    res.json(noticia);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar una noticia (solo admin)
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const noticia = await Noticia.findByIdAndDelete(req.params.id);
    if (!noticia) return res.status(404).json({ error: 'Noticia no encontrada' });
    res.json({ mensaje: 'Noticia eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
