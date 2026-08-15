const mongoose = require('mongoose');

/**
 * Una sesión personalizada reservada: un socio con un profesional, a una hora.
 *
 * La fecha y la hora se guardan como TEXTO ('2026-08-12', '20:00') y no como
 * fecha con zona horaria. Es a propósito: el servidor corre en UTC y el
 * gimnasio no, así que una cita "martes a las 20:00" guardada como instante se
 * convierte en otra hora al leerla. Guardada como texto, las 20:00 son las
 * 20:00 para todos. Además ordena bien alfabéticamente al usar YYYY-MM-DD.
 */
const CitaSchema = new mongoose.Schema({
  gymId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
  socioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  profesionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  fecha: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  hora:  { type: String, required: true, match: /^\d{2}:\d{2}$/ },
  duracionMin: { type: Number, required: true, min: 15 },

  estado: {
    type: String,
    enum: ['agendada', 'cumplida', 'cancelada', 'ausente'],
    default: 'agendada'
  },
  // Precio vigente al reservar: si el gimnasio lo sube después, las citas ya
  // hechas conservan lo que se pactó.
  precio: { type: Number, default: 0 },
  nota: { type: String, default: '' },
  canceladaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

// Dos personas no pueden reservar al mismo profesional a la misma hora. Es el
// índice el que lo garantiza, no una comprobación previa: entre consultar y
// guardar, otra reserva puede colarse.
// Solo aplica a las citas vivas — una cancelada libera el hueco.
CitaSchema.index(
  { profesionalId: 1, fecha: 1, hora: 1 },
  { unique: true, partialFilterExpression: { estado: { $in: ['agendada', 'cumplida'] } } }
);

CitaSchema.index({ gymId: 1, fecha: 1 });

module.exports = mongoose.model('Cita', CitaSchema);
