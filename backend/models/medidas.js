const mongoose = require('mongoose');

const MedidasSchema = new mongoose.Schema({
  gymId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: false, index: true },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fecha:     { type: Date, default: Date.now },
  peso:      { type: Number, default: null },
  cintura:   { type: Number, default: null },
  cadera:    { type: Number, default: null },
  pecho:     { type: Number, default: null },
  brazo:     { type: Number, default: null },
  muslo:     { type: Number, default: null },
}, { timestamps: true });

MedidasSchema.index({ gymId: 1, usuarioId: 1, fecha: 1 });

module.exports = mongoose.model('Medidas', MedidasSchema);
