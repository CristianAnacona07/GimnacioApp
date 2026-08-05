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
  // Días de membresía que otorga el plan. Es lo que la matrícula precarga en el
  // campo "días" al elegirlo; sin esto un plan "Quincenal" podía acabar sumando
  // los 30 días que traía el formulario por defecto.
  // El default de 30 mantiene coherentes los planes creados antes de este campo.
  dias: {
    type: Number,
    default: 30,
    min: 1
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