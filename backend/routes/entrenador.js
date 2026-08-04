const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Rutina = require('../models/rutina');
const { verificarToken } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');

// Guard inline: sólo el rol 'entrenador' puede acceder a estas rutas.
const soloEntrenador = (req, res, next) =>
    req.userRole === 'entrenador' ? next() : res.status(403).json({ mensaje: 'Solo entrenadores' });

// Lista los socios asignados a este entrenador dentro de su gym.
router.get('/mis-socios', verificarToken, soloEntrenador, async (req, res) => {
    try {
        const socios = await User.find({
            gymId: req.gymId,
            role: 'socio',
            entrenadorId: req.userId
        }).select('-password').lean();
        res.json(socios);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Perfil de un socio asignado a este entrenador, junto con sus rutinas.
router.get('/socio/:id', verificarToken, soloEntrenador, async (req, res) => {
    try {
        const socio = await User.findOne({
            _id: req.params.id,
            gymId: req.gymId,
            role: 'socio',
            entrenadorId: req.userId
        }).select('-password').lean();
        if (!socio) return res.status(404).json({ mensaje: 'Socio no encontrado' });

        const rutinas = await Rutina.find({ gymId: req.gymId, usuarioId: socio._id }).lean();
        res.json({ socio, rutinas });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Asigna (o falla si ya existe) una rutina a un socio propio del entrenador.
router.post('/socio/:id/rutina', verificarToken, soloEntrenador, async (req, res) => {
    try {
        const { nombre, dia, ejercicios, enfoque } = req.body;

        // El socio debe estar asignado a este entrenador dentro de su gym.
        const socio = await User.findOne({
            _id: req.params.id,
            gymId: req.gymId,
            role: 'socio',
            entrenadorId: req.userId
        }).select('_id').lean();
        if (!socio) return res.status(404).json({ mensaje: 'Socio no encontrado' });

        // Una sola rutina por (gymId, usuarioId, dia): evita duplicados.
        const rutinaExistente = await Rutina.findOne({ gymId: req.gymId, usuarioId: socio._id, dia });
        if (rutinaExistente) {
            return res.status(400).json({
                mensaje: `El socio ya tiene una rutina para el día ${dia}. Editá la existente o elegí otro día.`
            });
        }

        const nuevaRutina = new Rutina({
            gymId: req.gymId,
            usuarioId: socio._id,
            nombre,
            ejercicios,
            dia,
            enfoque
        });
        await nuevaRutina.save();

        await registrarAuditoria(req, 'ENTRENADOR_ASIGNA_RUTINA', {
            recurso: 'Rutina',
            recursoId: nuevaRutina._id,
            detalle: { socioId: socio._id, dia }
        });

        res.status(201).json({ mensaje: 'Rutina asignada con éxito', rutina: nuevaRutina });
    } catch (error) {
        // Duplicado por el índice único {gymId,usuarioId,dia} (carrera con el findOne previo)
        if (error.code === 11000) {
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

        const rutinaExistente = await Rutina.findOne({ _id: rutinaId, gymId: req.gymId });
        if (!rutinaExistente) return res.status(404).json({ mensaje: 'No existe esa rutina' });

        // El socio dueño de la rutina debe estar asignado a este entrenador.
        const socio = await User.findOne({
            _id: rutinaExistente.usuarioId,
            gymId: req.gymId,
            role: 'socio',
            entrenadorId: req.userId
        }).select('_id').lean();
        if (!socio) return res.status(404).json({ mensaje: 'No existe esa rutina' });

        // Validar el rango: evita crear índices sparse en el array de ejercicios.
        if (idx >= rutinaExistente.ejercicios.length) {
            return res.status(400).json({ mensaje: 'Índice fuera de rango' });
        }

        const rutina = await Rutina.findOneAndUpdate(
            { _id: rutinaId, gymId: req.gymId },
            { $set: { [`ejercicios.${idx}.completado`]: !!completado } },
            { new: true }
        ).lean();

        if (!rutina) return res.status(404).json({ mensaje: 'No existe esa rutina' });
        res.json(rutina);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
