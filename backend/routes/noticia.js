const express = require('express');
const router = express.Router();
const Noticia = require('../models/noticia');

// Obtener todas las noticias
router.get('/', async (req, res) => {
  try {
    const noticias = await Noticia.find().sort({ createdAt: -1 });
    res.json(noticias);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener una noticia por ID
router.get('/:id', async (req, res) => {
  try {
    const noticia = await Noticia.findById(req.params.id);
    if (!noticia) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }
    res.json(noticia);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear una noticia
router.post('/', async (req, res) => {
  try {
    console.log('📥 Datos recibidos en backend:', req.body);
    
    // Crear objeto solo con campos que tienen valor
    const datosNoticia = {
      titulo: req.body.titulo,
      descripcion: req.body.descripcion
    };

    // Solo agregar campos opcionales si tienen valor
    if (req.body.dia && req.body.dia !== '') {
      datosNoticia.dia = req.body.dia;
    }
    if (req.body.horaInicio && req.body.horaInicio !== '') {
      datosNoticia.horaInicio = req.body.horaInicio;
    }
    if (req.body.horaFin && req.body.horaFin !== '') {
      datosNoticia.horaFin = req.body.horaFin;
    }

    const noticia = new Noticia(datosNoticia);
    const noticiaGuardada = await noticia.save();
    
    console.log('✅ Noticia guardada:', noticiaGuardada);
    res.status(201).json(noticiaGuardada);
  } catch (error) {
    console.error('❌ Error en backend:', error);
    res.status(400).json({ 
      error: error.message,
      details: error.errors // Mongoose validation errors
    });
  }
});

// Actualizar una noticia
router.put('/:id', async (req, res) => {
  try {
    console.log('📝 Actualizando noticia:', req.params.id);
    console.log('📝 Nuevos datos:', req.body);

    const { titulo, descripcion, dia, horaInicio, horaFin, estado } = req.body;

    // Crear objeto de actualización
    const datosActualizacion = {
      titulo,
      descripcion
    };

    // Solo actualizar campos opcionales si se proporcionan
    if (dia !== undefined) datosActualizacion.dia = dia;
    if (horaInicio !== undefined) datosActualizacion.horaInicio = horaInicio;
    if (horaFin !== undefined) datosActualizacion.horaFin = horaFin;
    if (estado !== undefined) datosActualizacion.estado = estado;

    const noticia = await Noticia.findByIdAndUpdate(
      req.params.id,
      datosActualizacion,
      { new: true, runValidators: true }
    );

    if (!noticia) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }

    console.log('✅ Noticia actualizada:', noticia);
    res.json(noticia);
  } catch (error) {
    console.error('❌ Error al actualizar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar una noticia
router.delete('/:id', async (req, res) => {
  try {
    console.log('🗑️ Eliminando noticia:', req.params.id);
    
    const noticia = await Noticia.findByIdAndDelete(req.params.id);

    if (!noticia) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }

    console.log('✅ Noticia eliminada');
    res.json({ mensaje: 'Noticia eliminada correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;