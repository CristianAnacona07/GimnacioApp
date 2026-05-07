const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  usuarioId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nombreUsuario: { type: String },
  gymId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Gym' },
  gymNombre:  { type: String },
  mensaje:    { type: String, required: true, maxlength: 1000 },
  leido:      { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
