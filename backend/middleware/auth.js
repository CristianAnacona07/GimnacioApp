const jwt = require('jsonwebtoken');

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
        req.userId   = decoded.id;
        req.userRole = decoded.role;
        req.gymId    = decoded.gymId || null;
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
    esAdmin,
    resolverUsuarioId,
    filtroPropiedad
};
