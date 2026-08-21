const jwt = require('jsonwebtoken');
const { permisosEfectivos, puede } = require('../lib/permisos');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    // Falla fuerte: nunca firmar/verificar con un secreto por defecto conocido.
    throw new Error('JWT_SECRET no está definido en las variables de entorno');
}

const verificarToken = (req, res, next) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ mensaje: 'Token no proporcionado' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId    = decoded.id;
        req.userRole  = decoded.role;
        req.userCargo = decoded.cargo || null;
        req.gymId     = decoded.gymId || null;
        next();
    } catch {
        return res.status(401).json({ mensaje: 'Token inválido o expirado' });
    }
};

const soloAdmin = (req, res, next) => {
    if (req.userRole !== 'admin' && req.userRole !== 'superadmin') {
        return res.status(403).json({ mensaje: 'Acceso denegado. Solo administradores.' });
    }
    next();
};

const soloSuperAdmin = (req, res, next) => {
    if (req.userRole !== 'superadmin') {
        return res.status(403).json({ mensaje: 'Acceso denegado.' });
    }
    next();
};

const esAdmin = (req) => req.userRole === 'admin' || req.userRole === 'superadmin';

// Recepción (check-in, búsqueda de socios, historial de asistencia): el admin
// o un empleado con cargo de recepcionista.
const soloRecepcion = (req, res, next) => {
    const esRecepcionista = req.userRole === 'empleado' && req.userCargo === 'recepcionista';
    if (!esAdmin(req) && !esRecepcionista) {
        return res.status(403).json({ mensaje: 'Acceso denegado.' });
    }
    next();
};

// Exige un nivel de permiso en una sección. El admin y el superadmin pasan
// sin consultar nada: mandan sobre todo su gimnasio.
//
// Los permisos se leen de la base en cada petición, no del token: si vinieran
// firmados dentro, quitarle una sección a alguien no surtiría efecto hasta que
// caducara su sesión, y esas duran ocho horas. Es una lectura por clave
// primaria y sólo para cuentas que no son admin.
// Carga los permisos de quien pide, una sola vez por petición aunque se
// consulten varias veces.
const cargarPermisos = async (req) => {
    if (req.permisos) return req.permisos;
    const { getPrismaClient } = require('../prisma/client');
    const usuario = await getPrismaClient().user.findUnique({
        where: { id: req.userId },
        select: { role: true, cargo: true, permisos: true }
    });
    req.permisos = usuario ? permisosEfectivos(usuario) : null;
    return req.permisos;
};

// Versión consultable desde dentro de una ruta, para cuando el permiso no
// decide si se entra sino qué se devuelve (ver rutinas GET /:usuarioId).
const tienePermiso = async (req, seccion, nivel = 'lectura') => {
    if (esAdmin(req)) return true;
    return puede(await cargarPermisos(req), seccion, nivel);
};

const requierePermiso = (seccion, nivel = 'lectura') => async (req, res, next) => {
    if (esAdmin(req)) return next();
    try {
        const permisos = await cargarPermisos(req);
        if (!permisos) return res.status(401).json({ mensaje: 'Token inválido o expirado' });
        if (!puede(permisos, seccion, nivel)) {
            return res.status(403).json({ mensaje: 'Acceso denegado.' });
        }
        next();
    } catch (error) {
        console.error('Error al comprobar permisos:', error);
        res.status(500).json({ mensaje: 'Error al comprobar permisos' });
    }
};

// Resuelve el usuarioId que el solicitante puede consultar/escribir.
// Admin/superadmin: el solicitado (param/body) o el propio si no se indica.
// Socio/entrenador: siempre el propio (ignora lo que mande el cliente).
const resolverUsuarioId = (req, solicitado) => (esAdmin(req) ? (solicitado || req.userId) : req.userId);

// Filtro de propiedad para queries por _id de un recurso.
// Admin/superadmin: sin restricción extra (alcance de gym). Socio: solo sus propios docs.
const filtroPropiedad = (req) => (esAdmin(req) ? {} : { usuarioId: req.userId });

module.exports = {
    JWT_SECRET,
    verificarToken,
    soloAdmin,
    soloSuperAdmin,
    soloRecepcion,
    requierePermiso,
    tienePermiso,
    esAdmin,
    resolverUsuarioId,
    filtroPropiedad
};
