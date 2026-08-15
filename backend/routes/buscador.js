const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { verificarToken } = require('../middleware/auth');
const { ilikeContains } = require('../lib/searchFilters');

const prisma = getPrismaClient();

/**
 * Buscador global de la lupa del navbar.
 *
 * Una sola petición devuelve todo lo que el usuario puede alcanzar, ya
 * recortado por su rol: el frontend no decide qué puede ver: solo pinta lo que
 * llega. Las secciones del menú NO viajan por aquí, se filtran en el cliente
 * porque ya las conoce y así el listado responde sin esperar a la red.
 *
 * Qué ve cada rol:
 *   admin       → socios, entrenadores, administradores y planes de su gym
 *   entrenador  → únicamente los socios que tiene asignados
 *   socio       → solo planes (no puede listar a los demás miembros)
 */

// Días que le quedan de membresía. Negativo = ya venció (y cuántos hace),
// null = nunca tuvo. Se cuenta de medianoche a medianoche para que la etiqueta
// de la lupa diga lo mismo que la campanita: comparando horas reales, un
// vencimiento de esta tarde saldría como "vence en 1 d" en vez de "vence hoy".
function diasRestantes(fechaVencimiento) {
  if (!fechaVencimiento) return null;
  const DIA = 1000 * 60 * 60 * 24;
  const fin = new Date(fechaVencimiento);
  fin.setHours(0, 0, 0, 0);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((fin - hoy) / DIA);
}

function aPersona(u) {
  return {
    _id: u.id,
    nombre: u.nombre,
    email: u.email,
    role: u.role,
    fotoUrl: u.fotoUrl || '',
    codigoAcceso: u.codigoAcceso || '',
    identificacion: u.identificacion || '',
    diasRestantes: diasRestantes(u.fechaVencimiento)
  };
}

const SELECT_PERSONA = {
  id: true, nombre: true, email: true, role: true, fotoUrl: true,
  codigoAcceso: true, fechaVencimiento: true, identificacion: true
};

/**
 * Filtro de personas que le corresponde a quien pregunta.
 *
 * Devuelve null cuando el rol no puede buscar personas en absoluto. Está
 * separado de la ruta (y colgado del router más abajo) para poder probarlo sin
 * levantar la base de datos: es la frontera entre "buscar a un socio" y
 * "listar el gimnasio entero desde otra cuenta", y conviene tenerla cubierta.
 */
function filtroPersonas(req, q) {
  const esAdmin = req.userRole === 'admin' || req.userRole === 'superadmin';
  const esEntrenador = req.userRole === 'entrenador';
  if (!esAdmin && !esEntrenador) return null;

  const filtro = {
    gymId: req.gymId,
    OR: [
      ilikeContains('nombre', q),
      ilikeContains('email', q),
      ilikeContains('identificacion', q),
      { codigoAcceso: q }
    ]
  };

  if (esEntrenador) {
    // Un entrenador solo alcanza a los suyos: sin esto la lupa se convertiría
    // en un listado completo del gimnasio.
    filtro.role = 'socio';
    filtro.entrenadorId = req.userId;
  } else {
    filtro.role = { in: ['socio', 'entrenador', 'admin'] };
  }

  return filtro;
}

/** Primero los socios: es a quien más se busca en el día a día. */
function ordenarPorRol(personas) {
  const orden = { socio: 0, entrenador: 1, admin: 2 };
  return [...personas].sort((a, b) => (orden[a.role] ?? 3) - (orden[b.role] ?? 3));
}

router.get('/', verificarToken, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    // Con menos de dos letras cualquier búsqueda devolvería medio gimnasio.
    if (q.length < 2) return res.json({ personas: [], planes: [] });

    // ── Personas ──────────────────────────────────────────────────────────
    let personas = [];
    const filtro = filtroPersonas(req, q);
    if (filtro) {
      const encontrados = await prisma.user.findMany({ where: filtro, select: SELECT_PERSONA, take: 12 });
      personas = ordenarPorRol(encontrados).map(aPersona);
    }

    // ── Planes ────────────────────────────────────────────────────────────
    // Visibles para todos los roles: el socio los consulta para renovar.
    const planes = await prisma.plan.findMany({
      where: { gymId: req.gymId, OR: [ilikeContains('nombre', q), ilikeContains('descripcion', q)] },
      select: { id: true, nombre: true, precio: true, dias: true },
      take: 6
    });

    res.json({ personas, planes: planes.map(({ id, ...p }) => ({ ...p, _id: id })) });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Helpers colgados del router para poder probarlos sin base de datos (mismo
// recurso que usa routes/admin.js con los suyos de CSV).
router.filtroPersonas = filtroPersonas;
router.ordenarPorRol = ordenarPorRol;
router.aPersona = aPersona;

module.exports = router;
