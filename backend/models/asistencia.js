const mongoose = require('mongoose');

/**
 * Registro de asistencia (check-in) de un socio al gimnasio.
 * El método indica cómo se registró: código/QR escaneado en recepción,
 * huella (si en el futuro se integra un lector), o marcado manual por el admin.
 */
const AsistenciaSchema = new mongoose.Schema({
  gymId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fecha:     { type: Date, default: Date.now },
  metodo:    { type: String, enum: ['codigo', 'qr', 'huella', 'manual'], default: 'codigo' },
  registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Consultas típicas: asistencias de un gym por fecha, y de un socio.
AsistenciaSchema.index({ gymId: 1, fecha: -1 });
AsistenciaSchema.index({ gymId: 1, usuarioId: 1, fecha: -1 });

module.exports = mongoose.model('Asistencia', AsistenciaSchema);
