const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ mensaje: 'Token no proporcionado' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'PALABRA_SECRETA');
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

module.exports = { verificarToken, soloAdmin, soloSuperAdmin };
