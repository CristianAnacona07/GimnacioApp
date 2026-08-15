const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');

const prisma = getPrismaClient();

/**
 * Alta y gestión de lectores de huella / torniquetes por gimnasio.
 *
 * Todo aquí va filtrado por `req.gymId`: un admin solo ve y toca los equipos de
 * su propio gimnasio. La ruta que recibirá las marcaciones del aparato NO vive
 * en este archivo, porque el equipo no puede presentar un JWT: se identificará
 * por número de serie contra los registros que se dan de alta aquí.
 */

const MARCAS_VALIDAS = ['zkteco', 'hikvision', 'suprema', 'anviz', 'otro'];

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

    const equipo = await prisma.dispositivo.create({
      data: {
        gymId: req.gymId,
        nombre: nombre.trim(),
        serie: serie.trim().toUpperCase(),
        marca: marca || 'zkteco'
      }
    });

    await registrarAuditoria(req, 'REGISTRAR_DISPOSITIVO', {
      recurso: 'Dispositivo',
      recursoId: equipo.id,
      detalle: { serie: equipo.serie, marca: equipo.marca }
    });

    res.status(201).json(conId(equipo));
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

module.exports = router;
