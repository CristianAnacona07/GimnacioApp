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

/**
 * Firma del enlace "Ingresar por primera vez" del correo de contraseña
 * temporal. No es un token de acceso: solo sirve para que el login pueda
 * preguntarle al servidor si esa cuenta todavía tiene la activación
 * pendiente, sin abrir la puerta a que cualquiera consulte el estado de una
 * cuenta ajena probando ids (habría que falsificar el HMAC, y para eso hace
 * falta el JWT_SECRET).
 *
 * No se guarda en la base: se recalcula al validar. Es estable en el tiempo
 * a propósito — lo que decide si el enlace "ya se usó" es el propio
 * `debeCambiarPassword` de la cuenta, no un vencimiento del enlace.
 */
const firmaActivacion = (userId) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || '')
    .update(`activacion:${userId}`)
    .digest('hex')
    .slice(0, 32);

module.exports = { generarToken, hashToken, firmaActivacion };
