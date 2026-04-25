const mongoose = require('mongoose');

const MedidasSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fecha:     { type: Date, default: Date.now },
  peso:      { type: Number, default: null },
  cintura:   { type: Number, default: null },
  cadera:    { type: Number, default: null },
  pecho:     { type: Number, default: null },
  brazo:     { type: Number, default: null },
  muslo:     { type: Number, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Medidas', MedidasSchema);
