const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { registrarIngreso } = require('../lib/checkin');

const prisma = getPrismaClient();

/**
 * Alta y gestión de lectores de huella / torniquetes por gimnasio, más el
 * control de acceso automático en sí.
 *
 * Todo lo que administra un humano (`/`, `/:id`, `/:id/huellas`) va filtrado
 * por `req.gymId` y requiere JWT de admin. `/verificar` es la excepción: la
 * llama el propio equipo (o el "conector" de su marca corriendo en la PC del
 * gimnasio), que no puede presentar un JWT — se identifica por su número de
 * serie más una clave propia (`apiKeyHash`, hasheada igual que una contraseña).
 */

const MARCAS_VALIDAS = ['zkteco', 'hikvision', 'suprema', 'anviz', 'otro'];

// Genera una clave de equipo y devuelve tanto el valor en claro (para
// mostrarlo una sola vez) como su hash (para guardar).
async function generarClaveDispositivo() {
  const claveEnClaro = crypto.randomBytes(24).toString('hex');
  const apiKeyHash = await bcrypt.hash(claveEnClaro, await bcrypt.genSalt(10));
  return { claveEnClaro, apiKeyHash };
}

function conId(d) {
  if (!d) return d;
  const { id, ...rest } = d;
  return { ...rest, _id: id };
}

// Listar los equipos del gimnasio, el más reciente primero.
router.get('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const equipos = await prisma.dispositivo.findMany({ where: { gymId: req.gymId }, orderBy: { createdAt: 'desc' } });
    res.json(equipos.map(conId));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Registrar un equipo nuevo.
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, serie, marca } = req.body;

    if (typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del equipo es obligatorio' });
    }
    if (typeof serie !== 'string' || !/^[A-Za-z0-9-]{4,32}$/.test(serie.trim())) {
      return res.status(400).json({ error: 'Serie inválida: usa entre 4 y 32 letras, números o guiones' });
    }
    if (marca !== undefined && !MARCAS_VALIDAS.includes(marca)) {
      return res.status(400).json({ error: 'Marca inválida' });
    }

    const { claveEnClaro, apiKeyHash } = await generarClaveDispositivo();
    const equipo = await prisma.dispositivo.create({
      data: {
        gymId: req.gymId,
        nombre: nombre.trim(),
        serie: serie.trim().toUpperCase(),
        marca: marca || 'zkteco',
        apiKeyHash
      }
    });

    await registrarAuditoria(req, 'REGISTRAR_DISPOSITIVO', {
      recurso: 'Dispositivo',
      recursoId: equipo.id,
      detalle: { serie: equipo.serie, marca: equipo.marca }
    });

    // La clave en claro solo se muestra en esta respuesta: no queda guardada
    // en ningún lado sin hashear. Si se pierde, hay que regenerarla.
    res.status(201).json({ ...conId(equipo), apiKey: claveEnClaro });
  } catch (error) {
    // La serie es única a nivel global. No se dice en qué gimnasio está para
    // no filtrar datos de otro cliente; basta con que el admin sepa que choca.
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Esa serie ya está registrada. Verifícala o contacta con soporte.' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Renombrar o activar/desactivar un equipo. La serie no se edita: si cambia el
// aparato, se da de baja y se registra el nuevo.
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const cambios = {};
    if (typeof req.body.nombre === 'string' && req.body.nombre.trim()) {
      cambios.nombre = req.body.nombre.trim();
    }
    if (typeof req.body.activo === 'boolean') cambios.activo = req.body.activo;

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    const actual = await prisma.dispositivo.findFirst({ where: { id: req.params.id, gymId: req.gymId }, select: { id: true } });
    if (!actual) return res.status(404).json({ error: 'Equipo no encontrado' });

    const equipo = await prisma.dispositivo.update({ where: { id: actual.id }, data: cambios });

    await registrarAuditoria(req, 'EDITAR_DISPOSITIVO', {
      recurso: 'Dispositivo',
      recursoId: equipo.id,
      detalle: cambios
    });

    res.json(conId(equipo));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Dar de baja un equipo. Borrado real, para que su serie vuelva a quedar libre.
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const equipo = await prisma.dispositivo.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
    if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });
    await prisma.dispositivo.delete({ where: { id: equipo.id } });

    await registrarAuditoria(req, 'ELIMINAR_DISPOSITIVO', {
      recurso: 'Dispositivo',
      recursoId: req.params.id,
      detalle: { serie: equipo.serie }
    });

    res.json({ mensaje: 'Equipo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Regenerar la clave del equipo (si se perdió o se filtró). Invalida la
// anterior de inmediato: el conector viejo dejará de poder verificar.
router.post('/:id/regenerar-clave', verificarToken, soloAdmin, async (req, res) => {
  try {
    const actual = await prisma.dispositivo.findFirst({ where: { id: req.params.id, gymId: req.gymId }, select: { id: true } });
    if (!actual) return res.status(404).json({ error: 'Equipo no encontrado' });

    const { claveEnClaro, apiKeyHash } = await generarClaveDispositivo();
    await prisma.dispositivo.update({ where: { id: actual.id }, data: { apiKeyHash } });
    await registrarAuditoria(req, 'REGENERAR_CLAVE_DISPOSITIVO', { recurso: 'Dispositivo', recursoId: actual.id });

    res.json({ apiKey: claveEnClaro });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── Mapeo huella ↔ socio ─────────────────────────────────────────────────
// El ID de huella lo asigna el propio equipo al enrolar (un número chico
// interno suyo); acá solo se guarda a qué socio corresponde ese número EN
// ESE equipo puntual.

router.get('/:id/huellas', verificarToken, soloAdmin, async (req, res) => {
  try {
    const dispositivo = await prisma.dispositivo.findFirst({ where: { id: req.params.id, gymId: req.gymId }, select: { id: true } });
    if (!dispositivo) return res.status(404).json({ error: 'Equipo no encontrado' });

    const huellas = await prisma.huella.findMany({
      where: { dispositivoId: dispositivo.id },
      include: { usuario: { select: { id: true, nombre: true, fotoUrl: true } } },
      orderBy: { huellaId: 'asc' }
    });

    res.json(huellas.map((h) => ({
      _id: h.id,
      huellaId: h.huellaId,
      socio: { _id: h.usuario.id, nombre: h.usuario.nombre, fotoUrl: h.usuario.fotoUrl || '' }
    })));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/:id/huellas', verificarToken, soloAdmin, async (req, res) => {
  try {
    const huellaId = Number(req.body.huellaId);
    if (!Number.isInteger(huellaId) || huellaId < 0) {
      return res.status(400).json({ error: 'huellaId debe ser un número entero' });
    }

    const dispositivo = await prisma.dispositivo.findFirst({ where: { id: req.params.id, gymId: req.gymId }, select: { id: true } });
    if (!dispositivo) return res.status(404).json({ error: 'Equipo no encontrado' });

    const socio = await prisma.user.findFirst({ where: { id: req.body.usuarioId, gymId: req.gymId }, select: { id: true } });
    if (!socio) return res.status(404).json({ error: 'Socio no encontrado en este gimnasio' });

    const huella = await prisma.huella.create({ data: { dispositivoId: dispositivo.id, huellaId, usuarioId: socio.id } });
    await registrarAuditoria(req, 'ASOCIAR_HUELLA', {
      recurso: 'Huella', recursoId: huella.id, detalle: { dispositivoId: dispositivo.id, huellaId, usuarioId: socio.id }
    });

    res.status(201).json({ mensaje: 'Huella asociada correctamente' });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Esa huella ya está asociada a otro socio en este equipo' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id/huellas/:huellaId', verificarToken, soloAdmin, async (req, res) => {
  try {
    const dispositivo = await prisma.dispositivo.findFirst({ where: { id: req.params.id, gymId: req.gymId }, select: { id: true } });
    if (!dispositivo) return res.status(404).json({ error: 'Equipo no encontrado' });

    const resultado = await prisma.huella.deleteMany({ where: { dispositivoId: dispositivo.id, huellaId: Number(req.params.huellaId) } });
    if (!resultado.count) return res.status(404).json({ error: 'Esa huella no estaba asociada a este equipo' });

    await registrarAuditoria(req, 'DESASOCIAR_HUELLA', { recurso: 'Dispositivo', recursoId: dispositivo.id, detalle: { huellaId: Number(req.params.huellaId) } });
    res.json({ mensaje: 'Huella desasociada' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── Control de acceso ────────────────────────────────────────────────────
// La llama el conector de la marca, no una persona: sin verificarToken, sin
// req.gymId. El equipo se autentica con su serie + clave, y el gimnasio sale
// de ahí. Responde rápido a propósito — el torniquete está esperando en vivo.
router.post('/verificar', async (req, res) => {
  try {
    const serie = String(req.body.serie || '').trim().toUpperCase();
    const huellaId = Number(req.body.huellaId);
    const clave = req.headers['x-device-key'];

    if (!serie || !Number.isInteger(huellaId) || typeof clave !== 'string' || !clave) {
      return res.status(400).json({ permitir: false, motivo: 'Datos incompletos' });
    }

    const dispositivo = await prisma.dispositivo.findFirst({
      where: { serie, activo: true },
      omit: { apiKeyHash: false }
    });
    if (!dispositivo || !(await bcrypt.compare(clave, dispositivo.apiKeyHash))) {
      return res.status(401).json({ permitir: false, motivo: 'Equipo no autorizado' });
    }
    await prisma.dispositivo.update({ where: { id: dispositivo.id }, data: { ultimaConexion: new Date() } });

    const huella = await prisma.huella.findFirst({
      where: { dispositivoId: dispositivo.id, huellaId },
      include: { usuario: true }
    });
    if (!huella) {
      return res.status(404).json({ permitir: false, motivo: 'Esa huella no está asociada a ningún socio' });
    }

    const socio = huella.usuario;
    const resultado = await registrarIngreso({ gymId: dispositivo.gymId, socio, metodo: 'huella' });

    if (!resultado.permitido) {
      return res.json({ permitir: false, motivo: 'Membresía vencida', socio: socio.nombre });
    }
    res.json({ permitir: true, socio: socio.nombre, diasRestantes: resultado.dias });
  } catch (error) {
    res.status(500).json({ permitir: false, motivo: 'Error del servidor' });
  }
});

module.exports = router;
