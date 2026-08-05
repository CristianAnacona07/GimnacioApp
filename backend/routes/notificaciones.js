const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Rutina = require('../models/rutina');
const Noticia = require('../models/noticia');
const { verificarToken } = require('../middleware/auth');

/**
 * Avisos de la campanita del navbar.
 *
 * Todo se calcula al vuelo a partir de los datos que ya existen (vencimientos,
 * asignaciones, noticias): NO hay colección de notificaciones. Eso significa
 * que un aviso desaparece solo en cuanto el problema se resuelve, sin que nadie
 * tenga que ir a marcarlo, que es justo lo que se quiere de "3 socios vencen
 * esta semana".
 *
 * Lo "leído" tampoco se guarda aquí: cada aviso viaja con una `firma` que
 * cambia cuando cambia su contenido, y el frontend recuerda en localStorage las
 * firmas ya vistas. Así el punto rojo vuelve a aparecer cuando el número sube,
 * pero no cada vez que se abre la app.
 */

const DIA = 24 * 60 * 60 * 1000;

/** Hoy a las 00:00: comparar contra `new Date()` haría que un vencimiento de
 *  esta misma tarde contara como vencido desde la mañana. */
function inicioDeHoy() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Construye un aviso. Devuelve null cuando no hay nada que contar, para poder
 * escribir la lista entera y filtrarla de un golpe al final.
 */
function aviso({ id, grupo, nivel, icono, titulo, detalle, ruta, firma }) {
  return { id, grupo, nivel, icono, titulo, detalle, ruta, firma: firma ?? `${id}:0` };
}

// ── Avisos del admin ────────────────────────────────────────────────────────
async function avisosAdmin(gymId) {
  const hoy = inicioDeHoy();
  const enUnaSemana = new Date(hoy.getTime() + 7 * DIA);
  const haceUnaSemana = new Date(hoy.getTime() - 7 * DIA);

  const [vencidas, porVencer, sinMembresia, nuevos, entrenadores, sinEntrenador, conEntrenador] =
    await Promise.all([
      User.countDocuments({ gymId, role: 'socio', fechaVencimiento: { $ne: null, $lt: hoy } }),
      User.countDocuments({ gymId, role: 'socio', fechaVencimiento: { $gte: hoy, $lte: enUnaSemana } }),
      User.countDocuments({ gymId, role: 'socio', fechaVencimiento: null }),
      User.countDocuments({ gymId, role: 'socio', fechaRegistro: { $gte: haceUnaSemana } }),
      User.find({ gymId, role: 'entrenador' }).select('_id').lean(),
      User.countDocuments({ gymId, role: 'socio', entrenadorId: null }),
      // `distinct` no pasa por el hook del borrado suave (solo lo hacen
      // find/findOne/countDocuments), así que aquí hay que excluir a mano los
      // registros borrados o un socio eliminado seguiría "ocupando" a su
      // entrenador y este nunca aparecería como libre.
      User.distinct('entrenadorId', {
        gymId, role: 'socio', deletedAt: null, entrenadorId: { $ne: null }
      })
    ]);

  const ocupados = new Set(conEntrenador.map(String));
  const entrenadoresLibres = entrenadores.filter(e => !ocupados.has(String(e._id))).length;

  return [
    vencidas > 0 && aviso({
      id: 'membresias-vencidas', grupo: 'Clientes', nivel: 'alta', icono: '🔴',
      titulo: `${vencidas} ${vencidas === 1 ? 'membresía vencida' : 'membresías vencidas'}`,
      detalle: vencidas === 1 ? 'Ese socio ya no puede entrenar' : 'Esos socios ya no pueden entrenar',
      ruta: '/admin/socios', firma: `membresias-vencidas:${vencidas}`
    }),
    porVencer > 0 && aviso({
      id: 'membresias-por-vencer', grupo: 'Clientes', nivel: 'media', icono: '🟡',
      titulo: `${porVencer} ${porVencer === 1 ? 'membresía vence' : 'membresías vencen'} esta semana`,
      detalle: 'Buen momento para recordarles la renovación',
      ruta: '/admin/socios', firma: `membresias-por-vencer:${porVencer}`
    }),
    sinMembresia > 0 && aviso({
      id: 'socios-sin-membresia', grupo: 'Clientes', nivel: 'info', icono: '⚪',
      titulo: `${sinMembresia} ${sinMembresia === 1 ? 'socio sin membresía' : 'socios sin membresía'}`,
      detalle: 'Están registrados pero nunca han pagado',
      ruta: '/admin/socios', firma: `socios-sin-membresia:${sinMembresia}`
    }),
    nuevos > 0 && aviso({
      id: 'socios-nuevos', grupo: 'Clientes', nivel: 'ok', icono: '🟢',
      titulo: `${nuevos} ${nuevos === 1 ? 'socio nuevo' : 'socios nuevos'} esta semana`,
      detalle: 'Dales la bienvenida y asígnales rutina',
      ruta: '/admin/socios', firma: `socios-nuevos:${nuevos}`
    }),
    entrenadoresLibres > 0 && aviso({
      id: 'entrenadores-sin-socios', grupo: 'Trabajadores', nivel: 'media', icono: '🟡',
      titulo: `${entrenadoresLibres} ${entrenadoresLibres === 1 ? 'entrenador sin socios' : 'entrenadores sin socios'}`,
      detalle: 'No tienen a nadie asignado todavía',
      // Apunta a /admin/socios y no a /admin/entrenadores porque esa segunda
      // pantalla sigue siendo un marcador de posición; la lista de personas
      // real (socios, trabajadores y admins) vive en /admin/socios.
      ruta: '/admin/socios', firma: `entrenadores-sin-socios:${entrenadoresLibres}`
    }),
    sinEntrenador > 0 && aviso({
      id: 'socios-sin-entrenador', grupo: 'Trabajadores', nivel: 'info', icono: '⚪',
      titulo: `${sinEntrenador} ${sinEntrenador === 1 ? 'socio sin entrenador' : 'socios sin entrenador'}`,
      detalle: 'Nadie está siguiendo su progreso',
      ruta: '/admin/socios', firma: `socios-sin-entrenador:${sinEntrenador}`
    })
  ].filter(Boolean);
}

// ── Avisos del entrenador ───────────────────────────────────────────────────
async function avisosEntrenador(gymId, entrenadorId) {
  const hoy = inicioDeHoy();
  const enUnaSemana = new Date(hoy.getTime() + 7 * DIA);
  const mios = { gymId, role: 'socio', entrenadorId };

  const [vencidas, porVencer, misSocios] = await Promise.all([
    User.countDocuments({ ...mios, fechaVencimiento: { $ne: null, $lt: hoy } }),
    User.countDocuments({ ...mios, fechaVencimiento: { $gte: hoy, $lte: enUnaSemana } }),
    User.find(mios).select('_id').lean()
  ]);

  // Socios propios que aún no tienen ninguna rutina cargada.
  const ids = misSocios.map(s => s._id);
  // Igual que arriba: `distinct` ignora el borrado suave, y una rutina borrada
  // no debe contar como "este socio ya tiene rutina".
  const conRutina = ids.length
    ? await Rutina.distinct('usuarioId', { gymId, deletedAt: null, usuarioId: { $in: ids } })
    : [];
  const yaTienen = new Set(conRutina.map(String));
  const sinRutina = ids.filter(id => !yaTienen.has(String(id))).length;

  return [
    vencidas > 0 && aviso({
      id: 'mis-socios-vencidos', grupo: 'Tus socios', nivel: 'alta', icono: '🔴',
      titulo: `${vencidas} de tus socios ${vencidas === 1 ? 'tiene' : 'tienen'} la membresía vencida`,
      detalle: 'No podrán entrenar hasta que renueven',
      ruta: '/entrenador/socios', firma: `mis-socios-vencidos:${vencidas}`
    }),
    porVencer > 0 && aviso({
      id: 'mis-socios-por-vencer', grupo: 'Tus socios', nivel: 'media', icono: '🟡',
      titulo: `${porVencer} ${porVencer === 1 ? 'vence' : 'vencen'} esta semana`,
      detalle: 'Avísales antes de que se queden fuera',
      ruta: '/entrenador/socios', firma: `mis-socios-por-vencer:${porVencer}`
    }),
    sinRutina > 0 && aviso({
      id: 'mis-socios-sin-rutina', grupo: 'Tus socios', nivel: 'info', icono: '⚪',
      titulo: `${sinRutina} de tus socios ${sinRutina === 1 ? 'no tiene' : 'no tienen'} rutina`,
      detalle: 'Están entrenando sin plan asignado',
      ruta: '/entrenador/socios', firma: `mis-socios-sin-rutina:${sinRutina}`
    })
  ].filter(Boolean);
}

/**
 * Aviso de la propia membresía del socio, o null si no hay nada que decir.
 *
 * Solo habla cuando queda una semana o menos: avisar con 40 días de antelación
 * convertiría la campana en ruido permanente y dejaría de mirarse. Va aparte de
 * la ruta para poder probar los bordes (venció ayer / vence hoy / vence en 8)
 * sin base de datos.
 */
function avisoMembresia(fechaVencimiento, hoy) {
  if (!fechaVencimiento) return null;

  // Se compara medianoche contra medianoche. Si se restaran las horas reales,
  // una membresía que expira hoy a las 18:00 daría 0,75 días → "vence en 1
  // día", y "vence hoy" no aparecería nunca salvo que el vencimiento cayera
  // clavado a las 00:00.
  const fin = new Date(fechaVencimiento);
  fin.setHours(0, 0, 0, 0);
  const dias = Math.round((fin - hoy) / DIA);

  if (dias < 0) {
    const cuantos = Math.abs(dias);
    return aviso({
      id: 'mi-membresia', grupo: 'Tu cuenta', nivel: 'alta', icono: '🔴',
      titulo: 'Tu membresía venció',
      detalle: `Hace ${cuantos} ${cuantos === 1 ? 'día' : 'días'}. Renuévala para seguir entrenando`,
      ruta: '/socio/planes', firma: `mi-membresia:vencida:${cuantos}`
    });
  }

  if (dias <= 7) {
    return aviso({
      id: 'mi-membresia', grupo: 'Tu cuenta', nivel: 'media', icono: '🟡',
      titulo: dias === 0 ? 'Tu membresía vence hoy' : `Tu membresía vence en ${dias} ${dias === 1 ? 'día' : 'días'}`,
      detalle: 'Renuévala para no perder el acceso',
      ruta: '/socio/planes', firma: `mi-membresia:porvencer:${dias}`
    });
  }

  return null;
}

// ── Avisos del socio ────────────────────────────────────────────────────────
async function avisosSocio(gymId, usuarioId) {
  const hoy = inicioDeHoy();
  const haceUnaSemana = new Date(hoy.getTime() - 7 * DIA);

  const [usuario, noticias, ultimaRutina] = await Promise.all([
    User.findById(usuarioId).select('fechaVencimiento').lean(),
    Noticia.find({ gymId, estado: true, createdAt: { $gte: haceUnaSemana } })
      .select('_id').sort({ createdAt: -1 }).lean(),
    Rutina.findOne({ gymId, usuarioId }).select('updatedAt').sort({ updatedAt: -1 }).lean()
  ]);

  const lista = [];

  const avisoVencimiento = avisoMembresia(usuario && usuario.fechaVencimiento, hoy);
  if (avisoVencimiento) lista.push(avisoVencimiento);

  if (noticias.length > 0) {
    lista.push(aviso({
      id: 'noticias-nuevas', grupo: 'Tu gimnasio', nivel: 'info', icono: '🔵',
      titulo: `${noticias.length} ${noticias.length === 1 ? 'noticia nueva' : 'noticias nuevas'}`,
      detalle: 'Publicadas esta semana',
      ruta: '/socio/noticias',
      // La firma cuelga de la noticia más reciente: si publican otra, el aviso
      // vuelve a marcarse como no leído aunque el total no cambie.
      firma: `noticias-nuevas:${noticias[0]._id}`
    }));
  }

  if (ultimaRutina && ultimaRutina.updatedAt && new Date(ultimaRutina.updatedAt) >= haceUnaSemana) {
    lista.push(aviso({
      id: 'rutina-actualizada', grupo: 'Tu cuenta', nivel: 'ok', icono: '🟢',
      titulo: 'Tu rutina fue actualizada',
      detalle: 'Tu entrenador le hizo cambios esta semana',
      ruta: '/socio/mi-rutina',
      firma: `rutina-actualizada:${new Date(ultimaRutina.updatedAt).getTime()}`
    }));
  }

  return lista;
}

// GET / — avisos del usuario autenticado, según su rol.
router.get('/', verificarToken, async (req, res) => {
  try {
    let avisos = [];
    if (req.userRole === 'admin' || req.userRole === 'superadmin') {
      avisos = await avisosAdmin(req.gymId);
    } else if (req.userRole === 'entrenador') {
      avisos = await avisosEntrenador(req.gymId, req.userId);
    } else {
      avisos = await avisosSocio(req.gymId, req.userId);
    }
    res.json({ avisos });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Helpers colgados del router para poder probarlos sin base de datos (mismo
// recurso que usa routes/admin.js con los suyos de CSV).
router.avisoMembresia = avisoMembresia;
router.inicioDeHoy = inicioDeHoy;

module.exports = router;
