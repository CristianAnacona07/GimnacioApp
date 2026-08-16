const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { esIdValido } = require('../lib/ids');
const { toApiGym, fromApiGymConfig } = require('../lib/gymMapper');
const { verificarToken, soloAdmin, soloSuperAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { generarToken, hashToken } = require('../helpers/tokens');
const { enviarInvitacionAdmin } = require('../helpers/email');

const prisma = getPrismaClient();

const SELECT_GYM_PUBLICO = {
  id: true, nombre: true, slug: true, logo: true, slogan: true,
  colorPrimario: true, colorSecundario: true, colorFondo: true, colorNavbar: true, colorMenu: true, colorDias: true,
  moduloRutinas: true, moduloProgreso: true, moduloMedidas: true, moduloPagos: true, moduloNoticias: true, moduloCronometro: true,
  spotifyPlaylist: true
};

// Igual a SELECT_GYM_PUBLICO pero con agenda/landing: la app la refresca al
// abrir (agenda) y el editor de landing la necesita para precargar el estado.
const SELECT_GYM_CONFIG = {
  ...SELECT_GYM_PUBLICO,
  agendaActiva: true, agendaDuracionMin: true, agendaPrecio: true,
  agendaHorasMinimasReserva: true, agendaHorasMinimasCancelacion: true, agendaDiasVisibles: true,
  landing: true
};

function conId(p) {
  if (!p) return p;
  const { id, ...rest } = p;
  return { ...rest, _id: id };
}

// ── ALTA DEL ADMINISTRADOR DE UN GIMNASIO ────────────────────────
// La cuenta se crea sin contraseña utilizable: se guarda un hash de un valor
// aleatorio que nadie conoce, y la única forma de entrar es el enlace que llega
// por correo. Así no hay que inventar (ni transmitir) una contraseña temporal.

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITACION_DIAS = 7;

const normalizarEmail = (valor) => String(valor || '').toLowerCase().trim();

// Lanza un Error con `.status` para que el handler decida el código de respuesta.
function errorHttp(mensaje, status) {
  const err = new Error(mensaje);
  err.status = status;
  return err;
}

/**
 * Crea el administrador del gimnasio (o reenvía la invitación si ya existe) y
 * le envía el enlace para definir su contraseña.
 */
async function invitarAdmin({ gym, email, nombre, req }) {
  const emailNorm = normalizarEmail(email);
  if (!EMAIL_RX.test(emailNorm)) throw errorHttp('El correo del administrador no es válido', 400);

  // El índice único es {email, gymId}: la búsqueda va acotada a este gimnasio.
  let usuario = await prisma.user.findFirst({ where: { email: emailNorm, gymId: gym.id } });
  const creado = !usuario;

  if (usuario) {
    if (usuario.role !== 'admin') {
      throw errorHttp('Ese correo ya existe en el gimnasio con otro rol', 400);
    }
  }

  const token = generarToken();
  const resetToken = hashToken(token);
  const resetTokenExpiry = new Date(Date.now() + INVITACION_DIAS * 24 * 3600 * 1000);

  if (usuario) {
    usuario = await prisma.user.update({ where: { id: usuario.id }, data: { resetToken, resetTokenExpiry } });
  } else {
    const passwordInutilizable = await bcrypt.hash(generarToken(), await bcrypt.genSalt(10));
    usuario = await prisma.user.create({
      data: {
        gymId: gym.id,
        nombre: (nombre || '').trim() || emailNorm.split('@')[0],
        email: emailNorm,
        password: passwordInutilizable,
        role: 'admin',
        resetToken,
        resetTokenExpiry
      }
    });
  }

  const invitacionEnviada = await enviarInvitacionAdmin({
    email: emailNorm,
    nombre: usuario.nombre,
    gymNombre: gym.nombre,
    token,
    dias: INVITACION_DIAS,
  });

  await registrarAuditoria(req, creado ? 'CREAR_ADMIN_GYM' : 'REINVITAR_ADMIN_GYM', {
    recurso: 'User',
    recursoId: usuario.id,
    detalle: { gymId: gym.id, email: emailNorm, invitacionEnviada },
  });

  return { _id: usuario.id, email: emailNorm, nombre: usuario.nombre, creado, invitacionEnviada };
}

// ── PÚBLICAS ────────────────────────────────────────────────────

// Buscar gyms activos (pantalla de selección)
router.get('/buscar', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const where = q
      ? { activo: true, nombre: { contains: q, mode: 'insensitive' } }
      : { activo: true };

    const gyms = await prisma.gym.findMany({ where, select: SELECT_GYM_PUBLICO, take: 20 });

    res.json(gyms.map(toApiGym));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ¿Este dominio es de un gimnasio nuestro?
//
// Lo consulta el servidor web antes de pedir un certificado HTTPS para un
// subdominio que ve por primera vez. Sin esta comprobación, cualquiera podría
// apuntar su dominio a nuestro servidor y hacernos pedir certificados sin
// límite hasta que la autoridad nos bloquee por abuso.
router.get('/dominio-permitido', async (req, res) => {
  try {
    const dominio = String(req.query.domain || '').toLowerCase().trim();
    const raiz = (process.env.TENANT_ROOT_DOMAIN || '').toLowerCase().trim();
    if (!dominio || !raiz) return res.status(404).send('no');

    // El dominio principal y www siempre valen (ahí vive la app general).
    if (dominio === raiz || dominio === `www.${raiz}`) return res.status(200).send('ok');

    if (!dominio.endsWith(`.${raiz}`)) return res.status(404).send('no');
    const slug = dominio.slice(0, -(raiz.length + 1));
    // Un subdominio anidado (a.b.raiz) no corresponde a ningún gimnasio.
    if (!slug || slug.includes('.')) return res.status(404).send('no');

    const gym = await prisma.gym.findFirst({ where: { slug, activo: true }, select: { id: true } });
    return gym ? res.status(200).send('ok') : res.status(404).send('no');
  } catch {
    res.status(404).send('no');
  }
});

// Todo lo que necesita la página pública del gimnasio, en una sola consulta y
// sin sesión: los datos del gym más los planes y noticias que ya administra.
// Va antes de /:slug solo por claridad; son rutas de distinta profundidad.
router.get('/:slug/landing', async (req, res) => {
  try {
    // Incluye modulos y playlist aunque la página no los use: al visitarla, la
    // app guarda este gym como el activo, y sin esos campos un módulo apagado
    // volvería a aparecer encendido.
    const gym = await prisma.gym.findFirst({
      where: { slug: req.params.slug, activo: true },
      select: { ...SELECT_GYM_PUBLICO, landing: true }
    });
    if (!gym) return res.status(404).json({ error: 'Gimnasio no encontrado' });
    if (!gym.landing?.activa) {
      return res.status(404).json({ error: 'Este gimnasio todavía no publicó su página' });
    }

    // Solo se consulta lo que el gimnasio decidió mostrar.
    const [planes, noticias] = await Promise.all([
      gym.landing.planes?.activo
        ? prisma.plan.findMany({
            where: { gymId: gym.id },
            select: { id: true, nombre: true, precio: true, dias: true, descripcion: true, caracteristicas: true },
            orderBy: { precio: 'asc' }, take: 12
          })
        : [],
      gym.landing.noticias?.activo
        ? prisma.noticia.findMany({
            where: { gymId: gym.id, estado: true },
            select: { id: true, titulo: true, descripcion: true, imageUrl: true, dia: true, horaInicio: true, horaFin: true, createdAt: true },
            orderBy: { createdAt: 'desc' }, take: 6
          })
        : []
    ]);

    res.json({ gym: toApiGym(gym), planes: planes.map(conId), noticias: noticias.map(conId) });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener gym por slug
router.get('/:slug', async (req, res) => {
  try {
    // Incluye agenda/landing: el admin edita su página y su configuración de
    // citas a partir del gym en memoria, que se refresca por esta ruta al abrir la app.
    const gym = await prisma.gym.findFirst({ where: { slug: req.params.slug, activo: true }, select: SELECT_GYM_CONFIG });
    if (!gym) return res.status(404).json({ error: 'Gimnasio no encontrado' });
    res.json(toApiGym(gym));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── SUPERADMIN ───────────────────────────────────────────────────

// Todos los gyms (activos e inactivos)
router.get('/', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const gyms = await prisma.gym.findMany({ orderBy: { createdAt: 'desc' } });
    // Contar socios por gym
    const counts = await prisma.user.groupBy({
      by: ['gymId'],
      where: { role: { in: ['socio', 'admin'] } },
      _count: { _all: true }
    });
    const countMap = Object.fromEntries(counts.map(c => [String(c.gymId), c._count._all]));
    res.json(gyms.map(g => ({ ...toApiGym(g), totalUsuarios: countMap[String(g.id)] || 0 })));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear gym (solo superadmin)
router.post('/crear', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const { nombre, slug, logo, slogan, colores, modulos, spotifyPlaylist, adminEmail, adminNombre } = req.body;
    const existe = await prisma.gym.findFirst({ where: { slug }, select: { id: true } });
    if (existe) return res.status(400).json({ error: 'Ya existe un gimnasio con ese código' });

    // El correo del admin se valida ANTES de crear el gimnasio: así un correo
    // mal escrito no deja un gimnasio a medio configurar.
    const quiereAdmin = !!normalizarEmail(adminEmail);
    if (quiereAdmin && !EMAIL_RX.test(normalizarEmail(adminEmail))) {
      return res.status(400).json({ error: 'El correo del administrador no es válido' });
    }

    const gym = await prisma.gym.create({
      data: { nombre, slug, logo, slogan, spotifyPlaylist, ...fromApiGymConfig({ colores, modulos }) }
    });
    await registrarAuditoria(req, 'CREAR_GYM', { recurso: 'Gym', recursoId: gym.id });

    // El gimnasio ya está creado: si la invitación falla se informa, pero no se
    // revierte nada (el superadmin puede reintentarla desde la ficha del gym).
    let admin = null;
    if (quiereAdmin) {
      try {
        admin = await invitarAdmin({ gym, email: adminEmail, nombre: adminNombre, req });
      } catch (err) {
        admin = { error: err.message };
      }
    }

    res.status(201).json({ ...toApiGym(gym), admin });
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'El código ya está en uso' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Administradores del gimnasio (para la ficha del superadmin)
router.get('/:id/admins', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    if (!esIdValido(req.params.id)) {
      return res.status(400).json({ error: 'Identificador de gimnasio inválido' });
    }
    const admins = await prisma.user.findMany({
      where: { gymId: req.params.id, role: 'admin' },
      select: { id: true, nombre: true, email: true, emailVerified: true, createdAt: true }
    });
    res.json(admins.map(({ id, ...a }) => ({ ...a, _id: id })));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Invitar a un administrador (o reenviarle el enlace si ya existe)
router.post('/:id/admin', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    if (!esIdValido(req.params.id)) {
      return res.status(400).json({ error: 'Identificador de gimnasio inválido' });
    }
    const gym = await prisma.gym.findUnique({ where: { id: req.params.id } });
    if (!gym) return res.status(404).json({ error: 'Gimnasio no encontrado' });

    const admin = await invitarAdmin({ gym, email: req.body.email, nombre: req.body.nombre, req });
    res.status(201).json(admin);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.code === 'P2002') return res.status(400).json({ error: 'Ese correo ya está registrado en el gimnasio' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Activar / desactivar gym
router.patch('/:id/estado', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    if (!esIdValido(req.params.id)) {
      return res.status(400).json({ error: 'Identificador de gimnasio inválido' });
    }
    const existe = await prisma.gym.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existe) return res.status(404).json({ error: 'Gimnasio no encontrado' });

    const gym = await prisma.gym.update({ where: { id: req.params.id }, data: { activo: req.body.activo } });
    await registrarAuditoria(req, 'CAMBIAR_ESTADO_GYM', { recurso: 'Gym', recursoId: req.params.id, detalle: { activo: req.body.activo } });
    res.json(toApiGym(gym));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar gym
router.delete('/:id', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    if (!esIdValido(req.params.id)) {
      return res.status(400).json({ error: 'Identificador de gimnasio inválido' });
    }

    // No permitir eliminar un gimnasio que aún tiene usuarios asociados (evita huérfanos)
    const userCount = await prisma.user.count({ where: { gymId: req.params.id } });
    if (userCount > 0) {
      return res.status(400).json({ error: 'No se puede eliminar un gimnasio con usuarios activos' });
    }

    const existe = await prisma.gym.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existe) return res.status(404).json({ error: 'Gimnasio no encontrado' });

    await prisma.gym.softDelete({ id: req.params.id });
    await registrarAuditoria(req, 'ELIMINAR_GYM', { recurso: 'Gym', recursoId: req.params.id });
    res.json({ mensaje: 'Gimnasio eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── ADMIN DEL GYM ────────────────────────────────────────────────

// Actualizar configuración del gym (admin o superadmin)
router.put('/:id/configuracion', verificarToken, soloAdmin, async (req, res) => {
  try {
    // El admin sólo puede configurar SU propio gym; el superadmin, cualquiera.
    if (req.userRole !== 'superadmin' && String(req.gymId) !== String(req.params.id)) {
      return res.status(403).json({ error: 'No autorizado para configurar este gimnasio' });
    }
    const { nombre, logo, slogan, colores, modulos, spotifyPlaylist, landing, agenda } = req.body;
    const cambios = { nombre, logo, slogan, ...fromApiGymConfig({ colores, modulos, agenda }) };
    if (typeof spotifyPlaylist === 'string') cambios.spotifyPlaylist = spotifyPlaylist;
    // La página pública se guarda entera desde su propio editor: es un JSONB,
    // así que el cliente puede mandar lo que quiera en ese subárbol (a
    // diferencia de colores/modulos/agenda, que son columnas propias).
    if (landing && typeof landing === 'object') cambios.landing = landing;

    // El subdominio (slug) solo lo puede cambiar el superadmin: afecta el enrutamiento
    // multi-tenant (<slug>.dominio) y es único entre gimnasios.
    if (req.userRole === 'superadmin' && typeof req.body.slug === 'string') {
      const slug = req.body.slug.toLowerCase().trim();
      if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(slug)) {
        return res.status(400).json({ error: 'Subdominio inválido (usa minúsculas, números y guiones)' });
      }
      cambios.slug = slug;
    }

    const existe = await prisma.gym.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existe) return res.status(404).json({ error: 'Gimnasio no encontrado' });

    const gym = await prisma.gym.update({ where: { id: req.params.id }, data: cambios });
    await registrarAuditoria(req, 'EDITAR_GYM', { recurso: 'Gym', recursoId: req.params.id });
    res.json(toApiGym(gym));
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Ese subdominio ya está en uso' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
