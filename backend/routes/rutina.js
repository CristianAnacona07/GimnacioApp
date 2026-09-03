const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, soloAdmin, resolverUsuarioId, filtroPropiedad, requierePermiso, tienePermiso } = require('../middleware/auth');
const { puedeModificarA } = require('../lib/sedes');
const { registrarAuditoria } = require('../helpers/audit');
const { conRutina, ejerciciosParaCrear } = require('../lib/rutinaMapper');
const { emitirAUsuario } = require('../helpers/tiempoReal');

const prisma = getPrismaClient();

router.post('/asignar', verificarToken, requierePermiso('rutinas', 'edicion'), async (req, res) => {
  try {
    const { usuarioId, nombre, ejercicios, dia, enfoque } = req.body;

    // El socio destino debe pertenecer al mismo gym del admin.
    const socio = await prisma.user.findFirst({ where: { id: usuarioId, gymId: req.gymId }, select: { id: true } });
    if (!socio) return res.status(404).json({ mensaje: 'Socio no encontrado en este gimnasio' });

    // La rutina es del socio, y el socio es de su sede: desde otro local se
    // puede mirar, no armarle la rutina.
    const permiso = await puedeModificarA(req, usuarioId);
    if (!permiso.ok) return res.status(403).json({ mensaje: permiso.motivo });

    const rutinaExistente = await prisma.rutina.findFirst({ where: { gymId: req.gymId, usuarioId, dia }, select: { id: true } });
    if (rutinaExistente) {
      return res.status(400).json({
        mensaje: `El socio ya tiene una rutina para el día ${dia}. Editá la existente o elegí otro día.`
      });
    }

    const nuevaRutina = await prisma.rutina.create({
      data: { gymId: req.gymId, usuarioId, nombre, dia, enfoque, ejercicios: { create: ejerciciosParaCrear(ejercicios) } },
      include: { ejercicios: true }
    });
    await registrarAuditoria(req, 'ASIGNAR_RUTINA', {
      recurso: 'Rutina',
      recursoId: nuevaRutina.id,
      detalle: { usuarioId, dia, nombre }
    });
    // El socio ve la rutina nueva sin salir ni recargar la pantalla.
    emitirAUsuario(usuarioId, 'rutina:actualizada', { dia });
    res.status(201).json({ mensaje: 'Rutina asignada con éxito', rutina: conRutina(nuevaRutina) });
  } catch (error) {
    // Duplicado por el índice único {gymId,usuarioId,dia} (carrera con el findFirst previo)
    if (error.code === 'P2002') {
      return res.status(400).json({ mensaje: `El socio ya tiene una rutina para el día ${req.body.dia}. Editá la existente o elegí otro día.` });
    }
    res.status(500).json({ mensaje: 'Error al asignar rutina' });
  }
});

router.get('/:usuarioId', verificarToken, async (req, res) => {
  try {
    // El socio sólo ve la suya; el admin y quien tenga la sección de rutinas,
    // la de cualquiera. resolverUsuarioId por sí solo forzaría al entrenador a
    // mirarse a sí mismo y no podría abrir la rutina de nadie.
    const usuarioId = await tienePermiso(req, 'rutinas')
      ? (req.params.usuarioId || req.userId)
      : resolverUsuarioId(req, req.params.usuarioId);
    const rutinas = await prisma.rutina.findMany({ where: { gymId: req.gymId, usuarioId }, include: { ejercicios: true } });
    res.json(rutinas.map(conRutina));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/actualizar/:id', verificarToken, requierePermiso('rutinas', 'edicion'), async (req, res) => {
  try {
    // No permitir reasignar la rutina a otro gym/usuario vía body (mass assignment).
    const { gymId, usuarioId, _id, id, ejercicios, ...datos } = req.body;

    const actual = await prisma.rutina.findFirst({ where: { id: req.params.id, gymId: req.gymId }, select: { id: true, usuarioId: true } });
    if (!actual) return res.status(404).json({ mensaje: 'Rutina no encontrada' });

    const permiso = await puedeModificarA(req, actual.usuarioId);
    if (!permiso.ok) return res.status(403).json({ mensaje: permiso.motivo });

    const rutina = await prisma.$transaction(async (tx) => {
      if (ejercicios !== undefined) {
        await tx.rutinaEjercicio.deleteMany({ where: { rutinaId: actual.id } });
      }
      return tx.rutina.update({
        where: { id: actual.id },
        data: {
          ...datos,
          ...(ejercicios !== undefined ? { ejercicios: { create: ejerciciosParaCrear(ejercicios) } } : {})
        },
        include: { ejercicios: true }
      });
    });

    emitirAUsuario(rutina.usuarioId, 'rutina:actualizada', { dia: rutina.dia });
    res.json({ mensaje: 'Rutina actualizada', rutina: conRutina(rutina) });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar' });
  }
});

router.delete('/eliminar/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    // De quién es, antes de borrarla: no se borra la rutina de otra sede.
    const duenio = await prisma.rutina.findFirst({ where: { id: req.params.id, gymId: req.gymId }, select: { usuarioId: true } });
    if (!duenio) return res.status(404).json({ mensaje: 'Rutina no encontrada' });
    const permiso = await puedeModificarA(req, duenio.usuarioId);
    if (!permiso.ok) return res.status(403).json({ mensaje: permiso.motivo });

    const resultado = await prisma.rutina.softDelete({ id: req.params.id, gymId: req.gymId });
    if (resultado.count === 0) return res.status(404).json({ mensaje: 'Rutina no encontrada' });
    await registrarAuditoria(req, 'ELIMINAR_RUTINA', {
      recurso: 'Rutina',
      recursoId: req.params.id
    });
    res.json({ mensaje: 'Rutina borrada correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al borrar' });
  }
});

router.patch('/reset-dia/:usuarioId', verificarToken, async (req, res) => {
  try {
    const usuarioId = resolverUsuarioId(req, req.params.usuarioId);

    // El usuario objetivo debe pertenecer al gym del solicitante (evita IDOR
    // por enumeración de IDs entre gimnasios).
    const usuarioObjetivo = await prisma.user.findFirst({ where: { id: usuarioId, gymId: req.gymId }, select: { id: true } });
    if (!usuarioObjetivo) return res.status(404).json({ mensaje: 'Usuario no encontrado en este gimnasio' });

    await prisma.rutinaEjercicio.updateMany({
      where: { rutina: { gymId: req.gymId, usuarioId } },
      data: { completado: false }
    });
    res.json({ mensaje: 'Ejercicios reseteados correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.patch('/:rutinaId/ejercicio/:ejercicioIdx', verificarToken, async (req, res) => {
  try {
    const { rutinaId, ejercicioIdx } = req.params;
    const { completado } = req.body;

    // Validar el índice: evita inyectar claves arbitrarias en el path del update.
    const idx = Number(ejercicioIdx);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ mensaje: 'Índice de ejercicio inválido' });
    }

    // El socio sólo puede modificar sus propias rutinas; el admin, las del gym.
    const rutinaExistente = await prisma.rutina.findFirst({
      where: { id: rutinaId, gymId: req.gymId, ...filtroPropiedad(req) },
      include: { ejercicios: true }
    });
    if (!rutinaExistente) return res.status(404).json({ mensaje: 'No existe esa rutina' });

    // Validar el rango: evita apuntar a un `orden` que no existe.
    if (idx >= rutinaExistente.ejercicios.length) {
      return res.status(400).json({ mensaje: 'Índice de ejercicio fuera de rango' });
    }

    await prisma.rutinaEjercicio.updateMany({
      where: { rutinaId: rutinaExistente.id, orden: idx },
      data: { completado: !!completado }
    });

    const rutina = await prisma.rutina.findUnique({ where: { id: rutinaExistente.id }, include: { ejercicios: true } });
    res.json(conRutina(rutina));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
