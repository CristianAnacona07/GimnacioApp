const express = require('express');
const router = express.Router();
const { ObjectId } = require('bson');
const { getPrismaClient } = require('../prisma/client');
const { verificarToken } = require('../middleware/auth');

const prisma = getPrismaClient();

const MAX_SERIES = 12;
const MAX_NOTA = 1000;

function conId(p) {
  if (!p) return p;
  const { id, ...rest } = p;
  return { ...rest, _id: id };
}

/**
 * Deja las series en la forma que se guarda: una lista de { peso, reps } con
 * números o null, en el orden en que llegaron (la posición ES el número de
 * serie, por eso no se ordena ni se filtran las vacías: si el socio dejó la
 * serie 2 en blanco, la 3 tiene que seguir siendo la 3).
 * Devuelve { series } o { error } con el motivo.
 */
function normalizarSeries(entrada) {
  if (!Array.isArray(entrada)) return { error: 'Las series tienen que venir en una lista' };
  if (entrada.length > MAX_SERIES) return { error: `Como máximo ${MAX_SERIES} series` };

  const series = [];
  for (const cruda of entrada) {
    if (!cruda || typeof cruda !== 'object') return { error: 'Serie inválida' };
    const fila = {};
    for (const [campo, max] of [['peso', 1000], ['reps', 1000]]) {
      const valor = cruda[campo];
      if (valor === undefined || valor === null || valor === '') { fila[campo] = null; continue; }
      const num = Number(valor);
      if (!Number.isFinite(num) || num < 0 || num > max) {
        return { error: `Valor inválido en ${campo}` };
      }
      fila[campo] = num;
    }
    series.push(fila);
  }
  return { series };
}

/** El nombre del ejercicio viaja en la URL y puede traer tildes y espacios. */
function nombreDeLaUrl(req) {
  const nombre = decodeURIComponent(req.params.ejercicio || '').trim();
  return nombre.length ? nombre : null;
}

// La pirámide es del socio que pide, siempre: el usuario sale del token y nunca
// de la URL, así nadie puede leer ni pisar la de otro cambiando la dirección.
router.get('/:ejercicio', verificarToken, async (req, res) => {
  try {
    const ejercicioNombre = nombreDeLaUrl(req);
    if (!ejercicioNombre) return res.status(400).json({ error: 'Falta el ejercicio' });

    const piramide = await prisma.piramide.findFirst({
      where: { usuarioId: req.userId, gymId: req.gymId, ejercicioNombre }
    });
    // Sin pirámide guardada no es un error: el socio todavía no anotó ninguna.
    res.json(piramide ? conId(piramide) : null);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Guardar reemplaza lo anterior por completo — no se lleva historial.
router.put('/:ejercicio', verificarToken, async (req, res) => {
  try {
    const ejercicioNombre = nombreDeLaUrl(req);
    if (!ejercicioNombre) return res.status(400).json({ error: 'Falta el ejercicio' });
    if (!req.gymId) return res.status(400).json({ error: 'La sesión no tiene gimnasio' });

    const { series, error } = normalizarSeries(req.body.series);
    if (error) return res.status(400).json({ error });

    let nota = req.body.nota;
    if (nota === undefined || nota === null) nota = null;
    else if (typeof nota !== 'string') return res.status(400).json({ error: 'Nota inválida' });
    else {
      nota = nota.trim().slice(0, MAX_NOTA);
      if (!nota.length) nota = null;
    }

    // El único índice es (usuario, ejercicio), así que el upsert va por ahí; el
    // gymId se escribe solo al crear y después no se toca.
    //
    // El id va a mano: la extensión que lo genera sola sólo intercepta create y
    // createMany, no upsert, y sin esto Postgres rechaza el insert con
    // «Argument `id` is missing».
    const piramide = await prisma.piramide.upsert({
      where: { usuarioId_ejercicioNombre: { usuarioId: req.userId, ejercicioNombre } },
      update: { series, nota },
      create: {
        id: new ObjectId().toHexString(),
        gymId: req.gymId, usuarioId: req.userId, ejercicioNombre, series, nota
      }
    });
    res.json(conId(piramide));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:ejercicio', verificarToken, async (req, res) => {
  try {
    const ejercicioNombre = nombreDeLaUrl(req);
    if (!ejercicioNombre) return res.status(400).json({ error: 'Falta el ejercicio' });

    // deleteMany y no delete: así la pertenencia viaja en el WHERE y borrar la
    // de otro es imposible, aunque se acierte el nombre del ejercicio.
    const { count } = await prisma.piramide.deleteMany({
      where: { usuarioId: req.userId, gymId: req.gymId, ejercicioNombre }
    });
    if (!count) return res.status(404).json({ error: 'No hay pirámide guardada' });
    res.json({ mensaje: 'Pirámide eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.normalizarSeries = normalizarSeries;

module.exports = router;
