const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  gymId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gym',
    required: false,
    index: true
  },
  nombre: {
    type: String,
    required: true
  },
  precio: {
    type: Number,
    required: true
  },
  descripcion: {
    type: String,
    required: true
  },
  caracteristicas: {
    type: [String],
    required: true
  }
}, { timestamps: true }); // createdAt + updatedAt automáticos (consistente con los demás modelos)

planSchema.plugin(require('./plugins/softDelete'));

module.exports = mongoose.model('Plan', planSchema);