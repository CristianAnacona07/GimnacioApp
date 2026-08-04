const mongoose = require('mongoose');

/**
 * Registro de auditoría de operaciones sensibles (crear/editar/borrar,
 * renovaciones de membresía, cambios de rol, etc.). Sirve para trazabilidad,
 * detección de abuso y cumplimiento.
 */
const AuditLogSchema = new mongoose.Schema({
  gymId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  actorRole: { type: String },
  accion:  { type: String, required: true },      // p.ej. 'RENOVAR_MEMBRESIA', 'ELIMINAR_GYM'
  recurso: { type: String },                      // tipo de recurso afectado, p.ej. 'User'
  recursoId: { type: mongoose.Schema.Types.ObjectId },
  detalle: { type: mongoose.Schema.Types.Mixed }, // datos extra (antes/después, montos...)
  ip:      { type: String },
}, { timestamps: true });

// Consulta típica: auditoría de un gym ordenada por fecha.
AuditLogSchema.index({ gymId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
