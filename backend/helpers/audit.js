const AuditLog = require('../models/auditlog');

/**
 * Registra una entrada de auditoría sin bloquear la respuesta al cliente.
 * Nunca lanza: si el log falla, sólo se registra en consola (no debe tumbar
 * la operación de negocio que sí tuvo éxito).
 *
 * @param {object} req      request de Express (para actor, gym, ip)
 * @param {string} accion   código de la acción, p.ej. 'ELIMINAR_GYM'
 * @param {object} extra    { recurso, recursoId, detalle }
 */
async function registrarAuditoria(req, accion, extra = {}) {
  try {
    await AuditLog.create({
      gymId:     req.gymId || null,
      actorId:   req.userId || null,
      actorRole: req.userRole || null,
      accion,
      recurso:   extra.recurso || null,
      recursoId: extra.recursoId || null,
      detalle:   extra.detalle || null,
      ip:        req.ip || req.headers?.['x-forwarded-for'] || null,
    });
  } catch (err) {
    console.error('No se pudo registrar auditoría:', err.message);
  }
}

module.exports = { registrarAuditoria };
