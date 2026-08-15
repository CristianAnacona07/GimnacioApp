const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { verificarToken } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { toApiUser } = require('../lib/userMapper');
const { conRutina, ejerciciosParaCrear } = require('../lib/rutinaMapper');

const prisma = getPrismaClient();

// Guard inline: sólo el rol 'entrenador' puede acceder a estas rutas.
const soloEntrenador = (req, res, next) =>
    req.userRole === 'entrenador' ? next() : res.status(403).json({ mensaje: 'Solo entrenadores' });

// Lista los socios asignados a este entrenador dentro de su gym.
router.get('/mis-socios', verificarToken, soloEntrenador, async (req, res) => {
    try {
        const socios = await prisma.user.findMany({
            where: { gymId: req.gymId, role: 'socio', entrenadorId: req.userId }
        });
        res.json(socios.map(toApiUser));
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Perfil de un socio asignado a este entrenador, junto con sus rutinas.
router.get('/socio/:id', verificarToken, soloEntrenador, async (req, res) => {
    try {
        const socio = await prisma.user.findFirst({
            where: { id: req.params.id, gymId: req.gymId, role: 'socio', entrenadorId: req.userId }
        });
        if (!socio) return res.status(404).json({ mensaje: 'Socio no encontrado' });

        const rutinas = await prisma.rutina.findMany({ where: { gymId: req.gymId, usuarioId: socio.id }, include: { ejercicios: true } });
        res.json({ socio: toApiUser(socio), rutinas: rutinas.map(conRutina) });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Asigna (o falla si ya existe) una rutina a un socio propio del entrenador.
router.post('/socio/:id/rutina', verificarToken, soloEntrenador, async (req, res) => {
    try {
        const { nombre, dia, ejercicios, enfoque } = req.body;

        // El socio debe estar asignado a este entrenador dentro de su gym.
        const socio = await prisma.user.findFirst({
            where: { id: req.params.id, gymId: req.gymId, role: 'socio', entrenadorId: req.userId },
            select: { id: true }
        });
        if (!socio) return res.status(404).json({ mensaje: 'Socio no encontrado' });

        // Una sola rutina por (gymId, usuarioId, dia): evita duplicados.
        const rutinaExistente = await prisma.rutina.findFirst({ where: { gymId: req.gymId, usuarioId: socio.id, dia }, select: { id: true } });
        if (rutinaExistente) {
            return res.status(400).json({
                mensaje: `El socio ya tiene una rutina para el día ${dia}. Editá la existente o elegí otro día.`
            });
        }

        const nuevaRutina = await prisma.rutina.create({
            data: { gymId: req.gymId, usuarioId: socio.id, nombre, dia, enfoque, ejercicios: { create: ejerciciosParaCrear(ejercicios) } },
            include: { ejercicios: true }
        });

        await registrarAuditoria(req, 'ENTRENADOR_ASIGNA_RUTINA', {
            recurso: 'Rutina',
            recursoId: nuevaRutina.id,
            detalle: { socioId: socio.id, dia }
        });

        res.status(201).json({ mensaje: 'Rutina asignada con éxito', rutina: conRutina(nuevaRutina) });
    } catch (error) {
        // Duplicado por el índice único {gymId,usuarioId,dia} (carrera con el findFirst previo)
        if (error.code === 'P2002') {
            return res.status(400).json({
                mensaje: `El socio ya tiene una rutina para el día ${req.body.dia}. Editá la existente o elegí otro día.`
            });
        }
        res.status(500).json({ mensaje: 'Error al asignar rutina' });
    }
});

// Alterna 'completado' de un ejercicio, sólo en rutinas de socios propios.
router.patch('/rutina/:rutinaId/ejercicio/:idx', verificarToken, soloEntrenador, async (req, res) => {
    try {
        const { rutinaId, idx: idxParam } = req.params;
        const { completado } = req.body;

        // Validar el índice: evita inyectar claves arbitrarias en el path del update.
        const idx = Number(idxParam);
        if (!Number.isInteger(idx) || idx < 0) {
            return res.status(400).json({ mensaje: 'Índice de ejercicio inválido' });
        }

        const rutinaExistente = await prisma.rutina.findFirst({ where: { id: rutinaId, gymId: req.gymId }, include: { ejercicios: true } });
        if (!rutinaExistente) return res.status(404).json({ mensaje: 'No existe esa rutina' });

        // El socio dueño de la rutina debe estar asignado a este entrenador.
        const socio = await prisma.user.findFirst({
            where: { id: rutinaExistente.usuarioId, gymId: req.gymId, role: 'socio', entrenadorId: req.userId },
            select: { id: true }
        });
        if (!socio) return res.status(404).json({ mensaje: 'No existe esa rutina' });

        // Validar el rango: evita apuntar a un `orden` que no existe.
        if (idx >= rutinaExistente.ejercicios.length) {
            return res.status(400).json({ mensaje: 'Índice fuera de rango' });
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
