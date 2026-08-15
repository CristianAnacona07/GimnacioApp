const mongoose = require('mongoose');

// Invitación de registro de un solo uso. La genera recepción (admin o
// recepcionista), viaja como link o QR (/invitacion/<token>) y es la única
// puerta de entrada al registro de socios: sin invitación vigente no hay registro.
const InvitacionSchema = new mongoose.Schema({
  gymId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
  token: { type: String, required: true, unique: true },
  creadaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  usada: { type: Boolean, default: false },
  usadaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  expiraEn: { type: Date, required: true }
}, { timestamps: true });

// Mongo borra solo las invitaciones al vencer (TTL). También borra las ya
// usadas cuando llega su fecha: el rastro de quién invitó queda en la auditoría.
InvitacionSchema.index({ expiraEn: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Invitacion', InvitacionSchema);
