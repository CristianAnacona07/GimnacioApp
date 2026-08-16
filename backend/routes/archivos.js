const express = require('express');
const router = express.Router();
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { almacenConfigurado, guardarImagen, borrarPorUrl } = require('../helpers/almacen');

// Subir una imagen. Llega como data URL en JSON (igual que ya viajaba el logo
// del gimnasio), así el frontend la redimensiona antes y no hace falta manejar
// formularios multiparte.
router.post('/imagen', verificarToken, soloAdmin, async (req, res) => {
  if (!almacenConfigurado()) {
    return res.status(503).json({ mensaje: 'El almacén de archivos no está configurado en el servidor' });
  }
  try {
    const url = await guardarImagen(req.body?.dataUrl, req.body?.carpeta);
    res.status(201).json({ url });
  } catch (error) {
    // Los mensajes de guardarImagen están escritos para el usuario ("supera los
    // 8 MB", "formato no admitido"); cualquier otro fallo se reporta genérico.
    const esDeValidacion = /inválida|admitido|8 MB/i.test(error.message || '');
    if (esDeValidacion) return res.status(400).json({ mensaje: error.message });
    console.error('Error al subir imagen:', error.message);
    res.status(500).json({ mensaje: 'No se pudo guardar la imagen' });
  }
});

// Borrar una imagen ya subida (al quitarla de la galería).
router.delete('/imagen', verificarToken, soloAdmin, async (req, res) => {
  await borrarPorUrl(req.query.url);
  res.json({ mensaje: 'Listo' });
});

module.exports = router;
