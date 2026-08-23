const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();
const { getPrismaClient } = require('../prisma/client');
const { esIdValido } = require('../lib/ids');
const { toApiGym, fromApiGymConfig } = require('../lib/gymMapper');
const { verificarToken, soloAdmin, soloSuperAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { enviarPasswordTemporal } = require('../helpers/email');

const prisma = getPrismaClient();
const { activarPlan, desactivarGymsVencidos } = require('../lib/planPlataformaVigencia');

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
// La cuenta se crea con una contraseña temporal real (no un hash inservible):
// el superadmin la ve una sola vez en pantalla y se la entrega al admin en
// persona, sin depender de que le llegue un correo. Queda obligado a
// cambiarla en su primer login (User.debeCambiarPassword).

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizarEmail = (valor) => String(valor || '').toLowerCase().trim();

// Lanza un Error con `.status` para que el handler decida el código de respuesta.
function errorHttp(mensaje, status) {
  const err = new Error(mensaje);
  err.status = status;
  return err;
}

/**
 * Crea el administrador del gimnasio (o le genera una contraseña temporal
 * nueva si ya existe) y devuelve esa contraseña en texto plano — se muestra
 * una sola vez a quien la crea, nunca se guarda en ningún otro lado.
 */
async function invitarAdmin({ gym, email, nombre, identificacion, telefono, req }) {
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

  const passPlano = crypto.randomBytes(6).toString('hex');
  const password = await bcrypt.hash(passPlano, await bcrypt.genSalt(10));

  if (usuario) {
    usuario = await prisma.user.update({ where: { id: usuario.id }, data: { password, debeCambiarPassword: true } });
  } else {
    usuario = await prisma.user.create({
      data: {
        gymId: gym.id,
        nombre: (nombre || '').trim() || emailNorm.split('@')[0],
        email: emailNorm,
        password,
        role: 'admin',
        debeCambiarPassword: true,
        // No-nulleables con default "" (mismo patrón que en el resto del
        // User: nunca guardan null, solo string vacío cuando no se completan).
        identificacion: (identificacion || '').trim(),
        telefono: (telefono || '').trim()
      }
    });
  }

  await registrarAuditoria(req, creado ? 'CREAR_ADMIN_GYM' : 'REINVITAR_ADMIN_GYM', {
    recurso: 'User',
    recursoId: usuario.id,
    detalle: { gymId: gym.id, email: emailNorm },
  });

  // Igual que con los socios: se manda la contraseña ya generada por correo
  // (entra por /registro), y solo se muestra en pantalla si el envío falló
  // o no hay correo configurado — nunca las dos cosas a la vez.
  const invitacionEnviada = await enviarPasswordTemporal({
    email: emailNorm, nombre: usuario.nombre, gymNombre: gym.nombre, password: passPlano
  });

  return {
    _id: usuario.id, email: emailNorm, nombre: usuario.nombre, creado,
    invitacionEnviada,
    passwordTemporal: invitacionEnviada ? null : passPlano
  };
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

// Métricas globales para el Dashboard del superadmin: solo gimnasios activos
// cuentan (uno desactivado no debería inflar los números de la plataforma).
// Va antes de /:slug: ese wildcard atraparía "/dashboard" como si fuera un
// slug (mismo motivo por el que /buscar y /dominio-permitido van antes).
router.get('/dashboard', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    // Se desactivan acá también (no solo en el login) para que el dashboard
    // no muestre "activo" un gimnasio que ya pasó su gracia simplemente
    // porque nadie de ese gym intentó loguearse todavía.
    await desactivarGymsVencidos(prisma);
    const ahora = new Date();
    const seisMesesAtras = new Date(ahora.getFullYear(), ahora.getMonth() - 5, 1);

    // "Activo" en todo este dashboard es suscripción vigente (planVenceEn en
    // el futuro), no el interruptor activo/desactivado de la tarjeta — un gym
    // con la suscripción vencida no debe sumar en ninguna de estas métricas,
    // aunque su cuenta siga habilitada. Mismo criterio que ya se ve en
    // Facturación y en las tarjetas de Gimnasios ("Activo hasta"/"Vencido
    // desde"), aplicado parejo acá para que el dashboard no cuente distinto
    // según la tarjeta.
    const gymVigente = { activo: true, planVenceEn: { gt: ahora } };

    // A diferencia de groupBy (usado más abajo, en GET /), count()/findMany()
    // SÍ pasan por la extensión de soft-delete: no hace falta agregar
    // deletedAt: null a mano. `gym: {...}` es un filtro por relación anidada,
    // que groupBy no soporta — por eso esta ruta no reusa ese helper.
    const [sociosActivos, adminTotal, gimnasiosActivos, sociosNuevos, gymsConPlan, planes, sociosPorGym] = await Promise.all([
      prisma.user.count({
        where: { gym: gymVigente, role: 'socio', fechaVencimiento: { gt: ahora } }
      }),
      prisma.user.count({
        where: { gym: gymVigente, role: 'admin' }
      }),
      prisma.gym.count({ where: gymVigente }),
      prisma.user.findMany({
        where: { gym: gymVigente, role: 'socio', createdAt: { gte: seisMesesAtras } },
        select: { createdAt: true }
      }),
      // Ingresos estimados: solo gimnasios con suscripción vigente y un plan asignado.
      prisma.gym.findMany({
        where: { ...gymVigente, planPlataformaId: { not: null } },
        select: { id: true, planPlataformaId: true, planPlataformaCampo: true }
      }),
      // findMany SÍ filtra deletedAt sola (a diferencia de groupBy): un plan
      // "eliminado" (soft-delete) no aparece acá, así que un gimnasio que lo
      // tenía asignado simplemente no suma nada — igual que sin plan.
      prisma.planPlataforma.findMany(),
      prisma.user.groupBy({
        by: ['gymId'],
        where: { role: 'socio', deletedAt: null, fechaVencimiento: { gt: ahora } },
        _count: { _all: true }
      })
    ]);

    const planPorId = new Map(planes.map(p => [p.id, p]));
    const sociosPorGymId = new Map(sociosPorGym.map(g => [String(g.gymId), g._count._all]));
    let ingresosEstimados = 0;
    for (const g of gymsConPlan) {
      const plan = planPorId.get(g.planPlataformaId);
      if (!plan) continue; // plan eliminado: no inventa ingreso
      // El gimnasio eligió UN solo valor del plan, no los dos juntos: el
      // mensual suma fijo; el "por suscriptor" escala con sus socios activos.
      // Sin campo guardado (asignación de antes de este cambio) no se sabe
      // cuál de los dos quiso decir, así que no suma nada — mejor un número
      // de menos que uno inventado.
      if (g.planPlataformaCampo === 'mensual') {
        ingresosEstimados += Number(plan.precioMensual);
      } else if (g.planPlataformaCampo === 'porSuscriptor') {
        const socios = sociosPorGymId.get(g.id) || 0;
        ingresosEstimados += Number(plan.precioPorSuscriptor) * socios;
      }
    }

    // Bucketing en JS: no hay precedente de date_trunc/$queryRaw en el
    // backend y el volumen de filas es chico, así que alcanza con esto en
    // vez de meter SQL crudo por primera vez.
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      meses.push({ mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, cantidad: 0 });
    }
    for (const s of sociosNuevos) {
      const clave = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const bucket = meses.find(m => m.mes === clave);
      if (bucket) bucket.cantidad++;
    }

    res.json({ sociosActivos, adminTotal, gimnasiosActivos, ingresosEstimados, nuevosSociosPorMes: meses });
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
    // Mismo barrido que en el login: que la insignia "Activo/Inactivo" de la
    // tarjeta refleje una desactivación automática por vencimiento aunque
    // nadie de ese gym haya intentado loguearse todavía.
    await desactivarGymsVencidos(prisma);
    const gyms = await prisma.gym.findMany({ orderBy: { createdAt: 'desc' } });

    // "Usuarios" por gym, para la tarjeta del panel: un socio cuenta si su
    // membresía está vigente (no vencida, no nula); el staff (admin,
    // entrenador, empleado) no tiene membresía, así que cuenta con solo
    // existir. `groupBy` no pasa por la extensión de soft-delete (solo
    // intercepta find*/count/update — ver softDelete.js), así que
    // `deletedAt: null` se agrega a mano en las dos consultas.
    const ahora = new Date();
    const [socios, staff, planes] = await Promise.all([
      prisma.user.groupBy({
        by: ['gymId'],
        where: { role: 'socio', deletedAt: null, fechaVencimiento: { gt: ahora } },
        _count: { _all: true }
      }),
      prisma.user.groupBy({
        by: ['gymId'],
        where: { role: { in: ['admin', 'entrenador', 'empleado'] }, deletedAt: null },
        _count: { _all: true }
      }),
      // Se manda el nombre y los precios, no solo el id: la ficha del
      // gimnasio y el selector de plan los necesitan sin otro viaje al
      // servidor.
      prisma.planPlataforma.findMany()
    ]);
    const sociosMap = Object.fromEntries(socios.map(c => [String(c.gymId), c._count._all]));
    const staffMap = Object.fromEntries(staff.map(c => [String(c.gymId), c._count._all]));
    const countMap = {};
    for (const c of [...socios, ...staff]) {
      const id = String(c.gymId);
      countMap[id] = (countMap[id] || 0) + c._count._all;
    }
    const planPorId = new Map(planes.map(p => [p.id, conId(p)]));
    res.json(gyms.map(g => ({
      ...toApiGym(g),
      totalUsuarios: countMap[String(g.id)] || 0,
      // Desglose para el panel de "Información" de cada tarjeta — el número
      // combinado de arriba se deja igual para no tocar lo que ya se ve.
      sociosActivos: sociosMap[String(g.id)] || 0,
      staffTotal: staffMap[String(g.id)] || 0,
      planPlataforma: g.planPlataformaId ? planPorId.get(g.planPlataformaId) || null : null
    })));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear gym (solo superadmin)
router.post('/crear', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    const { nombre, slug, logo, slogan, colores, modulos, spotifyPlaylist, adminEmail, adminNombre, adminIdentificacion, adminTelefono, planPlataformaId, planPlataformaCampo } = req.body;
    const existe = await prisma.gym.findFirst({ where: { slug }, select: { id: true } });
    if (existe) return res.status(400).json({ error: 'Ya existe un gimnasio con ese código' });

    // El correo del admin se valida ANTES de crear el gimnasio: así un correo
    // mal escrito no deja un gimnasio a medio configurar.
    const quiereAdmin = !!normalizarEmail(adminEmail);
    if (quiereAdmin && !EMAIL_RX.test(normalizarEmail(adminEmail))) {
      return res.status(400).json({ error: 'El correo del administrador no es válido' });
    }

    let gym = await prisma.gym.create({
      data: {
        nombre, slug, logo, slogan, spotifyPlaylist,
        planPlataformaId: planPlataformaId || null,
        // Sin plan, el campo tampoco tiene sentido — que no quede un campo
        // "huérfano" sin id asociado.
        planPlataformaCampo: planPlataformaId ? (planPlataformaCampo || null) : null,
        ...fromApiGymConfig({ colores, modulos })
      }
    });
    await registrarAuditoria(req, 'CREAR_GYM', { recurso: 'Gym', recursoId: gym.id });

    // Con plan asignado desde la creación, la vigencia arranca ahora mismo —
    // y ese primer mes queda como una fila "pagada" en Facturación, no como
    // un estado invisible: un gym recién creado nunca debería figurar activo
    // sin que Facturación explique por qué.
    if (planPlataformaId) {
      const plan = await prisma.planPlataforma.findUnique({ where: { id: planPlataformaId } });
      if (plan) {
        await activarPlan(prisma, { gymId: gym.id, planPlataforma: plan, campo: planPlataformaCampo || 'mensual', sociosActivos: 0 });
        gym = await prisma.gym.findUnique({ where: { id: gym.id } });
      }
    }

    // El gimnasio ya está creado: si la invitación falla se informa, pero no se
    // revierte nada (el superadmin puede reintentarla desde la ficha del gym).
    let admin = null;
    if (quiereAdmin) {
      try {
        admin = await invitarAdmin({ gym, email: adminEmail, nombre: adminNombre, identificacion: adminIdentificacion, telefono: adminTelefono, req });
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
      select: { id: true, nombre: true, email: true, emailVerified: true, createdAt: true, identificacion: true, telefono: true }
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

    const admin = await invitarAdmin({
      gym, email: req.body.email, nombre: req.body.nombre,
      identificacion: req.body.identificacion, telefono: req.body.telefono, req
    });
    res.status(201).json(admin);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.code === 'P2002') return res.status(400).json({ error: 'Ese correo ya está registrado en el gimnasio' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Editar los datos de un administrador ya existente (nombre, cédula, contacto)
// — el correo no se toca acá: cambiarlo es un cambio de identidad de login,
// no un dato de contacto, y no forma parte de este flujo.
router.put('/:id/admin/:adminId', verificarToken, soloSuperAdmin, async (req, res) => {
  try {
    if (!esIdValido(req.params.id) || !esIdValido(req.params.adminId)) {
      return res.status(400).json({ error: 'Identificador inválido' });
    }
    const admin = await prisma.user.findFirst({
      where: { id: req.params.adminId, gymId: req.params.id, role: 'admin' }
    });
    if (!admin) return res.status(404).json({ error: 'Administrador no encontrado en este gimnasio' });

    const { nombre, identificacion, telefono } = req.body;
    const actualizado = await prisma.user.update({
      where: { id: req.params.adminId },
      data: {
        nombre: (nombre || '').trim() || admin.nombre,
        identificacion: (identificacion || '').trim(),
        telefono: (telefono || '').trim()
      }
    });
    await registrarAuditoria(req, 'EDITAR_ADMIN_GYM', { recurso: 'User', recursoId: admin.id, detalle: { gymId: req.params.id } });

    res.json({
      _id: actualizado.id, nombre: actualizado.nombre, email: actualizado.email,
      identificacion: actualizado.identificacion, telefono: actualizado.telefono
    });
  } catch (error) {
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

    const existe = await prisma.gym.findUnique({
      where: { id: req.params.id },
      select: { id: true, planPlataformaId: true, planPlataformaCampo: true }
    });
    if (!existe) return res.status(404).json({ error: 'Gimnasio no encontrado' });

    // El plan de plataforma (lo que le cobramos al gimnasio) tampoco lo puede
    // tocar el admin del propio gimnasio, por el mismo motivo que el slug.
    // Se elige UN valor puntual del plan (mensual o por suscriptor, no los
    // dos juntos) — sin id no tiene sentido guardar cuál de los dos.
    let activarPlanNuevo = null;
    if (req.userRole === 'superadmin' && 'planPlataformaId' in req.body) {
      const nuevoId = req.body.planPlataformaId || null;
      const nuevoCampo = nuevoId ? (req.body.planPlataformaCampo || null) : null;
      cambios.planPlataformaId = nuevoId;
      cambios.planPlataformaCampo = nuevoCampo;

      // La vigencia solo se reinicia si de verdad cambió a qué está asignado
      // (otro plan, otro campo, o se quitó/puso) — volver a guardar lo mismo
      // no le regala un mes gratis al gimnasio.
      const cambioDeVerdad = nuevoId !== existe.planPlataformaId || nuevoCampo !== existe.planPlataformaCampo;
      if (cambioDeVerdad) {
        if (nuevoId) {
          activarPlanNuevo = { id: nuevoId, campo: nuevoCampo };
        } else {
          // Se quitó el plan: sin plan no hay vigencia que mostrar.
          cambios.planActivadoEn = null;
          cambios.planVenceEn = null;
        }
      }
    }

    let gym = await prisma.gym.update({ where: { id: req.params.id }, data: cambios });
    await registrarAuditoria(req, 'EDITAR_GYM', { recurso: 'Gym', recursoId: req.params.id });

    if (activarPlanNuevo) {
      const plan = await prisma.planPlataforma.findUnique({ where: { id: activarPlanNuevo.id } });
      if (plan) {
        const sociosActivos = await prisma.user.count({
          where: { gymId: gym.id, role: 'socio', deletedAt: null, fechaVencimiento: { gt: new Date() } }
        });
        await activarPlan(prisma, {
          gymId: gym.id, planPlataforma: plan, campo: activarPlanNuevo.campo || 'mensual', sociosActivos
        });
        gym = await prisma.gym.findUnique({ where: { id: gym.id } });
      }
    }

    res.json(toApiGym(gym));
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Ese subdominio ya está en uso' });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
