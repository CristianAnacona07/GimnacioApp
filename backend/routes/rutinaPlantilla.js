// Plantillas de rutina SEMANAL: catálogo reutilizable a nivel de gimnasio
// para que el administrador arme una vez la semana completa de un perfil
// tipo ("Principiante") y se la aplique entera a un socio nuevo de un toque.
// Solo el administrador las administra y las usa — ver comentario en el
// modelo RutinaPlantilla (schema.prisma) para el porqué de no reusar Rutina.
const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { conPlantilla, diasParaCrear } = require('../lib/rutinaPlantillaMapper');
const { ejerciciosParaCrear } = require('../lib/rutinaMapper');
const { emitirAUsuario } = require('../helpers/tiempoReal');

const prisma = getPrismaClient();

// Los días con sus ejercicios, en las dos consultas donde hacen falta.
const INCLUIR_DIAS = { dias: { include: { ejercicios: true } } };

function validarDias(dias) {
  if (!Array.isArray(dias) || !dias.length) return 'Agregá al menos un día con ejercicios';
  const conEjercicios = dias.filter((d) => d && d.dia && Array.isArray(d.ejercicios) && d.ejercicios.length);
  if (!conEjercicios.length) return 'Agregá al menos un ejercicio a alguno de los días';
  const vistos = new Set();
  for (const d of conEjercicios) {
    if (vistos.has(d.dia)) return `El día ${d.dia} está repetido en la plantilla`;
    vistos.add(d.dia);
  }
  return null;
}

router.get('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const plantillas = await prisma.rutinaPlantilla.findMany({
      where: { gymId: req.gymId },
      include: INCLUIR_DIAS,
      orderBy: { createdAt: 'desc' }
    });
    res.json(plantillas.map(conPlantilla));
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, dias } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ mensaje: 'El nombre es obligatorio' });
    const error = validarDias(dias);
    if (error) return res.status(400).json({ mensaje: error });

    const plantilla = await prisma.rutinaPlantilla.create({
      data: { gymId: req.gymId, nombre: nombre.trim(), dias: { create: diasParaCrear(dias) } },
      include: INCLUIR_DIAS
    });
    await registrarAuditoria(req, 'CREAR_RUTINA_PLANTILLA', {
      recurso: 'RutinaPlantilla', recursoId: plantilla.id, detalle: { nombre: plantilla.nombre }
    });
    res.status(201).json(conPlantilla(plantilla));
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear la plantilla' });
  }
});

router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, dias } = req.body;
    if (nombre !== undefined && !nombre.trim()) return res.status(400).json({ mensaje: 'El nombre es obligatorio' });
    if (dias !== undefined) {
      const error = validarDias(dias);
      if (error) return res.status(400).json({ mensaje: error });
    }

    const actual = await prisma.rutinaPlantilla.findFirst({ where: { id: req.params.id, gymId: req.gymId }, select: { id: true } });
    if (!actual) return res.status(404).json({ mensaje: 'Plantilla no encontrada' });

    // Los días se reemplazan enteros (igual que los ejercicios de una Rutina
    // en rutina.js): más simple y sin estados intermedios raros que ir
    // diffeando qué día se agregó, cuál cambió y cuál se sacó.
    const plantilla = await prisma.$transaction(async (tx) => {
      if (dias !== undefined) {
        await tx.rutinaPlantillaDia.deleteMany({ where: { plantillaId: actual.id } });
      }
      return tx.rutinaPlantilla.update({
        where: { id: actual.id },
        data: {
          ...(nombre !== undefined ? { nombre: nombre.trim() } : {}),
          ...(dias !== undefined ? { dias: { create: diasParaCrear(dias) } } : {})
        },
        include: INCLUIR_DIAS
      });
    });

    await registrarAuditoria(req, 'EDITAR_RUTINA_PLANTILLA', { recurso: 'RutinaPlantilla', recursoId: plantilla.id, detalle: { nombre: plantilla.nombre } });
    res.json(conPlantilla(plantilla));
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar la plantilla' });
  }
});

/**
 * Aplica la plantilla entera a un socio: una Rutina real por cada día de la
 * plantilla, de una sola vez. Los ejercicios se COPIAN — editar después la
 * rutina del socio no toca la plantilla ni a otros socios que la usen.
 *
 * Si el socio ya tiene rutina en alguno de esos días, no se pisa nada sin
 * permiso: se responde 409 con la lista de días en conflicto para que el
 * frontend pregunte, y recién con `sobrescribir: true` se reemplazan (la
 * vieja se borra en suave, así el historial no se pierde del todo y el
 * índice único parcial (gym,usuario,dia) queda libre).
 */
router.post('/:id/aplicar', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { usuarioId, sobrescribir } = req.body;
    if (!usuarioId) return res.status(400).json({ mensaje: 'Elegí un socio' });

    const socio = await prisma.user.findFirst({ where: { id: usuarioId, gymId: req.gymId }, select: { id: true } });
    if (!socio) return res.status(404).json({ mensaje: 'Socio no encontrado en este gimnasio' });

    const plantilla = await prisma.rutinaPlantilla.findFirst({
      where: { id: req.params.id, gymId: req.gymId },
      include: INCLUIR_DIAS
    });
    if (!plantilla) return res.status(404).json({ mensaje: 'Plantilla no encontrada' });

    const diasConEjercicios = plantilla.dias.filter((d) => d.ejercicios.length);
    if (!diasConEjercicios.length) return res.status(400).json({ mensaje: 'La plantilla no tiene ningún día con ejercicios' });

    const yaExisten = await prisma.rutina.findMany({
      where: { gymId: req.gymId, usuarioId, dia: { in: diasConEjercicios.map((d) => d.dia) } },
      select: { id: true, dia: true }
    });

    if (yaExisten.length && !sobrescribir) {
      return res.status(409).json({
        mensaje: 'El socio ya tiene rutina en algunos de esos días',
        diasEnConflicto: yaExisten.map((r) => r.dia)
      });
    }

    await prisma.$transaction(async (tx) => {
      if (yaExisten.length) {
        // Borrado suave a mano: la extensión sólo agrega .softDelete() al
        // cliente base, no al `tx` de una transacción interactiva.
        await tx.rutina.updateMany({
          where: { id: { in: yaExisten.map((r) => r.id) } },
          data: { deletedAt: new Date() }
        });
      }
      for (const d of diasConEjercicios) {
        await tx.rutina.create({
          data: {
            gymId: req.gymId,
            usuarioId,
            nombre: `${plantilla.nombre} - ${d.dia}`,
            dia: d.dia,
            enfoque: d.enfoque || plantilla.nombre,
            ejercicios: { create: ejerciciosParaCrear(d.ejercicios) }
          }
        });
      }
    });

    await registrarAuditoria(req, 'APLICAR_RUTINA_PLANTILLA', {
      recurso: 'RutinaPlantilla',
      recursoId: plantilla.id,
      detalle: { usuarioId, nombre: plantilla.nombre, dias: diasConEjercicios.map((d) => d.dia) }
    });
    // El socio ve sus rutinas nuevas sin recargar.
    emitirAUsuario(usuarioId, 'rutina:actualizada', {});

    res.status(201).json({
      mensaje: `Rutina "${plantilla.nombre}" asignada (${diasConEjercicios.length} días)`,
      dias: diasConEjercicios.map((d) => d.dia)
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al aplicar la plantilla' });
  }
});

router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const resultado = await prisma.rutinaPlantilla.softDelete({ id: req.params.id, gymId: req.gymId });
    if (!resultado.count) return res.status(404).json({ mensaje: 'Plantilla no encontrada' });
    await registrarAuditoria(req, 'ELIMINAR_RUTINA_PLANTILLA', { recurso: 'RutinaPlantilla', recursoId: req.params.id });
    res.json({ mensaje: 'Plantilla eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar la plantilla' });
  }
});

module.exports = router;
