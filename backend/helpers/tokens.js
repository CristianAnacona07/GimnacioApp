const crypto = require('crypto');

/**
 * Tokens opacos para los enlaces que se envían por correo (restablecer
 * contraseña, verificar cuenta, invitar a un administrador).
 *
 * El token viaja en claro dentro del enlace, pero en la base de datos se guarda
 * hasheado —igual que una contraseña—, de modo que quien lea la colección no
 * pueda usarlo para suplantar a nadie.
 */
const generarToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { generarToken, hashToken };
