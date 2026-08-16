const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, soloAdmin, esAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { emitirAUsuario } = require('../helpers/tiempoReal');
const { conCita } = require('../lib/citaMapper');

const prisma = getPrismaClient();

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ── Utilidades de fecha y hora ──────────────────────────────────────────────
// Todo se trabaja con texto 'YYYY-MM-DD' y 'HH:MM' para no arrastrar zonas
// horarias (ver el comentario del modelo en prisma/schema.prisma).

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
  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: {
    agendaActiva: true, agendaDuracionMin: true, agendaPrecio: true,
    agendaHorasMinimasReserva: true, agendaHorasMinimasCancelacion: true, agendaDiasVisibles: true,
  } });
  return {
    activa: gym?.agendaActiva === true,
    duracionMin: gym?.agendaDuracionMin || 60,
    precio: gym ? Number(gym.agendaPrecio) : 0,
    horasMinimasReserva: gym?.agendaHorasMinimasReserva ?? 2,
    horasMinimasCancelacion: gym?.agendaHorasMinimasCancelacion ?? 4,
    diasVisibles: gym?.agendaDiasVisibles || 14,
  };
}

// ── Profesionales que atienden ──────────────────────────────────────────────

// Quiénes tienen horario publicado. El socio elige entre estos.
router.get('/profesionales', verificarToken, async (req, res) => {
  try {
    const candidatos = await prisma.user.findMany({
      where: { gymId: req.gymId, role: { in: ['entrenador', 'empleado'] } },
      select: { id: true, nombre: true, fotoUrl: true, role: true, cargo: true, disponibilidad: true }
    });
    // Al menos una franja publicada (equivalente a Mongo 'disponibilidad.0': {$exists:true}).
    const profesionales = candidatos.filter((p) => Array.isArray(p.disponibilidad) && p.disponibilidad.length > 0);
    res.json(profesionales.map(({ id, ...p }) => ({ ...p, _id: id })));
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

    const actual = await prisma.user.findFirst({
      where: { id: destino, gymId: req.gymId, role: { in: ['entrenador', 'empleado'] } },
      select: { id: true }
    });
    if (!actual) return res.status(404).json({ mensaje: 'Profesional no encontrado' });

    const usuario = await prisma.user.update({
      where: { id: actual.id }, data: { disponibilidad: franjas }, select: { nombre: true, disponibilidad: true }
    });

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
    const usuario = await prisma.user.findFirst({
      where: { id: destino, gymId: req.gymId }, select: { nombre: true, disponibilidad: true }
    });
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

    const profesional = await prisma.user.findFirst({
      where: { id: req.params.profesionalId, gymId: req.gymId, role: { in: ['entrenador', 'empleado'] } },
      select: { id: true, nombre: true, disponibilidad: true }
    });
    if (!profesional) return res.status(404).json({ mensaje: 'Profesional no encontrado' });

    // El cliente manda su hoy y su ahora: el servidor está en UTC y el
    // gimnasio no, así que preguntarle la fecha al servidor adelantaría o
    // atrasaría un día según la hora.
    const hoy = FORMATO_FECHA.test(req.query.hoy || '') ? req.query.hoy : new Date().toISOString().slice(0, 10);
    const ahora = FORMATO_HORA.test(req.query.ahora || '') ? req.query.ahora : '00:00';
    const hasta = sumarDias(hoy, cfg.diasVisibles);

    const ocupadas = await prisma.cita.findMany({
      where: { profesionalId: profesional.id, estado: { in: ['agendada', 'cumplida'] }, fecha: { gte: hoy, lte: hasta } },
      select: { fecha: true, hora: true }
    });
    const tomadas = new Set(ocupadas.map((c) => `${c.fecha} ${c.hora}`));

    const dias = [];
    for (let i = 0; i <= cfg.diasVisibles; i++) {
      const fecha = sumarDias(hoy, i);
      const nombreDia = diaSemana(fecha);
      const franjas = (profesional.disponibilidad || []).filter((f) => f.dia === nombreDia);
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

    res.json({ profesional: { _id: profesional.id, nombre: profesional.nombre }, dias, config: cfg });
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
    const socio = await prisma.user.findFirst({ where: { id: socioId, gymId: req.gymId }, select: { id: true, nombre: true } });
    if (!socio) return res.status(404).json({ mensaje: 'Socio no encontrado' });

    const profesional = await prisma.user.findFirst({
      where: { id: profesionalId, gymId: req.gymId, role: { in: ['entrenador', 'empleado'] } },
      select: { id: true, nombre: true, disponibilidad: true }
    });
    if (!profesional) return res.status(404).json({ mensaje: 'Profesional no encontrado' });

    // La hora pedida tiene que caer dentro de una franja suya y coincidir con
    // el comienzo de un hueco: si no, alguien podría reservar a las 20:07.
    const minutos = aMinutos(hora);
    const franja = (profesional.disponibilidad || []).find((f) =>
      f.dia === diaSemana(fecha) &&
      minutos >= aMinutos(f.desde) &&
      minutos + cfg.duracionMin <= aMinutos(f.hasta) &&
      (minutos - aMinutos(f.desde)) % cfg.duracionMin === 0
    );
    if (!franja) return res.status(400).json({ mensaje: 'Ese horario no está disponible' });

    let cita;
    try {
      cita = await prisma.cita.create({
        data: {
          gymId: req.gymId, socioId, profesionalId, fecha, hora,
          duracionMin: cfg.duracionMin, precio: cfg.precio, nota: (nota || '').slice(0, 300)
        }
      });
    } catch (error) {
      // Lo lanza el índice único parcial: alguien reservó ese hueco un instante antes.
      if (error.code === 'P2002') {
        return res.status(409).json({ mensaje: 'Ese horario acaba de ser reservado por otra persona' });
      }
      throw error;
    }

    await registrarAuditoria(req, 'AGENDAR_CITA', { recurso: 'Cita', recursoId: cita.id, detalle: { fecha, hora } });

    // Los dos se enteran al instante, sin recargar.
    const aviso = { citaId: cita.id, fecha, hora, socio: socio.nombre, profesional: profesional.nombre };
    emitirAUsuario(profesionalId, 'cita:nueva', aviso);
    emitirAUsuario(socioId, 'cita:nueva', aviso);

    res.status(201).json({ mensaje: 'Cita agendada', cita: conCita(cita) });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al agendar la cita' });
  }
});

// ── Consultar ───────────────────────────────────────────────────────────────

/** Las citas de quien pregunta: como socio, o como profesional que atiende. */
router.get('/mias', verificarToken, async (req, res) => {
  try {
    const desde = FORMATO_FECHA.test(req.query.desde || '') ? req.query.desde : '0000-00-00';
    const citas = await prisma.cita.findMany({
      where: {
        gymId: req.gymId,
        fecha: { gte: desde },
        OR: [{ socioId: req.userId }, { profesionalId: req.userId }]
      },
      orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
      include: {
        socio: { select: { id: true, nombre: true, fotoUrl: true } },
        profesional: { select: { id: true, nombre: true, fotoUrl: true } }
      }
    });
    res.json(citas.map(conCita));
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener las citas' });
  }
});

/** Todas las citas del gimnasio (admin). */
router.get('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const where = { gymId: req.gymId };
    if (FORMATO_FECHA.test(req.query.desde || '')) where.fecha = { gte: req.query.desde };
    const citas = await prisma.cita.findMany({
      where,
      orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
      include: {
        socio: { select: { id: true, nombre: true, fotoUrl: true } },
        profesional: { select: { id: true, nombre: true, fotoUrl: true } }
      },
      take: 300
    });
    res.json(citas.map(conCita));
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener las citas' });
  }
});

// ── Cancelar y marcar ───────────────────────────────────────────────────────

router.patch('/:id/cancelar', verificarToken, async (req, res) => {
  try {
    const cita = await prisma.cita.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
    if (!cita) return res.status(404).json({ mensaje: 'Cita no encontrada' });

    // Solo los implicados o un admin.
    const implicado = cita.socioId === req.userId || cita.profesionalId === req.userId;
    if (!implicado && !esAdmin(req)) return res.status(403).json({ mensaje: 'No autorizado' });
    if (cita.estado !== 'agendada') return res.status(400).json({ mensaje: 'Esta cita ya no se puede cancelar' });

    await prisma.cita.update({ where: { id: cita.id }, data: { estado: 'cancelada', canceladaPor: req.userId } });

    const aviso = { citaId: cita.id, fecha: cita.fecha, hora: cita.hora };
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
    const cita = await prisma.cita.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
    if (!cita) return res.status(404).json({ mensaje: 'Cita no encontrada' });
    if (cita.profesionalId !== req.userId && !esAdmin(req)) {
      return res.status(403).json({ mensaje: 'No autorizado' });
    }
    const actualizada = await prisma.cita.update({ where: { id: cita.id }, data: { estado } });
    res.json({ mensaje: 'Cita actualizada', cita: conCita(actualizada) });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar la cita' });
  }
});

module.exports = router;
