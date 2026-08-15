const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
// Las rutas operativas de recepción usan soloRecepcion: además del admin, las
// puede usar un empleado con cargo de recepcionista (es su trabajo diario).
const { verificarToken, soloRecepcion } = require('../middleware/auth');
const { enviarRecibo, linkWhatsApp } = require('../helpers/whatsapp');
const { ilikeContains } = require('../lib/searchFilters');
const { paginar } = require('../lib/pagination');

const prisma = getPrismaClient();

function conId(a) {
  if (!a) return a;
  const { id, ...rest } = a;
  return { ...rest, _id: id };
}

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
    const existe = await prisma.user.findFirst({ where: { gymId, codigoAcceso: codigo }, select: { id: true } });
    if (!existe) return codigo;
  }
  return 'A' + Date.now().toString().slice(-7);
}

// Devuelve (creándolo si hace falta) el código de acceso de un socio.
router.post('/codigo/:usuarioId', verificarToken, soloRecepcion, async (req, res) => {
  try {
    const socio = await prisma.user.findFirst({ where: { id: req.params.usuarioId, gymId: req.gymId } });
    if (!socio) return res.status(404).json({ mensaje: 'Socio no encontrado' });
    let { codigoAcceso } = socio;
    if (!codigoAcceso) {
      codigoAcceso = await generarCodigoUnico(req.gymId);
      await prisma.user.update({ where: { id: socio.id }, data: { codigoAcceso } });
    }
    res.json({ codigoAcceso });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al generar el código' });
  }
});

// El propio socio obtiene (o genera) su código de acceso, para ver su QR.
router.get('/mi-codigo', verificarToken, async (req, res) => {
  try {
    const usuario = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    let { codigoAcceso } = usuario;
    if (!codigoAcceso) {
      codigoAcceso = await generarCodigoUnico(usuario.gymId);
      await prisma.user.update({ where: { id: usuario.id }, data: { codigoAcceso } });
    }
    res.json({ codigoAcceso });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el código' });
  }
});

// Buscar socios por nombre, correo, cédula o código (para recepción y matrícula).
router.get('/buscar', verificarToken, soloRecepcion, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    const socios = await prisma.user.findMany({
      where: {
        gymId: req.gymId,
        role: { in: ['socio', 'entrenador'] },
        // La cédula se busca con el mismo ILIKE que el nombre para permitir
        // coincidencias parciales (teclear los últimos dígitos ya filtra).
        OR: [
          ilikeContains('nombre', q),
          ilikeContains('email', q),
          ilikeContains('identificacion', q),
          { codigoAcceso: q },
        ],
      },
      select: { id: true, nombre: true, email: true, fotoUrl: true, codigoAcceso: true, fechaVencimiento: true, identificacion: true },
      take: 15
    });

    res.json(socios.map(s => ({
      _id: s.id, nombre: s.nombre, email: s.email, fotoUrl: s.fotoUrl || '',
      codigoAcceso: s.codigoAcceso || '',
      identificacion: s.identificacion || '',
      diasRestantes: diasRestantes(s.fechaVencimiento),
    })));
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al buscar' });
  }
});

// Registrar entrada (check-in). Acepta el código de acceso o el _id del socio.
router.post('/checkin', verificarToken, soloRecepcion, async (req, res) => {
  try {
    const { codigo, usuarioId, metodo } = req.body;
    const filtro = usuarioId
      ? { id: usuarioId, gymId: req.gymId }
      : { codigoAcceso: String(codigo || '').trim(), gymId: req.gymId };
    if (!usuarioId && !filtro.codigoAcceso) {
      return res.status(400).json({ mensaje: 'Código requerido' });
    }

    const socio = await prisma.user.findFirst({ where: { ...filtro, role: { in: ['socio', 'entrenador'] } } });
    if (!socio) return res.status(404).json({ mensaje: 'Socio no encontrado' });

    const dias = diasRestantes(socio.fechaVencimiento);
    const estado = dias > 0 ? 'activo' : 'vencido';

    // Membresía vencida → NO se permite el ingreso ni se registra asistencia.
    if (estado === 'vencido') {
      return res.json({
        acceso: 'denegado',
        mensaje: 'Membresía vencida. Renueva para poder ingresar.',
        socio: {
          _id: socio.id, nombre: socio.nombre, fotoUrl: socio.fotoUrl || '',
          diasRestantes: 0, estado, asistenciasMes: socio.asistenciasMes || 0,
        },
        yaRegistradoHoy: false,
        whatsapp: null,
      });
    }

    // ¿Ya registró hoy? Evita contar dos veces la misma asistencia del día.
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const yaHoy = await prisma.asistencia.findFirst({
      where: { gymId: req.gymId, usuarioId: socio.id, fecha: { gte: inicioDia } },
      select: { id: true },
    });

    let asistenciasMes = socio.asistenciasMes || 0;
    if (!yaHoy) {
      await prisma.asistencia.create({
        data: {
          gymId: req.gymId, usuarioId: socio.id,
          metodo: ['codigo', 'qr', 'huella', 'manual'].includes(metodo) ? metodo : 'codigo',
          registradoPor: req.userId,
        }
      });
      asistenciasMes += 1;
      await prisma.user.update({ where: { id: socio.id }, data: { asistenciasMes } });
    }

    const fechaTxt = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

    // Recibo por WhatsApp: automático (plantilla) si está configurado, y siempre
    // un link wa.me de respaldo para enviarlo manualmente desde recepción.
    const texto = `Hola ${socio.nombre}, tu asistencia del ${fechaTxt} quedó registrada en el gimnasio. `
      + `Te quedan ${dias} días de membresía. ¡A entrenar! 💪`;

    const wa = await enviarRecibo(socio.telefono, [socio.nombre, fechaTxt, String(dias)]);
    const link = linkWhatsApp(socio.telefono, texto);

    res.json({
      acceso: 'permitido',
      socio: {
        _id: socio.id, nombre: socio.nombre, fotoUrl: socio.fotoUrl || '',
        diasRestantes: dias, estado,
        asistenciasMes,
      },
      yaRegistradoHoy: !!yaHoy,
      whatsapp: { enviado: wa.enviado, motivo: wa.motivo || null, link },
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar asistencia' });
  }
});

// Asistencias de hoy (lista de recepción).
router.get('/hoy', verificarToken, soloRecepcion, async (req, res) => {
  try {
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const asistencias = await prisma.asistencia.findMany({
      where: { gymId: req.gymId, fecha: { gte: inicioDia } },
      orderBy: { fecha: 'desc' },
      include: { usuario: { select: { id: true, nombre: true, fotoUrl: true } } }
    });
    res.json(asistencias.map(a => ({
      _id: a.id, fecha: a.fecha, metodo: a.metodo,
      socio: a.usuario ? { _id: a.usuario.id, nombre: a.usuario.nombre, fotoUrl: a.usuario.fotoUrl || '' } : null,
    })));
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cargar asistencias' });
  }
});

// Historial de asistencia de un socio (paginado retro-compatible).
router.get('/historial/:usuarioId', verificarToken, soloRecepcion, async (req, res) => {
  try {
    const resultado = await paginar(req, prisma.asistencia, {
      where: { gymId: req.gymId, usuarioId: req.params.usuarioId },
      orderBy: { fecha: 'desc' },
      defaultLimit: 30
    });
    if (Array.isArray(resultado)) return res.json(resultado.map(conId));
    res.json({ ...resultado, data: resultado.data.map(conId) });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cargar el historial' });
  }
});

module.exports = router;
