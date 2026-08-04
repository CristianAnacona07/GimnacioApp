const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Asistencia = require('../models/asistencia');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { enviarRecibo, linkWhatsApp } = require('../helpers/whatsapp');

// Días restantes de membresía (0 si ya venció o no tiene fecha).
function diasRestantes(fechaVencimiento) {
  if (!fechaVencimiento) return 0;
  const dias = Math.ceil((new Date(fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24));
  return dias > 0 ? dias : 0;
}

// Genera un código de acceso único (6 dígitos) dentro del gym.
async function generarCodigoUnico(gymId) {
  for (let i = 0; i < 12; i++) {
    const codigo = String(Math.floor(100000 + Math.random() * 900000));
    const existe = await User.findOne({ gymId, codigoAcceso: codigo }).select('_id').lean();
    if (!existe) return codigo;
  }
  return 'A' + Date.now().toString().slice(-7);
}

// Devuelve (creándolo si hace falta) el código de acceso de un socio.
router.post('/codigo/:usuarioId', verificarToken, soloAdmin, async (req, res) => {
  try {
    const socio = await User.findOne({ _id: req.params.usuarioId, gymId: req.gymId });
    if (!socio) return res.status(404).json({ mensaje: 'Socio no encontrado' });
    if (!socio.codigoAcceso) {
      socio.codigoAcceso = await generarCodigoUnico(req.gymId);
      await socio.save();
    }
    res.json({ codigoAcceso: socio.codigoAcceso });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al generar el código' });
  }
});

// El propio socio obtiene (o genera) su código de acceso, para ver su QR.
router.get('/mi-codigo', verificarToken, async (req, res) => {
  try {
    const usuario = await User.findById(req.userId);
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    if (!usuario.codigoAcceso) {
      usuario.codigoAcceso = await generarCodigoUnico(usuario.gymId);
      await usuario.save();
    }
    res.json({ codigoAcceso: usuario.codigoAcceso });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el código' });
  }
});

// Buscar socios por nombre, correo o código (para la pantalla de recepción).
router.get('/buscar', verificarToken, soloAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const socios = await User.find({
      gymId: req.gymId,
      role: { $in: ['socio', 'entrenador'] },
      $or: [{ nombre: rx }, { email: rx }, { codigoAcceso: q }],
    }).select('nombre email fotoUrl codigoAcceso fechaVencimiento').limit(15).lean();

    res.json(socios.map(s => ({
      _id: s._id, nombre: s.nombre, email: s.email, fotoUrl: s.fotoUrl || '',
      codigoAcceso: s.codigoAcceso || '',
      diasRestantes: diasRestantes(s.fechaVencimiento),
    })));
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al buscar' });
  }
});

// Registrar entrada (check-in). Acepta el código de acceso o el _id del socio.
router.post('/checkin', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { codigo, usuarioId, metodo } = req.body;
    const filtro = usuarioId
      ? { _id: usuarioId, gymId: req.gymId }
      : { codigoAcceso: String(codigo || '').trim(), gymId: req.gymId };
    if (!usuarioId && !filtro.codigoAcceso) {
      return res.status(400).json({ mensaje: 'Código requerido' });
    }

    const socio = await User.findOne({ ...filtro, role: { $in: ['socio', 'entrenador'] } });
    if (!socio) return res.status(404).json({ mensaje: 'Socio no encontrado' });

    const dias = diasRestantes(socio.fechaVencimiento);
    const estado = dias > 0 ? 'activo' : 'vencido';

    // Membresía vencida → NO se permite el ingreso ni se registra asistencia.
    if (estado === 'vencido') {
      return res.json({
        acceso: 'denegado',
        mensaje: 'Membresía vencida. Renueva para poder ingresar.',
        socio: {
          _id: socio._id, nombre: socio.nombre, fotoUrl: socio.fotoUrl || '',
          diasRestantes: 0, estado, asistenciasMes: socio.stats?.asistenciasMes || 0,
        },
        yaRegistradoHoy: false,
        whatsapp: null,
      });
    }

    // ¿Ya registró hoy? Evita contar dos veces la misma asistencia del día.
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const yaHoy = await Asistencia.findOne({
      gymId: req.gymId, usuarioId: socio._id, fecha: { $gte: inicioDia },
    }).select('_id').lean();

    if (!yaHoy) {
      await Asistencia.create({
        gymId: req.gymId, usuarioId: socio._id,
        metodo: ['codigo', 'qr', 'huella', 'manual'].includes(metodo) ? metodo : 'codigo',
        registradoPor: req.userId,
      });
      socio.stats = socio.stats || {};
      socio.stats.asistenciasMes = (socio.stats.asistenciasMes || 0) + 1;
      await socio.save();
    }

    const fechaTxt = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

    // Recibo por WhatsApp: automático (plantilla) si está configurado, y siempre
    // un link wa.me de respaldo para enviarlo manualmente desde recepción.
    const texto = `Hola ${socio.nombre}, tu asistencia del ${fechaTxt} quedó registrada en el gimnasio. `
      + `Te quedan ${dias} días de membresía. ¡A entrenar! 💪`;

    const wa = await enviarRecibo(socio.datosPersonales?.telefono, [socio.nombre, fechaTxt, String(dias)]);
    const link = linkWhatsApp(socio.datosPersonales?.telefono, texto);

    res.json({
      acceso: 'permitido',
      socio: {
        _id: socio._id, nombre: socio.nombre, fotoUrl: socio.fotoUrl || '',
        diasRestantes: dias, estado,
        asistenciasMes: socio.stats?.asistenciasMes || 0,
      },
      yaRegistradoHoy: !!yaHoy,
      whatsapp: { enviado: wa.enviado, motivo: wa.motivo || null, link },
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar asistencia' });
  }
});

// Asistencias de hoy (lista de recepción).
router.get('/hoy', verificarToken, soloAdmin, async (req, res) => {
  try {
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const asistencias = await Asistencia.find({ gymId: req.gymId, fecha: { $gte: inicioDia } })
      .sort({ fecha: -1 })
      .populate('usuarioId', 'nombre fotoUrl')
      .lean();
    res.json(asistencias.map(a => ({
      _id: a._id, fecha: a.fecha, metodo: a.metodo,
      socio: a.usuarioId ? { _id: a.usuarioId._id, nombre: a.usuarioId.nombre, fotoUrl: a.usuarioId.fotoUrl || '' } : null,
    })));
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cargar asistencias' });
  }
});

// Historial de asistencia de un socio (paginado retro-compatible).
router.get('/historial/:usuarioId', verificarToken, soloAdmin, async (req, res) => {
  try {
    const filtro = { gymId: req.gymId, usuarioId: req.params.usuarioId };
    const paginar = req.query.page !== undefined;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    let q = Asistencia.find(filtro).sort({ fecha: -1 });
    if (paginar) q = q.skip((page - 1) * limit).limit(limit);
    const items = await q.lean();
    if (paginar) {
      const total = await Asistencia.countDocuments(filtro);
      return res.json({ data: items, total, page, limit, pages: Math.ceil(total / limit) });
    }
    res.json(items);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cargar el historial' });
  }
});

module.exports = router;
