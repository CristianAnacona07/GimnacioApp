const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { enviarPasswordTemporal } = require('../helpers/email');
const { MAX_NOMBRE, sedeDelGym, interpretarParametroSede, filtroSede, validarNombre, puedeModificarA } = require('../lib/sedes');

const prisma = getPrismaClient();

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Da de alta al administrador de una sede recién creada y le manda su clave
 * temporal por correo.
 *
 * Es un admin del MISMO gimnasio, atado a esa sede: no crea un inquilino nuevo
 * ni toca la facturación, que sigue siendo una sola por gimnasio. Lo que sí
 * hace es que un admin pueda crear otro admin, cosa que hasta ahora era
 * exclusiva del superadmin — acotado a la sede que acaba de abrir.
 *
 * Devuelve { creado, correoEnviado, password } o { error }.
 */
async function crearAdminDeSede(tx, { gymId, sedeId, nombre, email, gymNombre }) {
  const nombreLimpio = String(nombre || '').trim();
  const emailNorm = String(email || '').toLowerCase().trim();
  if (!nombreLimpio) return { error: 'El nombre del administrador es obligatorio' };
  if (!EMAIL_RX.test(emailNorm)) return { error: 'El correo del administrador no es válido' };

  // El índice único es (email, gymId): la misma persona puede ser admin en otro
  // gimnasio, pero no dos veces en éste.
  const existe = await tx.user.findFirst({ where: { email: emailNorm, gymId }, select: { id: true } });
  if (existe) return { error: 'Ese correo ya está registrado en este gimnasio' };

  // Temporal legible pero no adivinable; se cambia en el primer ingreso.
  const password = crypto.randomBytes(6).toString('base64url');
  const hash = await bcrypt.hash(password, await bcrypt.genSalt(10));

  const admin = await tx.user.create({
    data: {
      gymId, sedeId, nombre: nombreLimpio, email: emailNorm,
      password: hash, role: 'admin', debeCambiarPassword: true
    },
    select: { id: true, nombre: true, email: true }
  });

  return { creado: admin, password, gymNombre };
}

function conId(s) {
  if (!s) return s;
  const { id, ...resto } = s;
  return { ...resto, _id: id };
}

/**
 * Cómo se llama la sede que representa al local que ya existía: "Principal".
 *
 * Se prueban alternativas por si ese nombre choca con el que el admin acaba de
 * pedir o ya está tomado: el índice único es (gymId, nombre) y un choque
 * abortaría la creación entera. El admin puede renombrarla después.
 */
async function nombreLibreParaPrincipal(tx, gymId, nombrePedido) {
  const gym = await tx.gym.findUnique({ where: { id: gymId }, select: { nombre: true } });
  const candidatos = ['Principal', 'Sede principal', gym?.nombre?.trim(), 'Sede 1'].filter(Boolean);
  for (const c of candidatos) {
    if (c.toLowerCase() === nombrePedido.toLowerCase()) continue;
    const tomado = await tx.sede.findFirst({ where: { gymId, nombre: c }, select: { id: true } });
    if (!tomado) return c.slice(0, MAX_NOMBRE);
  }
  return `Principal ${Date.now().toString().slice(-4)}`;
}

// Las sedes las lee cualquiera del gimnasio: el selector de la barra las
// necesita, y saber que existe un local no es información sensible.
router.get('/', verificarToken, async (req, res) => {
  try {
    const sedes = await prisma.sede.findMany({
      where: { gymId: req.gymId, ...(req.query.todas === 'si' ? {} : { activa: true }) },
      orderBy: { nombre: 'asc' }
    });

    // Quién administra cada local. Va en la misma respuesta y en una sola
    // consulta, en vez de una por sede: la pantalla necesita mostrarlo al lado
    // del nombre y al editar.
    const admins = await prisma.user.findMany({
      where: { gymId: req.gymId, role: 'admin', sedeId: { in: sedes.map(s => s.id) } },
      select: { nombre: true, email: true, sedeId: true },
      orderBy: { createdAt: 'asc' }
    });
    const porSede = new Map();
    for (const a of admins) {
      // El primero por antigüedad: si un local tuviera dos, manda el original.
      if (!porSede.has(a.sedeId)) porSede.set(a.sedeId, { nombre: a.nombre, email: a.email });
    }

    res.json(sedes.map(s => ({ ...conId(s), admin: porSede.get(s.id) || null })));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// A qué sede pertenece quien pregunta. El cliente lo necesita para saber si
// está mirando su propio local (donde puede tocar) o el de al lado (donde sólo
// mira): cada sede se maneja aparte, con su propio administrador.
router.get('/mia', verificarToken, async (req, res) => {
  try {
    const yo = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { sedeId: true }
    });
    res.json({ sedeId: yo?.sedeId || null });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear una sede NO es crear un gimnasio: no hay plan, ni factura, ni base de
// socios aparte. Por eso lo hace el admin y no el superadmin.
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    if (!req.gymId) return res.status(400).json({ error: 'La sesión no tiene gimnasio' });

    const nombre = validarNombre(req.body.nombre);
    if (!nombre) return res.status(400).json({ error: 'El nombre de la sede es obligatorio' });

    const repetida = await prisma.sede.findFirst({ where: { gymId: req.gymId, nombre } });
    if (repetida) return res.status(409).json({ error: 'Ya existe una sede con ese nombre' });

    const datos = {
      gymId: req.gymId,
      nombre,
      direccion: (req.body.direccion || '').trim() || null,
      telefono: (req.body.telefono || '').trim() || null
    };

    // El gimnasio YA es un local: cuando el admin agrega su primera sede, lo que
    // está haciendo es abrir la SEGUNDA. Así que el local que ya existía se
    // convierte en una sede sola —con toda su gente adentro— y la que pidió
    // arranca vacía. Si hubiera que crear también la principal a mano, un
    // gimnasio con 200 socios estrenaría el selector con las dos listas vacías.
    const yaHabia = await prisma.sede.count({ where: { gymId: req.gymId } });

    let principal = null;
    let adminNuevo = null;
    const { sede, nombrePrincipal } = await prisma.$transaction(async (tx) => {
      let nombrePrincipal = null;
      if (yaHabia === 0) {
        nombrePrincipal = await nombreLibreParaPrincipal(tx, req.gymId, nombre);
        principal = await tx.sede.create({
          // Es la casa matriz: representa al local que ya existía.
          data: { gymId: req.gymId, nombre: nombrePrincipal, esPrincipal: true }
        });
        await tx.user.updateMany({
          where: { gymId: req.gymId, sedeId: null },
          data: { sedeId: principal.id }
        });
      }
      const creada = await tx.sede.create({ data: datos });

      // El administrador de la sede nueva, si vino en el formulario. Va dentro
      // de la misma transacción: si falla su alta, la sede tampoco se crea, y
      // así no queda un local a medio abrir.
      if (req.body.admin?.email || req.body.admin?.nombre) {
        const gym = await tx.gym.findUnique({ where: { id: req.gymId }, select: { nombre: true } });
        const r = await crearAdminDeSede(tx, {
          gymId: req.gymId, sedeId: creada.id,
          nombre: req.body.admin.nombre, email: req.body.admin.email,
          gymNombre: gym?.nombre || 'tu gimnasio'
        });
        if (r.error) throw Object.assign(new Error(r.error), { esDeNegocio: true });
        adminNuevo = r;
      }

      return { sede: creada, nombrePrincipal };
    });

    // El correo va FUERA de la transacción: si el servidor de correo tarda o
    // falla, la sede y su administrador ya quedaron creados igual. La clave se
    // devuelve para poder dictarla en el momento.
    let correoEnviado = false;
    if (adminNuevo) {
      correoEnviado = await enviarPasswordTemporal({
        email: adminNuevo.creado.email, nombre: adminNuevo.creado.nombre,
        gymNombre: adminNuevo.gymNombre, password: adminNuevo.password
      }).catch(() => false);
      registrarAuditoria(req, 'CREAR_ADMIN_SEDE', {
        recurso: 'User', recursoId: adminNuevo.creado.id,
        detalle: `${adminNuevo.creado.email} para la sede ${sede.nombre}`
      });
    }

    registrarAuditoria(req, 'CREAR_SEDE', {
      recurso: 'Sede', recursoId: sede.id,
      detalle: nombrePrincipal
        ? `${nombre} (y se creó "${nombrePrincipal}" con el personal y los socios que ya existían)`
        : nombre
    });
    // El cliente necesita saber que apareció una sede más de la que pidió.
    res.status(201).json({
      ...conId(sede),
      principalCreada: principal ? conId(principal) : null,
      admin: adminNuevo ? {
        nombre: adminNuevo.creado.nombre,
        email: adminNuevo.creado.email,
        // Sólo se muestra acá y una vez: después queda hasheada.
        password: correoEnviado ? null : adminNuevo.password,
        correoEnviado
      } : null
    });
  } catch (error) {
    if (error?.esDeNegocio) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Mover a una persona de sede.
 *
 * Hace falta para dos cosas: repartir el personal cuando se abre un local
 * (todos quedaron en la principal) y para cuando un socio se cambia de sede.
 * Sin esto el dato se congela el día del alta y deja de servir.
 */
router.put('/asignar/:usuarioId', verificarToken, soloAdmin, async (req, res) => {
  try {
    // No se puede sacar a alguien de OTRA sede: eso lo hace su propio
    // administrador. Mover a los de la propia sede sí, que es como se
    // reparte el personal al abrir un local.
    const permiso = await puedeModificarA(req, req.params.usuarioId);
    if (!permiso.ok) return res.status(403).json({ error: permiso.motivo });

    const { sedeId } = req.body;

    if (sedeId) {
      const sede = await sedeDelGym(req.gymId, sedeId);
      if (!sede) return res.status(404).json({ error: 'Sede no encontrada en este gimnasio' });
    } else {
      // Dejar a alguien sin sede lo vuelve invisible: no aparece en ningún
      // local pero sigue contando para la facturación. Si el gimnasio tiene
      // locales, todos pertenecen a uno.
      const hay = await prisma.sede.count({ where: { gymId: req.gymId, activa: true } });
      if (hay) return res.status(400).json({ error: 'Elegí una sede: todos pertenecen a un local' });
    }

    // updateMany para que el gymId viaje en el WHERE: así no se puede mover a
    // alguien de otro gimnasio acertando su id.
    const { count } = await prisma.user.updateMany({
      where: { id: req.params.usuarioId, gymId: req.gymId },
      data: { sedeId: sedeId || null }
    });
    if (!count) return res.status(404).json({ error: 'Usuario no encontrado' });

    registrarAuditoria(req, 'CAMBIAR_SEDE_USUARIO', {
      recurso: 'User', recursoId: req.params.usuarioId, detalle: sedeId || 'sin sede'
    });
    res.json({ mensaje: 'Sede actualizada' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    // La principal representa al gimnasio en sí, que crea el superadmin: no
    // se edita ni se desactiva desde acá. Apagarla dejaría al gimnasio sin su
    // local original y a toda su gente sin sede.
    const objetivo = await sedeDelGym(req.gymId, req.params.id);
    if (!objetivo) return res.status(404).json({ error: 'Sede no encontrada' });
    if (objetivo.esPrincipal) {
      return res.status(403).json({ error: 'La sede principal no se modifica desde acá' });
    }

    const datos = {};
    if (req.body.nombre !== undefined) {
      const nombre = validarNombre(req.body.nombre);
      if (!nombre) return res.status(400).json({ error: 'El nombre de la sede es obligatorio' });
      const repetida = await prisma.sede.findFirst({
        where: { gymId: req.gymId, nombre, id: { not: req.params.id } }
      });
      if (repetida) return res.status(409).json({ error: 'Ya existe una sede con ese nombre' });
      datos.nombre = nombre;
    }
    if (req.body.direccion !== undefined) datos.direccion = (req.body.direccion || '').trim() || null;
    if (req.body.telefono !== undefined) datos.telefono = (req.body.telefono || '').trim() || null;
    if (req.body.activa !== undefined) datos.activa = !!req.body.activa;

    // updateMany y no update: así el gymId viaja en el WHERE y no se puede
    // tocar la sede de otro gimnasio acertando el id.
    const { count } = await prisma.sede.updateMany({
      where: { id: req.params.id, gymId: req.gymId },
      data: datos
    });
    if (!count) return res.status(404).json({ error: 'Sede no encontrada' });

    const sede = await prisma.sede.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
    registrarAuditoria(req, 'EDITAR_SEDE', { recurso: 'Sede', recursoId: req.params.id, detalle: sede?.nombre });
    res.json(conId(sede));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Una sede no se borra, se desactiva: su historial de entradas tiene que
// sobrevivir al cierre del local.
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    // La principal representa al gimnasio en sí, que crea el superadmin: no
    // se edita ni se desactiva desde acá. Apagarla dejaría al gimnasio sin su
    // local original y a toda su gente sin sede.
    const objetivo = await sedeDelGym(req.gymId, req.params.id);
    if (!objetivo) return res.status(404).json({ error: 'Sede no encontrada' });
    if (objetivo.esPrincipal) {
      return res.status(403).json({ error: 'La sede principal no se modifica desde acá' });
    }

    // Desactivar un local con gente adentro los dejaba huérfanos: dejaban de
    // verse en toda la app —su sede ya no aparece en ningún lado— pero seguían
    // contando para la facturación. Hay que moverlos primero.
    const [socios, personal] = await Promise.all([
      prisma.user.count({ where: { gymId: req.gymId, sedeId: req.params.id, role: 'socio' } }),
      prisma.user.count({ where: { gymId: req.gymId, sedeId: req.params.id, role: { not: 'socio' } } })
    ]);
    if (socios || personal) {
      const partes = [];
      if (socios) partes.push(`${socios} ${socios === 1 ? 'socio' : 'socios'}`);
      if (personal) partes.push(`${personal} del personal`);
      return res.status(409).json({
        error: `Esta sede todavía tiene ${partes.join(' y ')}. Movelos a otro local antes de desactivarla.`
      });
    }

    const { count } = await prisma.sede.updateMany({
      where: { id: req.params.id, gymId: req.gymId },
      data: { activa: false }
    });
    if (!count) return res.status(404).json({ error: 'Sede no encontrada' });
    registrarAuditoria(req, 'DESACTIVAR_SEDE', { recurso: 'Sede', recursoId: req.params.id });
    res.json({ mensaje: 'Sede desactivada' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.sedeDelGym = sedeDelGym;
router.interpretarParametroSede = interpretarParametroSede;
router.filtroSede = filtroSede;
router.validarNombre = validarNombre;

module.exports = router;
