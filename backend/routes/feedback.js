const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { verificarToken } = require('../middleware/auth');
const { paginar } = require('../lib/pagination');

const prisma = getPrismaClient();

// Los dos únicos destinos. "gimnasio" lo lee el admin de ESE gym; "plataforma"
// solo el superadmin. Cualquier otro valor que mande un cliente se descarta.
const DESTINOS = ['gimnasio', 'plataforma'];

function conId(f) {
  if (!f) return f;
  const { id, ...rest } = f;
  return { ...rest, _id: id };
}

/**
 * Un mensaje anónimo sigue guardando usuarioId (hace falta para cortar un
 * abuso), pero el nombre no sale de la base: se tapa acá, al armar la
 * respuesta, y no en el front — si lo mandáramos igual, cualquiera lo vería
 * abriendo las herramientas del navegador y el anonimato sería de mentira.
 */
function paraLeer(f) {
  const { usuarioId, ...resto } = conId(f);
  return f.anonimo ? { ...resto, nombreUsuario: 'Un socio' } : { ...resto, usuarioId };
}

// POST /api/feedback — cualquier socio/admin autenticado puede enviar
router.post('/', verificarToken, async (req, res) => {
  try {
    const { mensaje, gymNombre, destino, anonimo } = req.body;
    if (!mensaje?.trim()) return res.status(400).json({ mensaje: 'El mensaje es requerido' });
    if (!req.gymId) return res.status(400).json({ mensaje: 'El usuario debe pertenecer a un gimnasio para enviar feedback' });

    const usuario = await prisma.user.findUnique({ where: { id: req.userId }, select: { nombre: true } });

    const feedback = await prisma.feedback.create({
      data: {
        usuarioId:     req.userId,
        nombreUsuario: usuario?.nombre || 'Usuario',
        gymId:         req.gymId,
        gymNombre:     gymNombre || null,
        mensaje:       mensaje.trim(),
        // Lo que no venga en la lista cae en 'plataforma', que es como se
        // comportaba antes de que existiera la separación.
        destino:       DESTINOS.includes(destino) ? destino : 'plataforma',
        anonimo:       !!anonimo
      }
    });

    res.status(201).json(conId(feedback));
  } catch (err) {
    res.status(500).json({ mensaje: 'Error al guardar el feedback' });
  }
});

/**
 * GET /api/feedback — cada rol ve lo suyo, y el filtro se arma acá.
 *
 * El superadmin ve los de la aplicación, de todos los gimnasios. El admin ve
 * los de SU gimnasio y solo los dirigidos al gimnasio: el gymId sale del token
 * (req.gymId), nunca de la query, así que no hay forma de pedir los de otro
 * cambiando la URL. Es el mismo criterio que sostiene el aislamiento entre
 * gimnasios en el resto del backend.
 */
router.get('/', verificarToken, async (req, res) => {
  try {
    let where;
    if (req.userRole === 'superadmin') {
      where = { destino: 'plataforma' };
    } else if (req.userRole === 'admin') {
      where = { destino: 'gimnasio', gymId: req.gymId };
    } else {
      return res.status(403).json({ mensaje: 'No autorizado' });
    }

    const resultado = await paginar(req, prisma.feedback, { where, orderBy: { createdAt: 'desc' } });
    if (Array.isArray(resultado)) return res.json(resultado.map(paraLeer));
    res.json({ ...resultado, data: resultado.data.map(paraLeer) });
  } catch {
    res.status(500).json({ mensaje: 'Error al obtener feedbacks' });
  }
});

/**
 * PATCH /api/feedback/:id/leido — cada uno marca los suyos.
 *
 * Va con updateMany y no update: así la condición de "es mío" viaja dentro del
 * WHERE en vez de comprobarse antes con otra consulta, y un admin no puede
 * marcar el de otro gimnasio ni el que va dirigido a la plataforma. Si no
 * coincide nada, count queda en 0 y se responde 404.
 */
router.patch('/:id/leido', verificarToken, async (req, res) => {
  try {
    let where;
    if (req.userRole === 'superadmin') {
      where = { id: req.params.id, destino: 'plataforma' };
    } else if (req.userRole === 'admin') {
      where = { id: req.params.id, destino: 'gimnasio', gymId: req.gymId };
    } else {
      return res.status(403).json({ mensaje: 'No autorizado' });
    }

    const { count } = await prisma.feedback.updateMany({ where, data: { leido: true } });
    if (!count) return res.status(404).json({ mensaje: 'Mensaje no encontrado' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ mensaje: 'Error' });
  }
});

module.exports = router;
