const express = require('express');
const router = express.Router();
const Cita = require('../models/cita');
const User = require('../models/user');
const Gym = require('../models/gym');
const { verificarToken, soloAdmin, esAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { emitirAUsuario } = require('../helpers/tiempoReal');

const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

// ── Utilidades de fecha y hora ──────────────────────────────────────────────
// Todo se trabaja con texto 'YYYY-MM-DD' y 'HH:MM' para no arrastrar zonas
// horarias (ver el comentario del modelo).

const aMinutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Día de la semana de 'YYYY-MM-DD', sin que la zona horaria lo corra un día. */
function diaSemana(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/** Suma días a 'YYYY-MM-DD' y devuelve otra fecha en el mismo formato. */
function sumarDias(fecha, dias) {
  const [a, m, d] = fecha.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() + dias);
  return t.toISOString().slice(0, 10);
}

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_HORA = /^\d{2}:\d{2}$/;

/**
 * Configuración de la agenda del gym, con los valores por defecto aplicados
 * (un gimnasio creado antes de esta función no trae el campo).
 */
async function configAgenda(gymId) {
  const gym = await Gym.findById(gymId).select('agenda').lean();
  const a = gym?.agenda || {};
  return {
    activa: a.activa === true,
    duracionMin: a.duracionMin || 60,
    precio: a.precio || 0,
    horasMinimasReserva: a.horasMinimasReserva ?? 2,
    horasMinimasCancelacion: a.horasMinimasCancelacion ?? 4,
    diasVisibles: a.diasVisibles || 14
  };
}

// ── Profesionales que atienden ──────────────────────────────────────────────

// Quiénes tienen horario publicado. El socio elige entre estos.
router.get('/profesionales', verificarToken, async (req, res) => {
  try {
    const profesionales = await User.find({
      gymId: req.gymId,
      role: { $in: ['entrenador', 'empleado'] },
      'disponibilidad.0': { $exists: true }   // al menos una franja publicada
    }).select('nombre fotoUrl role cargo disponibilidad').lean();
    res.json(profesionales);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener los profesionales' });
  }
});

// El propio profesional (o un admin) publica su horario semanal.
// Express 5 ya no admite parámetros opcionales en la ruta, así que se registran
// las dos formas —con y sin id— apuntando al mismo manejador.
async function guardarDisponibilidad(req, res) {
  try {
    // Cada quien edita el suyo; el admin puede editar el de cualquiera.
    const destino = esAdmin(req) && req.params.profesionalId ? req.params.profesionalId : req.userId;
    const franjas = Array.isArray(req.body.disponibilidad) ? req.body.disponibilidad : [];

    for (const f of franjas) {
      if (!DIAS.includes(f.dia)) return res.status(400).json({ mensaje: `Día inválido: ${f.dia}` });
      if (!FORMATO_HORA.test(f.desde) || !FORMATO_HORA.test(f.hasta)) {
        return res.status(400).json({ mensaje: 'Las horas deben tener el formato HH:MM' });
      }
      if (aMinutos(f.desde) >= aMinutos(f.hasta)) {
        return res.status(400).json({ mensaje: `En ${f.dia}, la hora de inicio debe ser anterior a la de fin` });
      }
    }

    const usuario = await User.findOneAndUpdate(
      { _id: destino, gymId: req.gymId, role: { $in: ['entrenador', 'empleado'] } },
      { disponibilidad: franjas },
      { new: true }
    ).select('nombre disponibilidad');
    if (!usuario) return res.status(404).json({ mensaje: 'Profesional no encontrado' });

    res.json({ mensaje: 'Horario guardado', disponibilidad: usuario.disponibilidad });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al guardar el horario' });
  }
}
router.put('/disponibilidad', verificarToken, guardarDisponibilidad);
router.put('/disponibilidad/:profesionalId', verificarToken, guardarDisponibilidad);

// El horario propio, para pintarlo en el formulario.
async function obtenerDisponibilidad(req, res) {
  try {
    const destino = esAdmin(req) && req.params.profesionalId ? req.params.profesionalId : req.userId;
    const usuario = await User.findOne({ _id: destino, gymId: req.gymId })
      .select('nombre disponibilidad').lean();
    if (!usuario) return res.status(404).json({ mensaje: 'Profesional no encontrado' });
    res.json({ disponibilidad: usuario.disponibilidad || [] });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el horario' });
  }
}
router.get('/disponibilidad', verificarToken, obtenerDisponibilidad);
router.get('/disponibilidad/:profesionalId', verificarToken, obtenerDisponibilidad);

// ── Huecos libres ───────────────────────────────────────────────────────────

/**
 * Horas libres de un profesional para los próximos días.
 *
 * Se calculan al vuelo cruzando su horario semanal con las citas ya tomadas.
 * No se guardan huecos en la base: si el profesional cambia su horario, el
 * cálculo siguiente ya refleja el cambio sin migrar nada.
 */
router.get('/libres/:profesionalId', verificarToken, async (req, res) => {
  try {
    const cfg = await configAgenda(req.gymId);
    if (!cfg.activa) return res.json({ dias: [], config: cfg });

    const profesional = await User.findOne({
      _id: req.params.profesionalId, gymId: req.gymId,
      role: { $in: ['entrenador', 'empleado'] }
    }).select('nombre disponibilidad').lean();
    if (!profesional) return res.status(404).json({ mensaje: 'Profesional no encontrado' });

    // El cliente manda su hoy y su ahora: el servidor está en UTC y el
    // gimnasio no, así que preguntarle la fecha al servidor adelantaría o
    // atrasaría un día según la hora.
    const hoy = FORMATO_FECHA.test(req.query.hoy || '') ? req.query.hoy : new Date().toISOString().slice(0, 10);
    const ahora = FORMATO_HORA.test(req.query.ahora || '') ? req.query.ahora : '00:00';
    const hasta = sumarDias(hoy, cfg.diasVisibles);

    const ocupadas = await Cita.find({
      profesionalId: profesional._id,
      estado: { $in: ['agendada', 'cumplida'] },
      fecha: { $gte: hoy, $lte: hasta }
    }).select('fecha hora').lean();
    const tomadas = new Set(ocupadas.map(c => `${c.fecha} ${c.hora}`));

    const dias = [];
    for (let i = 0; i <= cfg.diasVisibles; i++) {
      const fecha = sumarDias(hoy, i);
      const nombreDia = diaSemana(fecha);
      const franjas = (profesional.disponibilidad || []).filter(f => f.dia === nombreDia);
      if (!franjas.length) continue;

      const horas = [];
      for (const franja of franjas) {
        const fin = aMinutos(franja.hasta);
        for (let m = aMinutos(franja.desde); m + cfg.duracionMin <= fin; m += cfg.duracionMin) {
          const hora = aHora(m);
          if (tomadas.has(`${fecha} ${hora}`)) continue;
          // Antelación mínima: solo afecta al día de hoy.
          if (fecha === hoy && m < aMinutos(ahora) + cfg.horasMinimasReserva * 60) continue;
          horas.push(hora);
        }
      }
      if (horas.length) dias.push({ fecha, dia: nombreDia, horas });
    }

    res.json({ profesional: { _id: profesional._id, nombre: profesional.nombre }, dias, config: cfg });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al calcular los horarios libres' });
  }
});

// ── Reservar ────────────────────────────────────────────────────────────────

router.post('/', verificarToken, async (req, res) => {
  try {
    const cfg = await configAgenda(req.gymId);
    if (!cfg.activa) return res.status(400).json({ mensaje: 'El gimnasio no tiene las citas activadas' });

    const { profesionalId, fecha, hora, nota } = req.body;
    if (!FORMATO_FECHA.test(fecha || '') || !FORMATO_HORA.test(hora || '')) {
      return res.status(400).json({ mensaje: 'Fecha u hora inválida' });
    }

    // El socio reserva para sí mismo; el admin puede reservar para otro.
    const socioId = esAdmin(req) && req.body.socioId ? req.body.socioId : req.userId;
    const socio = await User.findOne({ _id: socioId, gymId: req.gymId }).select('nombre').lean();
    if (!socio) return res.status(404).json({ mensaje: 'Socio no encontrado' });

    const profesional = await User.findOne({
      _id: profesionalId, gymId: req.gymId, role: { $in: ['entrenador', 'empleado'] }
    }).select('nombre disponibilidad').lean();
    if (!profesional) return res.status(404).json({ mensaje: 'Profesional no encontrado' });

    // La hora pedida tiene que caer dentro de una franja suya y coincidir con
    // el comienzo de un hueco: si no, alguien podría reservar a las 20:07.
    const minutos = aMinutos(hora);
    const franja = (profesional.disponibilidad || []).find(f =>
      f.dia === diaSemana(fecha) &&
      minutos >= aMinutos(f.desde) &&
      minutos + cfg.duracionMin <= aMinutos(f.hasta) &&
      (minutos - aMinutos(f.desde)) % cfg.duracionMin === 0
    );
    if (!franja) return res.status(400).json({ mensaje: 'Ese horario no está disponible' });

    const cita = await Cita.create({
      gymId: req.gymId,
      socioId,
      profesionalId,
      fecha, hora,
      duracionMin: cfg.duracionMin,
      precio: cfg.precio,
      nota: (nota || '').slice(0, 300)
    });

    await registrarAuditoria(req, 'AGENDAR_CITA', { recurso: 'Cita', recursoId: cita._id, detalle: { fecha, hora } });

    // Los dos se enteran al instante, sin recargar.
    const aviso = { citaId: cita._id, fecha, hora, socio: socio.nombre, profesional: profesional.nombre };
    emitirAUsuario(profesionalId, 'cita:nueva', aviso);
    emitirAUsuario(socioId, 'cita:nueva', aviso);

    res.status(201).json({ mensaje: 'Cita agendada', cita });
  } catch (error) {
    // Lo lanza el índice único: alguien reservó ese hueco un instante antes.
    if (error.code === 11000) {
      return res.status(409).json({ mensaje: 'Ese horario acaba de ser reservado por otra persona' });
    }
    res.status(500).json({ mensaje: 'Error al agendar la cita' });
  }
});

// ── Consultar ───────────────────────────────────────────────────────────────

/** Las citas de quien pregunta: como socio, o como profesional que atiende. */
router.get('/mias', verificarToken, async (req, res) => {
  try {
    const desde = FORMATO_FECHA.test(req.query.desde || '') ? req.query.desde : '0000-00-00';
    const citas = await Cita.find({
      gymId: req.gymId,
      fecha: { $gte: desde },
      $or: [{ socioId: req.userId }, { profesionalId: req.userId }]
    })
      .sort({ fecha: 1, hora: 1 })
      .populate('socioId', 'nombre fotoUrl')
      .populate('profesionalId', 'nombre fotoUrl')
      .lean();
    res.json(citas);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener las citas' });
  }
});

/** Todas las citas del gimnasio (admin). */
router.get('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const filtro = { gymId: req.gymId };
    if (FORMATO_FECHA.test(req.query.desde || '')) filtro.fecha = { $gte: req.query.desde };
    const citas = await Cita.find(filtro)
      .sort({ fecha: 1, hora: 1 })
      .populate('socioId', 'nombre fotoUrl')
      .populate('profesionalId', 'nombre fotoUrl')
      .limit(300)
      .lean();
    res.json(citas);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener las citas' });
  }
});

// ── Cancelar y marcar ───────────────────────────────────────────────────────

router.patch('/:id/cancelar', verificarToken, async (req, res) => {
  try {
    const cita = await Cita.findOne({ _id: req.params.id, gymId: req.gymId });
    if (!cita) return res.status(404).json({ mensaje: 'Cita no encontrada' });

    // Solo los implicados o un admin.
    const implicado = String(cita.socioId) === String(req.userId) ||
                      String(cita.profesionalId) === String(req.userId);
    if (!implicado && !esAdmin(req)) return res.status(403).json({ mensaje: 'No autorizado' });
    if (cita.estado !== 'agendada') return res.status(400).json({ mensaje: 'Esta cita ya no se puede cancelar' });

    cita.estado = 'cancelada';
    cita.canceladaPor = req.userId;
    await cita.save();

    const aviso = { citaId: cita._id, fecha: cita.fecha, hora: cita.hora };
    emitirAUsuario(cita.profesionalId, 'cita:cancelada', aviso);
    emitirAUsuario(cita.socioId, 'cita:cancelada', aviso);

    res.json({ mensaje: 'Cita cancelada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cancelar la cita' });
  }
});

/** El profesional o el admin cierran la cita: vino o no vino. */
router.patch('/:id/estado', verificarToken, async (req, res) => {
  try {
    const { estado } = req.body;
    if (!['cumplida', 'ausente'].includes(estado)) {
      return res.status(400).json({ mensaje: 'Estado inválido' });
    }
    const cita = await Cita.findOne({ _id: req.params.id, gymId: req.gymId });
    if (!cita) return res.status(404).json({ mensaje: 'Cita no encontrada' });
    if (String(cita.profesionalId) !== String(req.userId) && !esAdmin(req)) {
      return res.status(403).json({ mensaje: 'No autorizado' });
    }
    cita.estado = estado;
    await cita.save();
    res.json({ mensaje: 'Cita actualizada', cita });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar la cita' });
  }
});

module.exports = router;
